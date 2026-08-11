/**
 * @file epithets.js
 * 수식어 API (Phase 13.1) — 유저가 직접 만드는 "어떻게 좋았나" 부문 CRUD
 * user_epithets(부문) + user_epithet_items(부문에 부착된 시청 기록) 2테이블
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

const LABEL_MAX_LEN = 20;

/** label 검증 — 트림 후 1~20자, 아니면 null 반환 */
function validateLabel(label) {
  const trimmed = (label || '').trim();
  if (!trimmed || trimmed.length > LABEL_MAX_LEN) return null;
  return trimmed;
}

/**
 * GET /api/epithets
 * 내 수식어 목록 + 각 항목(작품 조인 + rewatch 최대 회차 + 시청 연도 목록) — 1쿼리
 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         e.id, e.label, e.emoji, e.sort_order, e.created_at,
         COALESCE(
           json_agg(
             json_build_object(
               'id', ei.id,
               'user_media_id', um.id,
               'title', um.title,
               'year', um.year,
               'type', um.type,
               'poster_url', um.poster_url,
               'rating', um.rating,
               'rewatch_count', um.rewatch_count,
               'sort_order', ei.sort_order,
               'max_rewatch_count', agg.max_rewatch,
               'watched_years', agg.years
             ) ORDER BY ei.sort_order, ei.id
           ) FILTER (WHERE ei.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM user_epithets e
       LEFT JOIN user_epithet_items ei ON ei.epithet_id = e.id
       LEFT JOIN user_media um ON um.id = ei.user_media_id
       LEFT JOIN LATERAL (
         SELECT
           MAX(um2.rewatch_count) AS max_rewatch,
           array_agg(DISTINCT EXTRACT(YEAR FROM um2.watched_at)::int
                     ORDER BY EXTRACT(YEAR FROM um2.watched_at)::int)
             FILTER (WHERE um2.watched_at IS NOT NULL) AS years
         FROM user_media um2
         WHERE um2.user_id = e.user_id AND um2.title = um.title AND um2.year = um.year
       ) agg ON true
       WHERE e.user_id = $1
       GROUP BY e.id
       ORDER BY e.sort_order, e.id`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/epithets
 * 수식어 생성 — label(1~20자), emoji(옵션)
 * UNIQUE(user_id, label) 위반 시 409 + 기존 id 반환(프론트가 기존 것 선택 처리)
 */
router.post('/', auth, async (req, res) => {
  const label = validateLabel(req.body.label);
  if (!label) {
    return res.status(400).json({ success: false, message: '수식어는 1~20자로 입력해주세요' });
  }
  const emoji = req.body.emoji || null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_epithets (user_id, label, emoji)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, label, emoji]
    );
    res.json({ success: true, data: { ...rows[0], items: [] } });
  } catch (err) {
    if (err.code === '23505') {
      const { rows: existing } = await pool.query(
        'SELECT id FROM user_epithets WHERE user_id = $1 AND label = $2',
        [req.user.id, label]
      );
      return res.status(409).json({
        success: false,
        message: '이미 같은 이름의 수식어가 있습니다',
        data: { id: existing[0]?.id },
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/epithets/:id
 * label/emoji/sort_order 수정
 */
router.patch('/:id', auth, async (req, res) => {
  let label;
  if (req.body.label !== undefined) {
    label = validateLabel(req.body.label);
    if (!label) return res.status(400).json({ success: false, message: '수식어는 1~20자로 입력해주세요' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE user_epithets SET
         label      = COALESCE($1, label),
         emoji      = CASE WHEN $2 THEN $3 ELSE emoji END,
         sort_order = COALESCE($4, sort_order)
       WHERE id = $5 AND user_id = $6
       RETURNING *`,
      [
        label ?? null,
        req.body.emoji !== undefined, req.body.emoji ?? null,
        req.body.sort_order ?? null,
        req.params.id, req.user.id,
      ]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '수식어를 찾을 수 없습니다' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: '이미 같은 이름의 수식어가 있습니다' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/epithets/:id
 * 수식어 삭제 — user_epithet_items는 CASCADE로 함께 삭제
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM user_epithets WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '수식어를 찾을 수 없습니다' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/epithets/:id/items
 * 시청 기록을 수식어에 부착 — user_media_id
 * 부문 소유권 + 부착 대상 기록의 소유권 모두 확인(타 유저 기록 부착 차단)
 */
router.post('/:id/items', auth, async (req, res) => {
  const { user_media_id } = req.body;
  if (!user_media_id) {
    return res.status(400).json({ success: false, message: 'user_media_id가 필요합니다' });
  }

  try {
    const { rows: epithetRows } = await pool.query(
      'SELECT id FROM user_epithets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!epithetRows[0]) return res.status(404).json({ success: false, message: '수식어를 찾을 수 없습니다' });

    const { rows: mediaRows } = await pool.query(
      'SELECT id FROM user_media WHERE id = $1 AND user_id = $2',
      [user_media_id, req.user.id]
    );
    if (!mediaRows[0]) return res.status(404).json({ success: false, message: '기록을 찾을 수 없습니다' });

    const { rows: maxRows } = await pool.query(
      'SELECT COALESCE(MAX(sort_order), -1) AS max FROM user_epithet_items WHERE epithet_id = $1',
      [req.params.id]
    );
    const sortOrder = maxRows[0].max + 1;

    const { rows } = await pool.query(
      `INSERT INTO user_epithet_items (epithet_id, user_media_id, sort_order)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.params.id, user_media_id, sortOrder]
    );
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: '이미 부착된 작품입니다' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/epithets/:id/items/:itemId
 * 수식어에서 작품 해제
 */
router.delete('/:id/items/:itemId', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `DELETE FROM user_epithet_items WHERE id = $1
       AND epithet_id IN (SELECT id FROM user_epithets WHERE id = $2 AND user_id = $3)
       RETURNING id`,
      [req.params.itemId, req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/epithets/:id/items/reorder
 * 드래그 정렬 결과 일괄 반영 — body: { ids: [item.id, ...] } (새 순서, 첫 번째=대표작)
 */
router.patch('/:id/items/reorder', auth, async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ success: false, message: 'ids 배열이 필요합니다' });
  }

  try {
    const { rows: epithetRows } = await pool.query(
      'SELECT id FROM user_epithets WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );
    if (!epithetRows[0]) return res.status(404).json({ success: false, message: '수식어를 찾을 수 없습니다' });

    await Promise.all(
      ids.map((id, idx) =>
        pool.query(
          'UPDATE user_epithet_items SET sort_order = $1 WHERE id = $2 AND epithet_id = $3',
          [idx, id, req.params.id]
        )
      )
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
