/**
 * @file BillingChargePage.jsx
 * 토큰 충전 페이지 — 패키지 선택 → 토스 결제창 호출 (Phase 9.4)
 * 경로: /billing/charge
 */

import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { store, ProductType, Platform } from 'capacitor-plugin-cdv-purchase';
import useAuthStore from '../store/authStore';
import useTokenStore from '../store/tokenStore';
import { createCheckout, verifyGooglePurchase } from '../api/billing';
import { isNativeApp } from '../utils/platform';

// 토스페이먼츠 SDK CDN 동적 로드
function loadTossSDK() {
  if (window.TossPayments) return Promise.resolve(window.TossPayments);
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://js.tosspayments.com/v1/payment';
    script.onload = () => resolve(window.TossPayments);
    script.onerror = () => reject(new Error('토스페이먼츠 SDK 로드 실패'));
    document.head.appendChild(script);
  });
}

const PACKAGES = [
  {
    key: 'small',
    label: '소형',
    amount: 1000,
    tokens: 100,
    bonus: 0,
    badge: null,
  },
  {
    key: 'medium',
    label: '중형',
    amount: 3000,
    tokens: 350,
    bonus: 50,
    badge: '+50 보너스',
  },
  {
    key: 'large',
    label: '대형',
    amount: 10000,
    tokens: 1300,
    bonus: 300,
    badge: '가장 인기',
    highlight: true,
  },
];

