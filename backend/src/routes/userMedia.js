/**
 * @file userMedia.js
 * 사용자 미디어 항목 CRUD API 라우터
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

/**
 * GET /api/user-media
 * 사용자의 모든 미디어 항목 조회
 */
router.get('/', auth, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM user_media WHERE user_id = $1 ORDER BY type, year ASC',
      [req.user.id]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/user-media/bulk
 * 다수의 미디어 항목 일괄 추가 (초기 씨드용)
 */
router.post('/bulk', auth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.json({ success: true, count: 0 });
  }
  try {
    let totalCount = 0;
    const BATCH = 50;
    for (let i = 0; i < items.length; i += BATCH) {
      const batch = items.slice(i, i + BATCH);
      const F = 8;
      const placeholders = batch
        .map((_, idx) => {
          const b = idx * F;
          return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8})`;
        })
        .join(',');
      const params = batch.flatMap(item => [
        req.user.id,
        item.type || 'movie',
        item.title,
        item.year || 0,
        item.director || '',
        item.cast_info || '',
        item.tmdb_id || 0,
        item.poster_url || '',
      ]);
      const r = await pool.query(
        `INSERT INTO user_media (user_id,type,title,year,director,cast_info,tmdb_id,poster_url)
         VALUES ${placeholders}
         ON CONFLICT (user_id,title,year) DO NOTHING`,
        params
      );
      totalCount += r.rowCount;
    }
    res.json({ success: true, count: totalCount });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/user-media
 * 미디어 항목 추가 또는 리뷰/정보 업서트
 */
router.post('/', auth, async (req, res) => {
  const {
    type, title, year, director, cast_info,
    poster_url, tmdb_id, rating, review_text, review_date,
  } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO user_media
         (user_id,type,title,year,director,cast_info,poster_url,tmdb_id,rating,review_text,review_date)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       ON CONFLICT (user_id,title,year) DO UPDATE SET
         type        = EXCLUDED.type,
         director    = EXCLUDED.director,
         cast_info   = EXCLUDED.cast_info,
         poster_url  = CASE WHEN EXCLUDED.poster_url <> '' THEN EXCLUDED.poster_url ELSE user_media.poster_url END,
         tmdb_id     = CASE WHEN EXCLUDED.tmdb_id <> 0    THEN EXCLUDED.tmdb_id    ELSE user_media.tmdb_id    END,
         rating      = EXCLUDED.rating,
         review_text = EXCLUDED.review_text,
         review_date = EXCLUDED.review_date
       RETURNING *`,
      [
        req.user.id, type || 'movie', title, year || 0,
        director || '', cast_info || '', poster_url || '', tmdb_id || 0,
        rating || 0, review_text || '', review_date || '',
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/user-media/:id
 * 미디어 항목 정보 업데이트 (제목, 감독, 포스터, 리뷰 등)
 * set_watched_at: true → 리뷰 저장 시 watched_at 갱신, false → 항목 정보 편집 시 유지
 */
router.put('/:id', auth, async (req, res) => {
  const {
    title, year, director, cast_info, poster_url,
    type, rating, review_text, review_date, set_watched_at,
  } = req.body;
  try {
    const result = await pool.query(
      `UPDATE user_media SET
         title=$1, year=$2, director=$3, cast_info=$4, poster_url=$5,
         type=$6, rating=$7, review_text=$8, review_date=$9,
         watched_at = CASE
           WHEN $10 AND ($7::int > 0 OR $8::text <> '') THEN NOW()
           WHEN $10 AND $7::int = 0 AND $8::text = ''   THEN NULL
           ELSE watched_at
         END
       WHERE id=$11 AND user_id=$12
       RETURNING *`,
      [
        title, year, director || '', cast_info || '', poster_url || '',
        type || 'movie', rating || 0, review_text || '', review_date || '',
        set_watched_at === true,
        req.params.id, req.user.id,
      ]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PATCH /api/user-media/:id/poster
 * 포스터 URL만 단독 업데이트 (포스터 교체 기능용)
 */
router.patch('/:id/poster', auth, async (req, res) => {
  const { poster_url } = req.body;
  try {
    const result = await pool.query(
      'UPDATE user_media SET poster_url=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
      [poster_url || '', req.params.id, req.user.id]
    );
    if (!result.rows[0]) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    }
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/user-media/:id
 * 미디어 항목 삭제
 */
router.delete('/:id', auth, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM user_media WHERE id=$1 AND user_id=$2',
      [req.params.id, req.user.id]
    );
    res.json({ success: true, message: '삭제됐습니다' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
