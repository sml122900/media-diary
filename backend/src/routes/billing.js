/**
 * @file billing.js
 * 토스페이먼츠 + Google Play 인앱결제 API (Phase 9.3, Stage 11.3.4)
 * POST /api/billing/checkout        — 결제 주문 생성 (토스)
 * POST /api/billing/confirm         — 결제 승인 (토스 결제창 완료 후)
 * POST /api/billing/webhook         — 토스 Webhook 수신 (이중 안전장치)
 * POST /api/billing/google/verify   — Google Play 인앱결제 purchaseToken 검증
 * GET  /api/billing/history         — 결제 이력 목록
 * GET  /api/billing/history/:id     — 단건 결제 상세
 * POST /api/billing/refund/:paymentId — 환불 (관리자 전용)
 */

const express = require('express');
const router = express.Router();
const { JWT } = require('google-auth-library');
const pool = require('../db');
const auth = require('../middleware/auth');

const TOSS_API_BASE = 'https://api.tosspayments.com/v1';

// 토큰 패키지 정의 (가격·토큰량 서버에서만 관리)
const PACKAGES = {
  small:  { amount: 1000,  base_tokens: 100,  bonus_tokens: 0   },
  medium: { amount: 3000,  base_tokens: 350,  bonus_tokens: 50  },
  large:  { amount: 10000, base_tokens: 1300, bonus_tokens: 300 },
};

const FIRST_CHARGE_BONUS_RATE = 0.2; // 첫 충전 +20%

// Google Play 상품 ID → 서버 패키지 매핑 (Play Console 등록값, Stage 11.3.1)
const GOOGLE_PACKAGE_NAME = 'com.mediadiary.app'; // capacitor.config.json appId와 동일, 변경 불가
const GOOGLE_PRODUCT_TO_PACKAGE = {
  token_small: 'small',
  token_medium: 'medium',
  token_large: 'large',
};

let googleAuthClient = null;

/** Google 서비스 계정 JWT 클라이언트 (최초 호출 시 1회 생성) */
function getGoogleAuthClient() {
  if (googleAuthClient) return googleAuthClient;
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON 환경변수가 설정되지 않았습니다.');
  }
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  googleAuthClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: ['https://www.googleapis.com/auth/androidpublisher'],
  });
  return googleAuthClient;
}

/** Google Play Developer API로 purchaseToken 조회 (구매 상태 검증용) */
async function fetchGooglePurchase(productId, purchaseToken) {
  const client = getGoogleAuthClient();
  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/`
    + `${GOOGLE_PACKAGE_NAME}/purchases/products/${productId}/tokens/${purchaseToken}`;
  const res = await client.request({ url });
  return res.data; // { purchaseState, orderId, ... }
}

const ORDER_NAMES = {
  small:  '미디어 다이어리 100토큰',
  medium: '미디어 다이어리 350토큰',
  large:  '미디어 다이어리 1,300토큰',
};

/** 토스 API Basic 인증 헤더 */
function tossAuthHeader() {
  const encoded = Buffer.from(`${process.env.TOSS_SECRET_KEY}:`).toString('base64');
  return `Basic ${encoded}`;
}

/** 토스 API POST 호출 — 실패 시 에러 throw */
async function tossRequest(path, body = null) {
  const res = await fetch(`${TOSS_API_BASE}${path}`, {
    method: 'POST',
    headers: {
      Authorization: tossAuthHeader(),
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || '토스페이먼츠 API 오류');
    err.tossCode = data.code;
    err.httpStatus = res.status;
    throw err;
  }
  return data;
}

/** 토스 API GET 호출 — paymentKey로 결제 정보 재조회 */
async function tossGet(path) {
  const res = await fetch(`${TOSS_API_BASE}${path}`, {
    method: 'GET',
    headers: { Authorization: tossAuthHeader() },
  });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data.message || '토스페이먼츠 조회 실패');
    err.tossCode = data.code;
    err.httpStatus = res.status;
    throw err;
  }
  return data;
}

/**
 * POST /api/billing/checkout
 * 결제 주문 생성 — 클라이언트가 토스 결제창 호출 전 서버에 주문 등록
 * body: { packageType: 'small' | 'medium' | 'large' }
 * 반환: { orderId, orderName, amount, customerKey, tokensToAdd, isFirstCharge }
 */
router.post('/checkout', auth, async (req, res) => {
  const { packageType } = req.body;
  const pkg = PACKAGES[packageType];
  if (!pkg) {
    return res.status(400).json({ success: false, message: '유효하지 않은 패키지입니다.' });
  }

  try {
    // 첫 충전 보너스 여부 확인
    const { rows: userRows } = await pool.query(
      'SELECT has_used_first_charge_bonus FROM users WHERE id = $1',
      [req.user.id]
    );
    const isFirstCharge = !userRows[0]?.has_used_first_charge_bonus;
    const firstBonus = isFirstCharge ? Math.floor(pkg.base_tokens * FIRST_CHARGE_BONUS_RATE) : 0;
    const totalTokens = pkg.base_tokens + pkg.bonus_tokens + firstBonus;

    // orderId — 사용자ID + 밀리초 + 랜덤 4자리 (UNIQUE 보장)
    const rand = String(Math.floor(Math.random() * 9000) + 1000);
    const orderId = `md-${req.user.id}-${Date.now()}-${rand}`;

    // pending 상태로 결제 이력 선행 저장
    await pool.query(
      `INSERT INTO payment_history
         (user_id, amount_krw, tokens_added, base_tokens, bonus_tokens, package_type, toss_order_id, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')`,
      [req.user.id, pkg.amount, totalTokens, pkg.base_tokens, pkg.bonus_tokens + firstBonus, packageType, orderId]
    );

    res.json({
      success: true,
      data: {
        orderId,
        orderName: ORDER_NAMES[packageType],
        amount: pkg.amount,
        customerKey: `user-${req.user.id}`,
        tokensToAdd: totalTokens,
        isFirstCharge,
        firstBonus,
      },
    });
  } catch (err) {
    console.error('billing/checkout 오류:', err.message);
    res.status(500).json({ success: false, message: '결제 주문 생성 중 오류가 발생했습니다.' });
  }
});

