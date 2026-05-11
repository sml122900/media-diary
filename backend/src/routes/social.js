/**
 * @file social.js
 * 친구(팔로우) 시스템 API (Phase 4.4)
 * 팔로우/언팔로우, 사용자 검색, 활동 피드
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// ── 팔로우 ───────────────────────────────────────────────────────────────────

/** POST /api/follow/:userId — 팔로우 */
router.post('/follow/:userId', auth, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  if (targetId === req.user.id) {
    return res.status(400).json({ success: false, message: '자기 자신을 팔로우할 수 없습니다' });
  }
  try {
    await pool.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.user.id, targetId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/follow/:userId — 언팔로우 */
router.delete('/follow/:userId', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM follows WHERE follower_id = $1 AND following_id = $2',
      [req.user.id, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/me/following — 내가 팔로우하는 목록 */
router.get('/me/following', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar_url, u.is_profile_public
       FROM follows f JOIN users u ON u.id = f.following_id
       WHERE f.follower_id = $1 ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/me/followers — 나를 팔로우하는 목록 */
router.get('/me/followers', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT u.id, u.name, u.username, u.avatar_url, u.is_profile_public
       FROM follows f JOIN users u ON u.id = f.follower_id
       WHERE f.following_id = $1 ORDER BY f.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 사용자 검색 ──────────────────────────────────────────────────────────────

/** GET /api/search/users?q= — username 또는 name으로 검색 */
router.get('/search/users', auth, async (req, res) => {
  const q = req.query.q?.trim();
  if (!q) return res.json({ success: true, data: [] });

  try {
    // 검색 결과 + 팔로우 여부
    const { rows } = await pool.query(
      `SELECT
         u.id, u.name, u.username, u.avatar_url, u.is_profile_public,
         EXISTS(
           SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = u.id
         ) AS is_following
       FROM users u
       WHERE (u.username ILIKE $2 OR u.name ILIKE $2)
         AND u.id <> $1
       LIMIT 20`,
      [req.user.id, `%${q}%`]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 활동 피드 ────────────────────────────────────────────────────────────────

/**
 * GET /api/feed?page=1 — 팔로잉한 사용자들의 최근 감상 기록
 * watched_at 있는 항목만, 시간순 정렬, 20개씩 페이지네이션
 */
router.get('/feed', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const { rows } = await pool.query(
      `SELECT
         um.id, um.type, um.title, um.year, um.poster_url,
         um.rating, um.review_text, um.review_date, um.watched_at,
         u.name, u.username, u.avatar_url
       FROM user_media um
       JOIN users u ON u.id = um.user_id
       JOIN follows f ON f.following_id = um.user_id
       WHERE f.follower_id = $1
         AND um.watched_at IS NOT NULL
         AND um.is_public = true
         AND u.is_profile_public = true
       ORDER BY um.watched_at DESC
       LIMIT $2 OFFSET $3`,
      [req.user.id, limit, offset]
    );
    res.json({ success: true, data: rows, page, has_more: rows.length === limit });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 공통 작품 비교 (Phase 4.5) ───────────────────────────────────────────────

/**
 * GET /api/compare/:userId — 두 사용자 공통 작품 + 별점 비교
 */
router.get('/compare/:userId', auth, async (req, res) => {
  const targetId = parseInt(req.params.userId);
  try {
    // 대상 유저 확인
    const { rows: targetRows } = await pool.query(
      'SELECT id, name, username, avatar_url FROM users WHERE id = $1 AND is_profile_public = true',
      [targetId]
    );
    if (!targetRows[0]) {
      return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });
    }

    // 공통 tmdb_id 기준으로 두 사용자의 감상 정보 조합
    const { rows } = await pool.query(
      `SELECT
         a.title, a.year, a.type, a.poster_url, a.tmdb_id,
         a.rating AS my_rating, a.review_text AS my_review,
         b.rating AS their_rating, b.review_text AS their_review,
         ABS(a.rating - b.rating) AS rating_diff
       FROM user_media a
       JOIN user_media b ON b.tmdb_id = a.tmdb_id AND b.user_id = $2
       WHERE a.user_id = $1
         AND a.tmdb_id > 0
         AND a.rating > 0
         AND b.rating > 0
       ORDER BY rating_diff DESC, a.rating DESC
       LIMIT 30`,
      [req.user.id, targetId]
    );

    res.json({ success: true, data: { target: targetRows[0], items: rows } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 작품별 친구 활동 (Phase 4.6) ─────────────────────────────────────────────

/**
 * GET /api/media/:tmdbId/friends-activity — 팔로잉 중 이 작품을 본 사람들
 */
router.get('/media/:tmdbId/friends-activity', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         u.name, u.username, u.avatar_url,
         um.rating, um.review_text, um.is_public
       FROM user_media um
       JOIN users u ON u.id = um.user_id
       JOIN follows f ON f.following_id = um.user_id
       WHERE f.follower_id = $1
         AND um.tmdb_id = $2
         AND u.is_profile_public = true
       ORDER BY um.rating DESC`,
      [req.user.id, req.params.tmdbId]
    );
    const avgRating = rows.filter(r => r.rating > 0).length
      ? (rows.filter(r => r.rating > 0).reduce((s, r) => s + r.rating, 0) /
         rows.filter(r => r.rating > 0).length).toFixed(1)
      : null;
    res.json({ success: true, data: { friends: rows, avg_rating: avgRating, count: rows.length } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
