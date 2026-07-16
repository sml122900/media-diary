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

    let addedTmdbIds = new Set();
    let addedTitleYears = new Set();
    if (userId) {
      // 사용자가 이미 추가한 작품 조회 (tmdb_id 또는 title+year 기준으로 대조)
      const { rows: added } = await pool.query(
        'SELECT tmdb_id, title, year FROM user_media WHERE user_id = $1',
        [userId]
      );
      addedTmdbIds = new Set(added.filter(r => r.tmdb_id > 0).map(r => r.tmdb_id));
      addedTitleYears = new Set(added.map(r => `${r.title}::${r.year}`));
    }

    const result = items.map(item => ({
      ...item,
      already_added: addedTmdbIds.has(item.tmdb_id) || addedTitleYears.has(`${item.title}::${item.year}`),
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

    // 이미 있으면 스킵 (tmdb_id 또는 title+year 기준)
    const { rows: existing } = await pool.query(
      `SELECT id FROM user_media
       WHERE user_id = $1 AND ((tmdb_id = $2 AND tmdb_id > 0) OR (title = $3 AND year = $4))`,
      [req.user.id, tmdb_id, title, year]
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

// ─── Phase 7.2: 감독/배우 자유 검색 ────────────────────────────────────────

/**
 * GET /api/curation/person/search?q={이름}
 * TMDB 인물 검색 — 이름, 프로필 사진, 대표작 반환
 */
router.get('/person/search', async (req, res) => {
  const { q } = req.query;
  if (!q?.trim()) {
    return res.status(400).json({ success: false, message: '검색어를 입력하세요.' });
  }
  try {
    const qs = new URLSearchParams({ query: q.trim(), language: 'ko-KR', api_key: TMDB_KEY });
    const response = await fetch(`${TMDB_BASE}/search/person?${qs}`);
    const data = await response.json();

    const results = (data.results || []).slice(0, 8).map(p => ({
      id: p.id,
      name: p.name,
      profile_path: p.profile_path || null,
      known_for_department: p.known_for_department || '',
      // 대표작 최대 3편 (제목만)
      known_for: (p.known_for || []).slice(0, 3).map(w => w.title || w.name).filter(Boolean),
    }));

    res.json({ success: true, data: results });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/curation/person/:tmdbId/works?type=director|actor
 * 특정 인물의 감독 또는 출연 작품 목록 (인기도순, already_added 마킹)
 */
router.get('/person/:tmdbId/works', auth, async (req, res) => {
  const { tmdbId } = req.params;
  const { type = 'director' } = req.query;

  try {
    // TMDB 영화 + TV 크레딧 병렬 조회
    const [movieRes, tvRes] = await Promise.all([
      fetch(`${TMDB_BASE}/person/${tmdbId}/movie_credits?api_key=${TMDB_KEY}&language=ko-KR`),
      fetch(`${TMDB_BASE}/person/${tmdbId}/tv_credits?api_key=${TMDB_KEY}&language=ko-KR`),
    ]);
    const [movieData, tvData] = await Promise.all([movieRes.json(), tvRes.json()]);

    let works = [];

    if (type === 'director') {
      // 감독 작품: crew에서 job=Director 필터
      const movieDirected = (movieData.crew || []).filter(c => c.job === 'Director');
      const tvDirected   = (tvData.crew   || []).filter(c => c.job === 'Director');
      works = [
        ...movieDirected.map(w => ({ ...w, tmdb_type: 'movie', media_type: 'movie' })),
        ...tvDirected.map(w   => ({ ...w, tmdb_type: 'tv',    media_type: 'drama' })),
      ];
    } else {
      // 배우 작품: cast 전체 (movie + tv)
      works = [
        ...(movieData.cast || []).map(w => ({ ...w, tmdb_type: 'movie', media_type: 'movie' })),
        ...(tvData.cast    || []).map(w => ({ ...w, tmdb_type: 'tv',    media_type: 'drama' })),
      ];
    }

    // 중복 제거 (tmdb_id + tmdb_type 기준)
    const seen = new Set();
    works = works.filter(w => {
      const key = `${w.id}-${w.tmdb_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // 포스터 있는 작품 우선, 그 다음 인기도순
    works.sort((a, b) => {
      if (a.poster_path && !b.poster_path) return -1;
      if (!a.poster_path && b.poster_path) return 1;
      return (b.popularity || 0) - (a.popularity || 0);
    });

    works = works.slice(0, 60);

    // 사용자가 이미 추가한 작품 조회 (tmdb_id 또는 title+year 기준으로 대조)
    const { rows: added } = await pool.query(
      'SELECT tmdb_id, title, year FROM user_media WHERE user_id = $1',
      [req.user.id]
    );
    const addedTmdbIds = new Set(added.filter(r => r.tmdb_id > 0).map(r => r.tmdb_id));
    const addedTitleYears = new Set(added.map(r => `${r.title}::${r.year}`));

    const result = works.map(w => {
      const title = w.title || w.name;
      const year = parseInt((w.release_date || w.first_air_date || '').slice(0, 4)) || 0;
      return {
        tmdb_id:       w.id,
        tmdb_type:     w.tmdb_type,
        title,
        year,
        poster_path:   w.poster_path || null,
        media_type:    w.media_type,
        already_added: addedTmdbIds.has(w.id) || addedTitleYears.has(`${title}::${year}`),
      };
    });

    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
