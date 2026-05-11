/**
 * @file profile.js
 * 공개 프로필 API 라우터 (Phase 4.1)
 * GET  /api/profile/:username  — 공개 프로필 조회 (비로그인 가능)
 * GET  /api/profile/:username/media — 공개 작품 목록 (4.2에서 is_public 필터 추가)
 * PATCH /api/me/profile         — 본인 프로필 수정
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

/**
 * GET /api/profile/:username
 * 공개 프로필 조회 — 비로그인 상태에서도 접근 가능
 * is_profile_public=false면 기본 정보만 반환
 */
router.get('/:username', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, username, bio, avatar_url, is_profile_public, created_at
       FROM users WHERE username = $1`,
      [req.params.username]
    );
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
    }

    const user = rows[0];

    // 통계: 전체 작품 수, 별점 평균 (공개 프로필이어야 노출)
    let stats = null;
    if (user.is_profile_public) {
      const { rows: statRows } = await pool.query(
        `SELECT
           COUNT(*)::int                                           AS total_count,
           ROUND(AVG(NULLIF(rating, 0))::numeric, 1)::float       AS avg_rating,
           COUNT(*) FILTER (WHERE rating > 0 OR review_text <> '') AS reviewed_count
         FROM user_media WHERE user_id = $1`,
        [user.id]
      );

      // 취향 프로필에서 상위 장르 추출
      const { rows: profileRows } = await pool.query(
        'SELECT genres FROM user_taste_profile WHERE user_id = $1',
        [user.id]
      );
      const genres = profileRows[0]?.genres || {};
      const topGenres = Object.entries(genres)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 3)
        .map(([g]) => g);

      stats = { ...statRows[0], top_genres: topGenres };
    }

    res.json({
      success: true,
      data: {
        username: user.username,
        name: user.name,
        bio: user.bio || '',
        avatar_url: user.avatar_url || '',
        is_profile_public: user.is_profile_public,
        joined_at: user.created_at,
        stats,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/profile/:username/media
 * 공개 작품 목록 — is_public=true 항목만 (Phase 4.2에서 활성화)
 */
router.get('/:username/media', async (req, res) => {
  try {
    const { rows: userRows } = await pool.query(
      'SELECT id, is_profile_public FROM users WHERE username = $1',
      [req.params.username]
    );
    if (!userRows[0] || !userRows[0].is_profile_public) {
      return res.json({ success: true, data: [] });
    }

    const { rows } = await pool.query(
      `SELECT id, type, title, year, director, poster_url, rating, review_text, review_date
       FROM user_media
       WHERE user_id = $1 AND is_public = true
       ORDER BY type, year ASC`,
      [userRows[0].id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
