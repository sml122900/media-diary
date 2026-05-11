/**
 * @file watchlists.js
 * 공유 워치리스트 API (Phase 4.7)
 * 친구와 함께 볼 영화를 공유하고 시청 여부를 추적
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// ── 워치리스트 목록 ───────────────────────────────────────────────────────────

/** GET /api/watchlists — 내가 참여한 워치리스트 목록 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         wl.id, wl.title, wl.creator_id, wl.created_at,
         wm.role,
         u.name AS creator_name, u.username AS creator_username,
         COUNT(DISTINCT wi.id)::int AS item_count,
         COUNT(DISTINCT wm2.user_id)::int AS member_count
       FROM shared_watchlists wl
       JOIN shared_watchlist_members wm ON wm.watchlist_id = wl.id AND wm.user_id = $1
       JOIN users u ON u.id = wl.creator_id
       LEFT JOIN shared_watchlist_items wi ON wi.watchlist_id = wl.id
       LEFT JOIN shared_watchlist_members wm2 ON wm2.watchlist_id = wl.id
       GROUP BY wl.id, wm.role, u.name, u.username
       ORDER BY wl.created_at DESC`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/watchlists — 워치리스트 생성 */
router.post('/', auth, async (req, res) => {
  const { title } = req.body;
  if (!title?.trim()) return res.status(400).json({ success: false, message: '제목을 입력해주세요' });

  try {
    const { rows } = await pool.query(
      'INSERT INTO shared_watchlists (creator_id, title) VALUES ($1, $2) RETURNING *',
      [req.user.id, title.trim()]
    );
    const wlId = rows[0].id;
    // 생성자는 자동으로 creator 멤버
    await pool.query(
      'INSERT INTO shared_watchlist_members (watchlist_id, user_id, role) VALUES ($1, $2, $3)',
      [wlId, req.user.id, 'creator']
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/watchlists/:id — 워치리스트 상세 (멤버+항목) */
router.get('/:id', auth, async (req, res) => {
  try {
    // 내가 참여한 목록인지 확인
    const { rows: memberCheck } = await pool.query(
      'SELECT role FROM shared_watchlist_members WHERE watchlist_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!memberCheck[0]) return res.status(403).json({ success: false, message: '접근 권한이 없습니다' });

    const { rows: wlRows } = await pool.query(
      'SELECT wl.*, u.name AS creator_name FROM shared_watchlists wl JOIN users u ON u.id = wl.creator_id WHERE wl.id = $1',
      [req.params.id]
    );

    const { rows: members } = await pool.query(
      'SELECT wm.user_id, wm.role, u.name, u.username, u.avatar_url FROM shared_watchlist_members wm JOIN users u ON u.id = wm.user_id WHERE wm.watchlist_id = $1',
      [req.params.id]
    );

    const { rows: items } = await pool.query(
      `SELECT
         wi.*,
         um.title, um.year, um.type, um.poster_url, um.rating AS adder_rating,
         u.username AS added_by_username
       FROM shared_watchlist_items wi
       JOIN user_media um ON um.id = wi.media_id
       JOIN users u ON u.id = wi.added_by
       WHERE wi.watchlist_id = $1
       ORDER BY wi.id ASC`,
      [req.params.id]
    );

    res.json({ success: true, data: { ...wlRows[0], members, items, my_role: memberCheck[0].role } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/watchlists/:id — 워치리스트 삭제 (creator만) */
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM shared_watchlists WHERE id = $1 AND creator_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!result.rows[0]) return res.status(403).json({ success: false, message: '권한이 없습니다' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 멤버 관리 ─────────────────────────────────────────────────────────────────

/** POST /api/watchlists/:id/invite — 친구 초대 (username으로) */
router.post('/:id/invite', auth, async (req, res) => {
  const { username } = req.body;
  try {
    // creator인지 확인
    const { rows: cRow } = await pool.query(
      'SELECT role FROM shared_watchlist_members WHERE watchlist_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (cRow[0]?.role !== 'creator') return res.status(403).json({ success: false, message: '생성자만 초대할 수 있습니다' });

    const { rows: uRows } = await pool.query('SELECT id FROM users WHERE username = $1', [username]);
    if (!uRows[0]) return res.status(404).json({ success: false, message: '사용자를 찾을 수 없습니다' });

    await pool.query(
      'INSERT INTO shared_watchlist_members (watchlist_id, user_id, role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
      [req.params.id, uRows[0].id, 'member']
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/watchlists/:id/leave — 워치리스트 나가기 */
router.delete('/:id/leave', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM shared_watchlist_members WHERE watchlist_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── 항목 관리 ─────────────────────────────────────────────────────────────────

/** POST /api/watchlists/:id/items — 항목 추가 */
router.post('/:id/items', auth, async (req, res) => {
  const { media_id } = req.body;
  try {
    // 멤버인지 확인
    const { rows: mRow } = await pool.query(
      'SELECT 1 FROM shared_watchlist_members WHERE watchlist_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!mRow[0]) return res.status(403).json({ success: false, message: '참여 중인 워치리스트가 아닙니다' });

    const { rows } = await pool.query(
      `INSERT INTO shared_watchlist_items (watchlist_id, media_id, added_by)
       VALUES ($1, $2, $3) ON CONFLICT (watchlist_id, media_id) DO NOTHING RETURNING *`,
      [req.params.id, media_id, req.user.id]
    );
    res.json({ success: true, data: rows[0] || null });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/watchlists/:id/items/:itemId — 항목 제거 (추가한 사람 또는 creator) */
router.delete('/:id/items/:itemId', auth, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM shared_watchlist_items
       WHERE id = $1 AND watchlist_id = $2
         AND (added_by = $3 OR EXISTS(
           SELECT 1 FROM shared_watchlist_members WHERE watchlist_id = $2 AND user_id = $3 AND role = 'creator'
         ))`,
      [req.params.itemId, req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** PATCH /api/watchlists/:id/items/:itemId/watched — 시청 여부 토글 */
router.patch('/:id/items/:itemId/watched', auth, async (req, res) => {
  try {
    // 내가 creator인지 member인지에 따라 해당 컬럼 업데이트
    const { rows: mRow } = await pool.query(
      'SELECT role FROM shared_watchlist_members WHERE watchlist_id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!mRow[0]) return res.status(403).json({ success: false, message: '권한이 없습니다' });

    // 현재 값 조회 후 토글
    const col = mRow[0].role === 'creator' ? 'watched_by_creator' : 'watched_by_member';
    const { rows: cur } = await pool.query(
      `SELECT ${col} FROM shared_watchlist_items WHERE id = $1 AND watchlist_id = $2`,
      [req.params.itemId, req.params.id]
    );
    if (!cur[0]) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });

    const { rows } = await pool.query(
      `UPDATE shared_watchlist_items SET ${col} = $1 WHERE id = $2 RETURNING *`,
      [!cur[0][col], req.params.itemId]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