export default function BillingChargePage() {
  const navigate = useNavigate();
  const { user, token } = useAuthStore();
  const { balance, isFirstCharge, fetchBalance, setBalance } = useTokenStore();
  const [selected, setSelected] = useState('medium');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [agreed, setAgreed] = useState(false);

  // 결제 직전 화면이라 App 루트 조회와 별개로 한 번 더 최신 잔액을 받는다
  // (다른 기기·탭에서 충전했을 수 있어 여기서만은 최신값이 중요하다)
  useEffect(() => {
    if (token) fetchBalance(token);
  }, [token]);

  // Google Play 인앱결제 상품 등록 + 구매 승인 이벤트 리스너 (네이티브 앱에서만)
  useEffect(() => {
    if (!isNativeApp() || !token) return;

    store.register(
      PACKAGES.map(pkg => ({
        id: `token_${pkg.key}`,
        type: ProductType.CONSUMABLE,
        platform: Platform.GOOGLE_PLAY,
      }))
    );

    // 구매 승인 → 서버 검증 성공 후에만 finish(consume) 호출 (검증 실패 시 재시도 가능하도록 미완료 상태 유지)
    const onApproved = async (transaction) => {
      const productId = transaction.products[0]?.id;
      const purchaseToken = transaction.parentReceipt?.purchaseToken;

      if (!productId || !purchaseToken) {
        setError('구매 정보를 확인할 수 없습니다. 고객센터에 문의해주세요.');
        setLoading(false);
        return;
      }

      let verified;
      try {
        verified = await verifyGooglePurchase(token, { productId, purchaseToken });
      } catch (err) {
        // 이미 처리된 구매(409)라면 토큰은 재지급하지 않되, 기기에 남은 미완료 구매는 정리해
        // consume 실패로 인해 재구매가 막히는 상태(구매 중복 시 재구매 불가)를 방지
        if (err.response?.status === 409) {
          transaction.finish().catch(() => {});
        }
        setError(err.response?.data?.message || '결제 검증에 실패했습니다. 고객센터에 문의해주세요.');
        setLoading(false);
        return;
      }

      // 서버 검증 성공 시점에 토큰은 이미 충전 완료 — finish(consume)가 실패해도
      // 충전 결과는 사용자에게 그대로 반영한다 (finish 실패는 다음 store.initialize()에서
      // 플러그인이 미완료 트랜잭션을 다시 전달해 재시도됨)
      setBalance(verified.data.newBalance);
      setSuccess({ addedTokens: verified.data.addedTokens, newBalance: verified.data.newBalance });
      setLoading(false);

      transaction.finish().catch(err => {
        console.error('[BillingChargePage] transaction.finish 실패 — 다음 실행 시 재시도됨', err);
      });
    };

    store.when().approved(onApproved);
    store.initialize([Platform.GOOGLE_PLAY]);

    return () => store.off(onApproved);
  }, [token]);

  // 플랫폼 분기: 네이티브 앱은 Google Play 인앱결제, 웹은 기존 토스페이먼츠
  const handleCharge = () => {
    if (!selected || loading) return;
    setSuccess(null);
    return isNativeApp() ? handleGooglePlayCharge() : handleTossCharge();
  };

  const handleTossCharge = async () => {
    setLoading(true);
    setError('');

    try {
      // 토스 클라이언트 키 존재 여부 확인 (환경변수 누락 시 SDK 내부에서
      // undefined.startsWith() 오류가 발생하므로 사전에 방어)
      const tossClientKey = import.meta.env.VITE_TOSS_CLIENT_KEY;
      if (!tossClientKey) {
        console.error(
          '[BillingChargePage] VITE_TOSS_CLIENT_KEY 환경변수가 설정되지 않았습니다. ' +
          'frontend/.env (로컬) 또는 배포 환경변수(Vercel)를 확인하세요.'
        );
        setError('결제 시스템 설정 오류입니다. 잠시 후 다시 시도하거나 관리자에게 문의해주세요.');
        setLoading(false);
        return;
      }

      // 1. 서버에 주문 생성
      const res = await createCheckout(token, selected);
      const { orderId, orderName, amount, tokensToAdd, firstBonus } = res.data;

      // 2. 토스 SDK 로드
      const TossPayments = await loadTossSDK();
      const tossPayments = TossPayments(tossClientKey);

      // 3. 결제창 호출 (결제 완료 시 successUrl로 리다이렉트)
      await tossPayments.requestPayment('카드', {
        amount,
        orderId,
        orderName,
        customerName: user?.name || '사용자',
        successUrl: `${window.location.origin}/billing/success`,
        failUrl: `${window.location.origin}/billing/fail`,
      });
    } catch (err) {
      // 사용자가 결제창을 닫은 경우 등
      if (err.code !== 'USER_CANCEL') {
        setError(err.message || '결제 중 오류가 발생했습니다.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Google Play 인앱결제 흐름 — 실제 충전 처리는 위 useEffect의 approved 리스너에서 진행
  const handleGooglePlayCharge = async () => {
    setLoading(true);
    setError('');

    const productId = `token_${selected}`;
    const product = store.get(productId, Platform.GOOGLE_PLAY);
    const offer = product?.getOffer();

    if (!offer) {
      setError('상품 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
      setLoading(false);
      return;
    }

    const orderError = await store.order(offer);
    if (orderError) {
      setError(orderError.message || '결제 요청 중 오류가 발생했습니다.');
      setLoading(false);
    }
    // 정상 흐름은 approved 리스너가 이어받으므로 여기서 loading을 풀지 않음
  };

  return (
    <div className="billing-page">
      <div className="billing-header">
        <button className="btn" onClick={() => navigate(-1)}>← 뒤로</button>
        <h2>토큰 충전</h2>
        {balance !== null && (
          <span className="current-balance">현재 잔액: <strong>{balance}토큰</strong></span>
        )}
      </div>

      {isFirstCharge && (
        <div className="first-charge-banner">
          🎉 첫 충전 보너스 +20% 적용 중! 지금 충전하면 더 받아요.
        </div>
      )}

      <div className="package-grid">
        {PACKAGES.map(pkg => {
          const firstBonus = isFirstCharge ? Math.floor(pkg.tokens * 0.2) : 0;
          const total = pkg.tokens + firstBonus;

          return (
            <div
              key={pkg.key}
              className={`package-card ${pkg.highlight ? 'package-highlight' : ''} ${selected === pkg.key ? 'package-selected' : ''}`}
              onClick={() => setSelected(pkg.key)}
            >
              {pkg.badge && (
                <div className={`package-badge ${pkg.highlight ? 'badge-popular' : 'badge-bonus'}`}>
                  {pkg.badge}
                </div>
              )}
              {isFirstCharge && (
                <div className="package-badge badge-first">첫 충전 +{Math.floor(pkg.tokens * 0.2)}</div>
              )}
              <div className="package-label">{pkg.label}</div>
              <div className="package-price">₩{pkg.amount.toLocaleString()}</div>
              <div className="package-tokens">
                <span className="token-main">{total.toLocaleString()}토큰</span>
                {(pkg.bonus > 0 || firstBonus > 0) && (
                  <span className="token-sub">
                    기본 {pkg.tokens} + 보너스 {pkg.bonus + firstBonus}
                  </span>
                )}
              </div>
              <div className="package-select-indicator">
                {selected === pkg.key ? '✓ 선택됨' : '선택'}
              </div>
            </div>
          );
        })}
      </div>

      {success && (
        <p className="billing-success">
          충전 완료! +{success.addedTokens}토큰 (현재 잔액 {success.newBalance}토큰)
        </p>
      )}
      {error && <p className="billing-error">{error}</p>}

      <div className="billing-actions">
        {/* 약관 동의 체크박스 */}
        <label className="terms-agree">
          <input
            type="checkbox"
            checked={agreed}
            onChange={e => setAgreed(e.target.checked)}
          />
          <span>
            <Link to="/policy/terms" target="_blank" rel="noopener">이용약관</Link>
            {' '}및{' '}
            <Link to="/policy/refund" target="_blank" rel="noopener">환불 정책</Link>
            에 동의합니다 (필수)
          </span>
        </label>

        <button
          className="btn btn-primary btn-charge"
          onClick={handleCharge}
          disabled={loading || !agreed}
          title={!agreed ? '약관에 동의해주세요' : ''}
        >
          {loading ? '처리 중...' : '결제하기'}
        </button>
        <p className="billing-notice">
          결제 후 7일 이내 미사용분은 이메일로 환불 요청 가능합니다.
        </p>
      </div>
    </div>
  );
}