/**
 * POST /api/billing/confirm
 * 토스 결제창 통과 후 최종 결제 승인
 * body: { paymentKey, orderId, amount }
 * 반환: { addedTokens, newBalance }
 */
router.post('/confirm', auth, async (req, res) => {
  const { paymentKey, orderId, amount } = req.body;
  if (!paymentKey || !orderId || !amount) {
    return res.status(400).json({ success: false, message: 'paymentKey, orderId, amount가 필요합니다.' });
  }

  // 주문 조회 — 본인 + pending 상태만 허용
  const { rows: orderRows } = await pool.query(
    `SELECT * FROM payment_history WHERE toss_order_id = $1 AND user_id = $2 AND status = 'pending'`,
    [orderId, req.user.id]
  );
  if (!orderRows[0]) {
    return res.status(404).json({ success: false, message: '유효하지 않은 주문입니다.' });
  }

  const order = orderRows[0];

  // 금액 위변조 검증 — 프론트 전송값이 아닌 DB 기준으로 검증
  if (order.amount_krw !== Number(amount)) {
    return res.status(400).json({ success: false, message: '결제 금액이 일치하지 않습니다.' });
  }

  const client = await pool.connect();
  try {
    // 토스페이먼츠 결제 승인 API 호출
    const tossData = await tossRequest('/payments/confirm', {
      paymentKey,
      orderId,
      amount: Number(amount),
    });

    await client.query('BEGIN');

    // payment_history 성공 처리
    await client.query(
      `UPDATE payment_history
       SET status = 'success', toss_payment_key = $1, payment_method = $2, updated_at = NOW()
       WHERE toss_order_id = $3`,
      [tossData.paymentKey, tossData.method, orderId]
    );

    // 토큰 충전 + 첫 충전 보너스 플래그 — 트랜잭션으로 race condition 방지
    const { rows: updatedUser } = await client.query(
      `UPDATE users
       SET token_balance = token_balance + $1,
           has_used_first_charge_bonus = true
       WHERE id = $2
       RETURNING token_balance`,
      [order.tokens_added, req.user.id]
    );

    await client.query('COMMIT');

    res.json({
      success: true,
      data: {
        addedTokens: order.tokens_added,
        newBalance: updatedUser[0].token_balance,
        packageType: order.package_type,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    // 토스 API 실패 → payment_history 'failed' 처리
    await pool.query(
      `UPDATE payment_history SET status = 'failed', updated_at = NOW() WHERE toss_order_id = $1`,
      [orderId]
    ).catch(() => {});
    console.error('billing/confirm 오류:', err.message);
    res.status(err.httpStatus || 500).json({
      success: false,
      message: err.message || '결제 승인 중 오류가 발생했습니다.',
    });
  } finally {
    client.release();
  }
});

/**
 * POST /api/billing/webhook
 * 토스페이먼츠 Webhook — confirm API 실패 시 이중 안전장치
 * 검증: paymentKey로 토스 API 재조회해 실제 결제 정보 확인 (시크릿 키 없는 방식)
 * 인증 없음 (토스에서 직접 호출)
 */
router.post('/webhook', async (req, res) => {
  // 토스에 즉시 200 응답 (처리는 비동기로 — 재전송 방지)
  res.status(200).json({ received: true });

  try {
    const { eventType, data } = req.body || {};
    const paymentKey = data?.paymentKey;
    const orderId = data?.orderId;

    if (!paymentKey || !orderId) return;

    // paymentKey로 토스 API 재조회 — Webhook 진위 검증
    const verified = await tossGet(`/payments/${paymentKey}`);

    // 재조회한 orderId가 Webhook의 orderId와 일치하지 않으면 위조 가능성
    if (verified.orderId !== orderId) {
      console.warn('billing/webhook: orderId 불일치, 무시');
      return;
    }

    if (eventType === 'PAYMENT_STATUS_CHANGED' && verified.status === 'DONE') {
      // confirm이 이미 처리했을 수 있으므로 pending인 경우만 처리
      const { rows: orderRows } = await pool.query(
        `SELECT * FROM payment_history WHERE toss_order_id = $1 AND status = 'pending'`,
        [orderId]
      );
      if (!orderRows[0]) return; // 이미 confirm으로 처리됨

      const order = orderRows[0];
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `UPDATE payment_history
           SET status = 'success', toss_payment_key = $1, payment_method = $2, updated_at = NOW()
           WHERE toss_order_id = $3`,
          [verified.paymentKey, verified.method, orderId]
        );
        await client.query(
          `UPDATE users
           SET token_balance = token_balance + $1, has_used_first_charge_bonus = true
           WHERE id = $2`,
          [order.tokens_added, order.user_id]
        );
        await client.query('COMMIT');
        console.log(`billing/webhook: ${orderId} 결제 처리 완료 (${order.tokens_added}토큰)`);
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (eventType === 'CANCEL_STATUS_CHANGED' && verified.status === 'CANCELED') {
      // 토스 측에서 취소된 경우 DB 동기화 (refund API가 이미 처리했을 수 있음)
      await pool.query(
        `UPDATE payment_history
         SET status = 'refunded', updated_at = NOW()
         WHERE toss_payment_key = $1 AND status NOT IN ('refunded', 'failed')`,
        [paymentKey]
      );
    }
  } catch (err) {
    console.error('billing/webhook 처리 오류:', err.message);
  }
});

/**
 * GET /api/billing/history
 * 내 결제 이력 (최근 50건)
 */
router.get('/history', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, package_type, amount_krw, tokens_added, bonus_tokens,
              payment_method, status, refund_amount_krw, created_at
       FROM payment_history
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/billing/history/:id
 * 단건 결제 상세
 */
router.get('/history/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM payment_history WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: '결제 내역을 찾을 수 없습니다.' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/billing/refund/:paymentId
 * 환불 처리 (관리자 전용 — ADMIN_USER_ID 환경변수 일치 필요)
 * body: { reason?: string }
 */
router.post('/refund/:paymentId', auth, async (req, res) => {
  // 관리자 확인
  const adminId = process.env.ADMIN_USER_ID ? Number(process.env.ADMIN_USER_ID) : null;
  if (!adminId || req.user.id !== adminId) {
    return res.status(403).json({ success: false, message: '관리자 권한이 필요합니다.' });
  }

  const { reason = '관리자 환불 처리' } = req.body;

  try {
    const { rows } = await pool.query(
      `SELECT * FROM payment_history WHERE id = $1 AND status = 'success'`,
      [req.params.paymentId]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: '환불 가능한 결제를 찾을 수 없습니다.' });
    }

    const payment = rows[0];

    // 충전 이후 사용된 토큰 합계
    const { rows: usageRows } = await pool.query(
      `SELECT COALESCE(SUM(tokens_used), 0)::int AS used
       FROM token_usage_log
       WHERE user_id = $1 AND created_at >= $2`,
      [payment.user_id, payment.created_at]
    );
    const tokensUsed = usageRows[0].used;
    const tokensUnused = Math.max(0, payment.tokens_added - tokensUsed);
    const refundRatio = payment.tokens_added > 0 ? tokensUnused / payment.tokens_added : 0;
    const refundAmount = Math.floor(payment.amount_krw * refundRatio);

    // 토스페이먼츠 환불 API 호출
    await tossRequest(`/payments/${payment.toss_payment_key}/cancel`, {
      cancelReason: reason,
      cancelAmount: refundAmount,
    });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 미사용 토큰 차감
      await client.query(
        'UPDATE users SET token_balance = GREATEST(0, token_balance - $1) WHERE id = $2',
        [tokensUnused, payment.user_id]
      );

      // 결제 상태 업데이트
      await client.query(
        `UPDATE payment_history
         SET status = 'refunded', refunded_at = NOW(),
             refund_amount_krw = $1, refund_reason = $2, updated_at = NOW()
         WHERE id = $3`,
        [refundAmount, reason, payment.id]
      );

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    res.json({
      success: true,
      data: { refundAmount, tokensUnused, tokensUsed },
    });
  } catch (err) {
    console.error('billing/refund 오류:', err.message);
    res.status(err.httpStatus || 500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/billing/google/verify
 * Google Play 인앱결제 purchaseToken 검증 → 토큰 충전
 * body: { productId, purchaseToken }
 * 반환: { addedTokens, newBalance }
 */
router.post('/google/verify', auth, async (req, res) => {
  const { productId, purchaseToken } = req.body;
  const packageType = GOOGLE_PRODUCT_TO_PACKAGE[productId];
  const pkg = PACKAGES[packageType];

  if (!pkg || !purchaseToken) {
    return res.status(400).json({ success: false, message: '유효하지 않은 상품 또는 구매 정보입니다.' });
  }

  try {
    // 중복 검증 — 동일 purchaseToken이 이미 처리됐다면 거부 (UNIQUE 제약과 이중 방어)
    const { rows: dup } = await pool.query(
      'SELECT id FROM payment_history WHERE google_purchase_token = $1',
      [purchaseToken]
    );
    if (dup[0]) {
      return res.status(409).json({ success: false, message: '이미 처리된 구매입니다.' });
    }

    // Google Play Developer API로 실제 구매 상태 확인 (클라이언트 값을 신뢰하지 않음)
    const purchase = await fetchGooglePurchase(productId, purchaseToken);
    if (purchase.purchaseState !== 0) {
      return res.status(400).json({ success: false, message: '완료되지 않은 구매입니다.' });
    }

    // 첫 충전 보너스 여부 확인
    const { rows: userRows } = await pool.query(
      'SELECT has_used_first_charge_bonus FROM users WHERE id = $1',
      [req.user.id]
    );
    const isFirstCharge = !userRows[0]?.has_used_first_charge_bonus;
    const firstBonus = isFirstCharge ? Math.floor(pkg.base_tokens * FIRST_CHARGE_BONUS_RATE) : 0;
    const totalTokens = pkg.base_tokens + pkg.bonus_tokens + firstBonus;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO payment_history
           (user_id, amount_krw, tokens_added, base_tokens, bonus_tokens, package_type,
            status, provider, google_purchase_token, google_order_id)
         VALUES ($1, $2, $3, $4, $5, $6, 'success', 'google', $7, $8)`,
        [req.user.id, pkg.amount, totalTokens, pkg.base_tokens, pkg.bonus_tokens + firstBonus,
         packageType, purchaseToken, purchase.orderId || null]
      );

      const { rows: updatedUser } = await client.query(
        `UPDATE users
         SET token_balance = token_balance + $1,
             has_used_first_charge_bonus = true
         WHERE id = $2
         RETURNING token_balance`,
        [totalTokens, req.user.id]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        data: { addedTokens: totalTokens, newBalance: updatedUser[0].token_balance },
      });
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') {
        // 동시 요청 등으로 UNIQUE 제약에 걸린 경우 — 중복 처리로 응답
        return res.status(409).json({ success: false, message: '이미 처리된 구매입니다.' });
      }
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('billing/google/verify 오류:', err.message);
    res.status(500).json({
      success: false,
      message: err.message || '구매 검증 중 오류가 발생했습니다.',
    });
  }
});

module.exports = router;
