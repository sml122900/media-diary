/**
 * @file wishlist.js
 * 개인 위시리스트 API (Phase 5.2)
 * "나중에 보기" 목록 — TMDB 기반 미시청 작품 관리
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

/** GET /api/wishlist — 내 위시리스트 조회 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM wishlist WHERE user_id = $1 ORDER BY priority DESC, created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/wishlist — 작품 추가 */
router.post('/', auth, async (req, res) => {
  const { type, title, year, tmdb_id, poster_url, priority, intended_platform, note } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, message: '제목을 입력해주세요' });

  try {
    const { rows } = await pool.query(
      `INSERT INTO wishlist (user_id, type, title, year, tmdb_id, poster_url, priority, intended_platform, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (user_id, tmdb_id, type) DO NOTHING RETURNING *`,
      [req.user.id, type || 'movie', title.trim(), year || 0,
       tmdb_id || 0, poster_url || '', priority || 0,
       intended_platform || '', note || '']
    );
    if (!rows[0]) return res.json({ success: false, message: '이미 위시리스트에 있습니다' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /api/wishlist/:id — 우선순위·메모 수정 */
router.patch('/:id', auth, async (req, res) => {
  const { priority, intended_platform, note } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE wishlist SET
         priority = COALESCE($1, priority),
         intended_platform = COALESCE($2, intended_platform),
         note = COALESCE($3, note)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [priority, intended_platform, note, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/wishlist/:id — 위시리스트에서 제거 */
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM wishlist WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/wishlist/:id/watched — 시청 완료 처리
 * 위시리스트 → user_media 이동 (별점과 함께)
 */
router.post('/:id/watched', auth, async (req, res) => {
  const { rating, review_text } = req.body;
  try {
    // 위시리스트 항목 조회
    const { rows: wRows } = await pool.query(
      'SELECT * FROM wishlist WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!wRows[0]) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    const w = wRows[0];

    // user_media에 삽입 (rewatch_count=1 기준, 이미 있으면 업데이트)
    const { rows: mRows } = await pool.query(
      `INSERT INTO user_media
         (user_id, type, title, year, tmdb_id, poster_url, rating, review_text, watched_at, rewatch_count)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW(),1)
       ON CONFLICT (user_id, title, year, rewatch_count) DO UPDATE
         SET rating = EXCLUDED.rating,
             review_text = EXCLUDED.review_text,
             watched_at = NOW(),
             poster_url = EXCLUDED.poster_url
       RETURNING *`,
      [req.user.id, w.type, w.title, w.year, w.tmdb_id, w.poster_url,
       rating || 0, review_text || '']
    );

    // 위시리스트에서 제거
    await pool.query('DELETE FROM wishlist WHERE id = $1', [req.params.id]);

    res.json({ success: true, data: mRows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
