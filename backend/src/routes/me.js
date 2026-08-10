/**
 * @file me.js
 * 인증된 사용자 관련 API 라우터 (/api/me/*)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { calculateTasteProfile, updateTasteProfile } = require('../services/tasteProfile');
const wishlistRouter = require('./wishlist');

// 개인 위시리스트를 /api/me/watchlist 경로로 마운트 (Phase 5.2)
router.use('/watchlist', wishlistRouter);

/**
 * GET /api/me/taste-profile
 * 내 취향 프로필 조회
 * 저장된 프로필이 없으면 즉시 계산 후 반환
 */
router.get('/taste-profile', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT * FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );

    if (rows[0]) {
      return res.json({ success: true, data: rows[0] });
    }

    // 저장된 프로필 없으면 실시간 계산 후 저장
    await updateTasteProfile(req.user.id);
    const { rows: fresh } = await pool.query(
      'SELECT * FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: fresh[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/me/profile
 * 본인 프로필 수정 (username, bio, avatar_url, is_profile_public)
 */
router.patch('/profile', auth, async (req, res) => {
  const { username, bio, avatar_url, is_profile_public } = req.body;

  // username 유효성: 3-20자, 영소문자·숫자·언더스코어
  if (username !== undefined) {
    const valid = /^[a-z0-9][a-z0-9_]{1,18}[a-z0-9]$/.test(username) ||
                  /^[a-z0-9]{3,20}$/.test(username);
    if (!valid) {
      return res.status(400).json({
        success: false,
        message: 'username은 3-20자 영소문자·숫자·언더스코어만 허용합니다',
      });
    }
    // 중복 확인 (본인 제외)
    const { rows: dup } = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id <> $2',
      [username, req.user.id]
    );
    if (dup.length > 0) {
      return res.status(409).json({ success: false, message: '이미 사용 중인 username입니다' });
    }
  }

  try {
    const { rows } = await pool.query(
      `UPDATE users SET
         username          = COALESCE($1, username),
         bio               = COALESCE($2, bio),
         avatar_url        = COALESCE($3, avatar_url),
         is_profile_public = COALESCE($4, is_profile_public)
       WHERE id = $5
       RETURNING id, name, email, username, bio, avatar_url, is_profile_public`,
      [username ?? null, bio ?? null, avatar_url ?? null, is_profile_public ?? null, req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/me/info
 * 내 프로필 정보 조회 (username 포함)
 */
router.get('/info', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, username, bio, avatar_url, is_profile_public FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 타입별 런타임 추정 (runtime_minutes 없을 때)
const RUNTIME_EST = { movie: 110, drama: 60, anime: 24 };

/**
 * GET /api/me/watch-stats?period=year|month|all
 * 시청 시간 합산 통계 (Phase 5.3)
 */
router.get('/watch-stats', auth, async (req, res) => {
  const { period = 'all' } = req.query;

  const now = new Date();
  let dateFilter = '';
  const params = [req.user.id];

  if (period === 'year') {
    dateFilter = `AND watched_at >= '${now.getFullYear()}-01-01'`;
  } else if (period === 'month') {
    dateFilter = `AND watched_at >= '${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01'`;
  }

  try {
    const { rows: items } = await pool.query(
      `SELECT type, title, runtime_minutes FROM user_media
       WHERE user_id = $1 AND watched_at IS NOT NULL ${dateFilter}`,
      params
    );

    if (items.length === 0) {
      return res.json({ success: true, data: null });
    }

    // 타입별 합산
    const byType = { movie: 0, drama: 0, anime: 0 };
    let totalMinutes = 0;
    items.forEach(i => {
      const mins = i.runtime_minutes || RUNTIME_EST[i.type] || 90;
      byType[i.type] = (byType[i.type] || 0) + mins;
      totalMinutes += mins;
    });

    // 가장 긴/짧은 작품 TOP 3 (runtime_minutes 있는 것만)
    const withRuntime = items.filter(i => i.runtime_minutes > 0)
      .sort((a, b) => b.runtime_minutes - a.runtime_minutes);
    const longest3  = withRuntime.slice(0, 3).map(i => ({ title: i.title, runtime: i.runtime_minutes }));
    const shortest3 = [...withRuntime].sort((a, b) => a.runtime_minutes - b.runtime_minutes).slice(0, 3).map(i => ({ title: i.title, runtime: i.runtime_minutes }));

    res.json({
      success: true,
      data: {
        total_minutes: totalMinutes,
        total_hours: Math.round(totalMinutes / 60 * 10) / 10,
        total_count: items.length,
        avg_minutes: Math.round(totalMinutes / items.length),
        by_type: byType,
        longest3, shortest3,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/me/life-periods
 * 시청 시기(life_period)별 작품 그룹 조회 (Phase 6.5.1)
 */
router.get('/life-periods', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT life_period, COUNT(*) AS count,
              json_agg(json_build_object(
                'id', id, 'title', title, 'year', year,
                'type', type, 'poster_url', poster_url, 'rating', rating
              ) ORDER BY watched_at DESC NULLS LAST) AS works
       FROM user_media
       WHERE user_id = $1
         AND life_period IS NOT NULL
         AND life_period <> ''
       GROUP BY life_period
       ORDER BY MAX(created_at) DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/me/tokens
 * 토큰 잔액 + 오늘/이번 달 사용량 조회
 */
router.get('/tokens', auth, async (req, res) => {
  try {
    // 잔액 + 첫 충전 보너스 여부
    const { rows: userRows } = await pool.query(
      'SELECT token_balance, has_used_first_charge_bonus FROM users WHERE id = $1',
      [req.user.id]
    );

    // 오늘 기능별 사용량
    const { rows: todayRows } = await pool.query(
      `SELECT feature, SUM(tokens_used)::int AS tokens
       FROM token_usage_log
       WHERE user_id = $1
         AND created_at >= CURRENT_DATE
       GROUP BY feature`,
      [req.user.id]
    );

    // 이번 달 합계
    const { rows: monthRows } = await pool.query(
      `SELECT
         SUM(tokens_used)::int AS total_tokens,
         ROUND(SUM(tokens_used) * 10)::int AS cost_estimate_krw
       FROM token_usage_log
       WHERE user_id = $1
         AND created_at >= DATE_TRUNC('month', NOW())`,
      [req.user.id]
    );

    const todayUsage = {};
    for (const row of todayRows) {
      todayUsage[row.feature] = row.tokens;
    }

    res.json({
      success: true,
      data: {
        balance: userRows[0]?.token_balance ?? 0,
        has_used_first_charge_bonus: userRows[0]?.has_used_first_charge_bonus ?? false,
        today_usage: todayUsage,
        month_usage: {
          total_tokens: monthRows[0]?.total_tokens ?? 0,
          cost_estimate_krw: monthRows[0]?.cost_estimate_krw ?? 0,
        },
        // 임포트 무료화 플래그 (Phase 12.3) — 프론트 토큰 고지 문구 분기용
        import_free: process.env.IMPORT_TOKEN_FREE !== 'false',
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/me/usage-stats
 * 토큰 누적 충전/사용량, 기능별 사용, 월별 추이 (최근 6개월)
 */
router.get('/usage-stats', auth, async (req, res) => {
  try {
    const uid = req.user.id;

    // 현재 잔액
    const { rows: userRows } = await pool.query(
      'SELECT token_balance FROM users WHERE id = $1', [uid]
    );

    // 전체 충전 합계 (성공한 결제만)
    const { rows: chargedRows } = await pool.query(
      `SELECT COALESCE(SUM(tokens_added), 0)::int AS total
       FROM payment_history WHERE user_id = $1 AND status = 'success'`,
      [uid]
    );

    // 전체 사용 합계
    const { rows: usedRows } = await pool.query(
      `SELECT COALESCE(SUM(tokens_used), 0)::int AS total
       FROM token_usage_log WHERE user_id = $1`,
      [uid]
    );

    // 기능별 사용량
    const { rows: byFeatureRows } = await pool.query(
      `SELECT feature, SUM(tokens_used)::int AS tokens
       FROM token_usage_log WHERE user_id = $1
       GROUP BY feature`,
      [uid]
    );

    // 월별 사용량 (최근 6개월)
    const { rows: monthlyRows } = await pool.query(
      `SELECT
         TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
         SUM(tokens_used)::int AS tokens_used,
         ROUND(SUM(tokens_used) * 10)::int AS cost_estimate_krw
       FROM token_usage_log
       WHERE user_id = $1
         AND created_at >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', created_at)
       ORDER BY month ASC`,
      [uid]
    );

    const byFeature = {};
    for (const row of byFeatureRows) {
      byFeature[row.feature] = row.tokens;
    }

    res.json({
      success: true,
      data: {
        current_balance: userRows[0]?.token_balance ?? 0,
        total_charged: chargedRows[0].total,
        total_used: usedRows[0].total,
        by_feature: byFeature,
        monthly_breakdown: monthlyRows,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
