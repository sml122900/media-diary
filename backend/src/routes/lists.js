/**
 * @file lists.js
 * 베스트 리스트 API (Phase 4.3)
 * 내 인생 영화 10편, 2025년 베스트 등 큐레이션 리스트 관리
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// ── 내 리스트 ───────────────────────────────────────────────────────────────

/** GET /api/lists — 내 리스트 목록 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT l.*, COUNT(li.id)::int AS item_count
       FROM lists l
       LEFT JOIN list_items li ON li.list_id = l.id
       WHERE l.user_id = $1
       GROUP BY l.id
       ORDER BY l.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/lists — 리스트 생성 */
router.post('/', auth, async (req, res) => {
  const { title, description, is_public } = req.body;
  if (!title?.trim()) {
    return res.status(400).json({ success: false, message: '리스트 제목을 입력해주세요' });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO lists (user_id, title, description, is_public)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.user.id, title.trim(), description || '', is_public || false]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/lists/:id — 리스트 상세 (항목 포함) */
router.get('/:id', auth, async (req, res) => {
  try {
    const { rows: listRows } = await pool.query(
      'SELECT * FROM lists WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!listRows[0]) return res.status(404).json({ success: false, message: '리스트를 찾을 수 없습니다' });

    const { rows: items } = await pool.query(
      `SELECT li.*, um.title, um.year, um.type, um.poster_url, um.rating, um.director
       FROM list_items li
       JOIN user_media um ON um.id = li.media_id
       WHERE li.list_id = $1
       ORDER BY li.position ASC`,
      [req.params.id]
    );
    res.json({ success: true, data: { ...listRows[0], items } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /api/lists/:id — 리스트 수정 (제목/설명/공개) */
router.patch('/:id', auth, async (req, res) => {
  const { title, description, is_public } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE lists SET
         title       = COALESCE($1, title),
         description = COALESCE($2, description),
         is_public   = COALESCE($3, is_public)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [title || null, description ?? null, is_public ?? null, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '리스트를 찾을 수 없습니다' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/lists/:id — 리스트 삭제 */
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query('DELETE FROM lists WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 리스트 항목 ─────────────────────────────────────────────────────────────

/** POST /api/lists/:id/items — 항목 추가 */
router.post('/:id/items', auth, async (req, res) => {
  const { media_id, comment } = req.body;
  if (!media_id) return res.status(400).json({ success: false, message: 'media_id가 필요합니다' });

  try {
    // 내 리스트인지 확인
    const { rows: listRows } = await pool.query(
      'SELECT id FROM lists WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!listRows[0]) return res.status(404).json({ success: false, message: '리스트를 찾을 수 없습니다' });

    // 중복 확인
    const { rows: dup } = await pool.query(
      'SELECT id FROM list_items WHERE list_id = $1 AND media_id = $2',
      [req.params.id, media_id]
    );
    if (dup.length > 0) return res.status(409).json({ success: false, message: '이미 리스트에 있는 작품입니다' });

    // position: 현재 최대 + 1
    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(position), 0) AS max FROM list_items WHERE list_id = $1',
      [req.params.id]
    );
    const position = maxRows[0].max + 1;

    const { rows } = await pool.query(
      `INSERT INTO list_items (list_id, media_id, position, comment)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.id, media_id, position, comment || '']
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/lists/:id/items/:itemId — 항목 제거 */
router.delete('/:id/items/:itemId', auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM list_items WHERE id = $1
       AND list_id IN (SELECT id FROM lists WHERE id = $2 AND user_id = $3)`,
      [req.params.itemId, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /api/lists/:id/items/:itemId — 코멘트/순서 수정 */
router.patch('/:id/items/:itemId', auth, async (req, res) => {
  const { comment, position } = req.body;
  try {
    const { rows } = await pool.query(
      `UPDATE list_items SET
         comment  = COALESCE($1, comment),
         position = COALESCE($2, position)
       WHERE id = $3
         AND list_id IN (SELECT id FROM lists WHERE id = $4 AND user_id = $5)
       RETURNING *`,
      [comment ?? null, position ?? null, req.params.itemId, req.params.id, req.user.id]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 공개 리스트 조회 ─────────────────────────────────────────────────────────

/** GET /api/lists/public/:username — 특정 유저의 공개 리스트 */
router.get('/public/:username', async (req, res) => {
  try {
    const { rows: userRows } = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND is_profile_public = true',
      [req.params.username]
    );
    if (!userRows[0]) return res.json({ success: true, data: [] });

    const { rows } = await pool.query(
      `SELECT l.*, COUNT(li.id)::int AS item_count
       FROM lists l
       LEFT JOIN list_items li ON li.list_id = l.id
       WHERE l.user_id = $1 AND l.is_public = true
       GROUP BY l.id ORDER BY l.created_at DESC`,
      [userRows[0].id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
