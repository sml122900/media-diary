/**
 * @file curation.js
 * 큐레이션 체크 API — 명작 리스트 조회 및 일괄 추가 (Phase 6.1)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const jwt = require('jsonwebtoken');

const TMDB_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE = 'https://api.themoviedb.org/3';

/** TMDB 상세 정보 조회 (movie 또는 tv) */
async function fetchTmdbDetail(tmdbId, tmdbType) {
  const url = `${TMDB_BASE}/${tmdbType}/${tmdbId}?api_key=${TMDB_KEY}&language=ko-KR&append_to_response=credits`;
  const res = await fetch(url);
  return res.json();
}

/**
 * GET /api/curation/lists
 * 모든 큐레이션 리스트를 카테고리별로 그룹핑해서 반환
 */
router.get('/lists', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, title, category, description, region, media_type, display_order
       FROM curation_lists
       ORDER BY category, display_order`
    );

    // category 기준으로 그룹핑
    const grouped = {};
    for (const row of rows) {
      if (!grouped[row.category]) grouped[row.category] = [];
      grouped[row.category].push(row);
    }

    res.json({ success: true, data: grouped });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/curation/lists/:slug/items
 * 특정 큐레이션 리스트의 작품 목록 반환
 * 로그인 사용자는 already_added 마킹 포함
 */
router.get('/lists/:slug/items', async (req, res) => {
  try {
    // 리스트 정보 조회
    const { rows: listRows } = await pool.query(
      'SELECT * FROM curation_lists WHERE slug = $1',
      [req.params.slug]
    );
    if (!listRows.length) {
      return res.status(404).json({ success: false, message: '리스트를 찾을 수 없습니다.' });
    }
    const list = listRows[0];

    // 아이템 조회
    const { rows: items } = await pool.query(
      `SELECT id, tmdb_id, tmdb_type, title, year, poster_path, display_order
       FROM curation_items
       WHERE list_id = $1
       ORDER BY display_order`,
      [list.id]
    );

    // 로그인 사용자인 경우 already_added 체크
    let token = req.headers.authorization?.split(' ')[1];
    let userId = null;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        userId = decoded.id;
      } catch (_) {}
    }

    let addedSet = new Set();
    if (userId) {
      // 사용자가 이미 추가한 tmdb_id 목록 조회
      const { rows: added } = await pool.query(
        'SELECT tmdb_id FROM user_media WHERE user_id = $1 AND tmdb_id > 0',
        [userId]
      );
      addedSet = new Set(added.map(r => r.tmdb_id));
    }

    const result = items.map(item => ({
      ...item,
      already_added: addedSet.has(item.tmdb_id),
    }));

    res.json({ success: true, data: { list, items: result } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/curation/bulk-add
 * 선택한 큐레이션 작품들을 사용자 user_media에 일괄 추가
 * body: { items: [{ tmdb_id, tmdb_type, title, year }] }
 */
router.post('/bulk-add', auth, async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items 배열이 필요합니다.' });
  }

  let added = 0;
  let skipped = 0;

  for (const item of items) {
    const { tmdb_id, tmdb_type, title, year } = item;

    // 이미 있으면 스킵
    const { rows: existing } = await pool.query(
      'SELECT id FROM user_media WHERE user_id = $1 AND tmdb_id = $2 AND tmdb_id > 0',
      [req.user.id, tmdb_id]
    );
    if (existing.length > 0) {
      skipped++;
      continue;
    }

    try {
      // TMDB에서 상세 정보 조회
      const detail = await fetchTmdbDetail(tmdb_id, tmdb_type);

      // media type 결정 (tv → drama 또는 anime, movie → movie)
      // curation_items의 tmdb_type으로 판단하되, 기본값은 'movie'
      let mediaType = 'movie';
      if (tmdb_type === 'tv') mediaType = 'drama';

      // 제목 (한국어 우선)
      const localTitle = detail.title || detail.name || title;

      // 연도
      const releaseDate = detail.release_date || detail.first_air_date || '';
      const releaseYear = releaseDate ? parseInt(releaseDate.slice(0, 4)) : (year || 0);

      // 포스터
      const posterUrl = detail.poster_path
        ? `https://image.tmdb.org/t/p/w500${detail.poster_path}`
        : '';

      // 감독 (movie는 crew에서, tv는 created_by에서)
      let director = '';
      if (detail.credits?.crew) {
        const dir = detail.credits.crew.find(c => c.job === 'Director');
        if (dir) director = dir.name;
      } else if (detail.created_by?.length) {
        director = detail.created_by.map(c => c.name).join(', ');
      }

      // 출연진 (상위 3명)
      let castInfo = '';
      if (detail.credits?.cast?.length) {
        castInfo = detail.credits.cast.slice(0, 3).map(c => c.name).join(', ');
      }

      // 러닝타임
      const runtime = detail.runtime || null;

      await pool.query(
        `INSERT INTO user_media
           (user_id, type, title, year, director, cast_info, tmdb_id, poster_url, runtime_minutes, rewatch_count)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1)`,
        [req.user.id, mediaType, localTitle, releaseYear, director, castInfo,
         tmdb_id, posterUrl, runtime]
      );
      added++;
    } catch (err) {
      // 개별 실패는 스킵 처리 (UNIQUE 충돌 등)
      console.error(`bulk-add 실패 tmdb_id=${tmdb_id}:`, err.message);
      skipped++;
    }
  }

  res.json({ success: true, data: { added, skipped } });
});

module.exports = router;
