/**
 * @file ratingAxes.js
 * 다면 별점 축 API (Phase 13.3) — 유저가 직접 만드는 추가 평가 기준 CRUD
 * user_rating_axes(축) + user_media_axis_ratings(축별 점수) 2테이블
 * user_media.rating(대표 별점)과는 완전 독립 — 이 라우터는 그 값을 읽거나 쓰지 않음
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
 * GET /api/rating-axes
 * 내 축 목록 + 축별 점수(items: user_media_id, rating) — 1쿼리
 */
router.get('/', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT
         a.id, a.label, a.emoji, a.sort_order, a.created_at,
         COALESCE(
           json_agg(
             json_build_object('id', r.id, 'user_media_id', r.user_media_id, 'rating', r.rating)
             ORDER BY r.id
           ) FILTER (WHERE r.id IS NOT NULL),
           '[]'::json
         ) AS items
       FROM user_rating_axes a
       LEFT JOIN user_media_axis_ratings r ON r.axis_id = a.id
       WHERE a.user_id = $1
       GROUP BY a.id
       ORDER BY a.sort_order, a.id`,
      [req.user.id]
    );
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/rating-axes
 * 축 생성 — label(1~20자), emoji(옵션)
 * UNIQUE(user_id, label) 위반 시 409 + 기존 id 반환(프론트가 기존 것 선택 처리)
 */
router.post('/', auth, async (req, res) => {
  const label = validateLabel(req.body.label);
  if (!label) {
    return res.status(400).json({ success: false, message: '축 이름은 1~20자로 입력해주세요' });
  }
  const emoji = req.body.emoji || null;

  try {
    const { rows } = await pool.query(
      `INSERT INTO user_rating_axes (user_id, label, emoji)
       VALUES ($1, $2, $3) RETURNING *`,
      [req.user.id, label, emoji]
    );
    res.json({ success: true, data: { ...rows[0], items: [] } });
  } catch (err) {
    if (err.code === '23505') {
      const { rows: existing } = await pool.query(
        'SELECT id FROM user_rating_axes WHERE user_id = $1 AND label = $2',
        [req.user.id, label]
      );
      return res.status(409).json({
        success: false,
        message: '이미 같은 이름의 축이 있습니다',
        data: { id: existing[0]?.id },
      });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/rating-axes/:id
 * label/emoji/sort_order 수정
 */
router.patch('/:id', auth, async (req, res) => {
  let label;
  if (req.body.label !== undefined) {
    label = validateLabel(req.body.label);
    if (!label) return res.status(400).json({ success: false, message: '축 이름은 1~20자로 입력해주세요' });
  }

  try {
    const { rows } = await pool.query(
      `UPDATE user_rating_axes SET
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
    if (!rows[0]) return res.status(404).json({ success: false, message: '축을 찾을 수 없습니다' });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, message: '이미 같은 이름의 축이 있습니다' });
    }
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/rating-axes/:id
 * 축 삭제 — user_media_axis_ratings는 CASCADE로 함께 삭제
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      'DELETE FROM user_rating_axes WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ success: false, message: '축을 찾을 수 없습니다' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
