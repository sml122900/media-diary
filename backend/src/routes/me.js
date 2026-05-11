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

module.exports = router;
