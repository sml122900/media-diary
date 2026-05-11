/**
 * @file recommend.js
 * 작품 추천 API 라우터 (/api/recommend/*)
 * Phase 3.2: 비슷한 작품 추천 (TMDB + 취향 프로필 기반)
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

// TMDB 장르 목록 메모리 캐시 (프로세스 재시작 전까지 유지)
const genreMemo = { movie: null, tv: null };

/**
 * TMDB API GET 요청
 */
async function tmdbGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, api_key: TMDB_KEY }).toString();
  const res = await fetch(`${TMDB_BASE}${path}?${qs}`);
  if (!res.ok) return null;
  return res.json();
}

/**
 * TMDB 장르 ID → 이름 매핑 테이블 조회 (메모리 캐시)
 * @param {'movie'|'tv'} endpoint
 * @returns {Promise<Record<number, string>>}
 */
async function getGenreMap(endpoint) {
  if (genreMemo[endpoint]) return genreMemo[endpoint];
  const data = await tmdbGet(`/genre/${endpoint}/list`, { language: 'ko-KR' });
  const map = {};
  (data?.genres || []).forEach(g => { map[g.id] = g.name; });
  genreMemo[endpoint] = map;
  return map;
}

/**
 * TMDB 추천 목록 조회 (DB 24h 캐시)
 * @param {number} tmdbId
 * @param {'movie'|'tv'} endpoint
 * @returns {Promise<Array>} TMDB 추천 결과 배열
 */
async function getCachedTmdbRecs(tmdbId, endpoint) {
  const { rows } = await pool.query(
    `SELECT results, created_at FROM recommendations
     WHERE tmdb_id = $1 AND tmdb_type = $2`,
    [tmdbId, endpoint]
  );

  // 캐시 유효 (24시간 이내)
  if (rows[0]) {
    const ageHours = (Date.now() - new Date(rows[0].created_at)) / 3_600_000;
    if (ageHours < 24) return rows[0].results;
  }

  // TMDB에서 신규 조회
  const data = await tmdbGet(`/${endpoint}/${tmdbId}/recommendations`, { language: 'ko-KR' });
  const results = (data?.results || []).slice(0, 20);

  // 캐시 저장 (upsert)
  await pool.query(
    `INSERT INTO recommendations (tmdb_id, tmdb_type, results, created_at)
     VALUES ($1, $2, $3, NOW())
     ON CONFLICT (tmdb_id, tmdb_type) DO UPDATE SET results = $3, created_at = NOW()`,
    [tmdbId, endpoint, JSON.stringify(results)]
  );

  return results;
}

/**
 * GET /api/recommend/similar/:mediaId
 * 비슷한 작품 추천 (TMDB 추천 + 취향 프로필 재정렬 + 시청 이력 필터)
 * @param mediaId - user_media.id
 */
router.get('/similar/:mediaId', auth, async (req, res) => {
  try {
    // 대상 항목 조회 (내 목록에 있는지 확인)
    const { rows: itemRows } = await pool.query(
      'SELECT tmdb_id, type FROM user_media WHERE id = $1 AND user_id = $2',
      [req.params.mediaId, req.user.id]
    );
    if (!itemRows[0]) {
      return res.status(404).json({ success: false, message: '항목을 찾을 수 없습니다' });
    }

    const { tmdb_id: tmdbId, type: itemType } = itemRows[0];
    if (!tmdbId || tmdbId === 0) {
      return res.json({ success: true, data: [] }); // TMDB ID 없으면 빈 결과
    }

    const endpoint = itemType === 'movie' ? 'movie' : 'tv';

    // TMDB 추천 목록 조회 (캐시 활용)
    const recs = await getCachedTmdbRecs(tmdbId, endpoint);

    // 장르 ID → 이름 매핑 테이블
    const genreMap = await getGenreMap(endpoint);

    // 이미 본 작품 tmdb_id 집합
    const { rows: watchedRows } = await pool.query(
      'SELECT tmdb_id FROM user_media WHERE user_id = $1 AND tmdb_id > 0',
      [req.user.id]
    );
    const watchedIds = new Set(watchedRows.map(r => r.tmdb_id));

    // 사용자 취향 프로필 장르 가중치
    const { rows: profileRows } = await pool.query(
      'SELECT genres FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );
    const userGenres = profileRows[0]?.genres || {};

    // 필터링 + 취향 점수 계산 + 정렬
    const scored = recs
      .filter(r => !watchedIds.has(r.id)) // 이미 본 작품 제외
      .map(r => {
        const genres = (r.genre_ids || [])
          .map(id => genreMap[id])
          .filter(Boolean);
        // 장르 취향 매칭 점수
        const score = genres.reduce((s, g) => s + (userGenres[g] || 0), 0);
        return {
          tmdb_id: r.id,
          title: r.title || r.name || '',
          year: parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0,
          // 원본 작품과 같은 type 유지 (anime/drama 구분 보존)
          type: itemType,
          poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
          overview: r.overview || '',
          score,
          genres,
        };
      })
      .sort((a, b) => b.score - a.score) // 취향 점수 높은 순
      .slice(0, 8);

    res.json({ success: true, data: scored });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/recommend/daily
 * 오늘의 추천 (취향 프로필 기반, 24h 캐시)
 * - 별점 4+ 상위 5개 항목의 TMDB 추천을 합산
 * - 취향 장르 점수로 재정렬 → 최대 12개 후보 캐시
 * - 클라이언트에서 3개씩 순환 ("다른 추천 보기" 구현)
 */
router.get('/daily', auth, async (req, res) => {
  try {
    // 캐시 조회 (24h 유효)
    const { rows: cached } = await pool.query(
      'SELECT results, created_at FROM daily_recommendations WHERE user_id = $1',
      [req.user.id]
    );
    if (cached[0]) {
      const ageHours = (Date.now() - new Date(cached[0].created_at)) / 3_600_000;
      if (ageHours < 24) return res.json({ success: true, data: cached[0].results });
    }

    // 별점 4+ 상위 5개 항목 (오늘의 추천의 씨앗)
    const { rows: topItems } = await pool.query(
      `SELECT tmdb_id, type, title, rating
       FROM user_media
       WHERE user_id = $1 AND rating >= 4 AND tmdb_id > 0
       ORDER BY rating DESC, watched_at DESC NULLS LAST
       LIMIT 5`,
      [req.user.id]
    );

    // 별점 4+ 항목이 없으면 빈 결과 반환
    if (!topItems.length) return res.json({ success: true, data: [] });

    // 이미 본 작품 집합
    const { rows: watchedRows } = await pool.query(
      'SELECT tmdb_id FROM user_media WHERE user_id = $1 AND tmdb_id > 0',
      [req.user.id]
    );
    const watchedIds = new Set(watchedRows.map(r => r.tmdb_id));

    // 취향 프로필 장르 가중치
    const { rows: profileRows } = await pool.query(
      'SELECT genres FROM user_taste_profile WHERE user_id = $1',
      [req.user.id]
    );
    const userGenres = profileRows[0]?.genres || {};

    // 씨앗 항목별 TMDB 추천 수집 + 중복 제거
    const seenIds = new Set();
    const allRecs = [];

    for (const seedItem of topItems) {
      const endpoint = seedItem.type === 'movie' ? 'movie' : 'tv';
      const recs = await getCachedTmdbRecs(seedItem.tmdb_id, endpoint);
      const genreMap = await getGenreMap(endpoint);

      for (const r of recs) {
        if (watchedIds.has(r.id) || seenIds.has(r.id)) continue;
        seenIds.add(r.id);

        const genres = (r.genre_ids || []).map(id => genreMap[id]).filter(Boolean);
        const score = genres.reduce((s, g) => s + (userGenres[g] || 0), 0);

        allRecs.push({
          tmdb_id: r.id,
          title: r.title || r.name || '',
          year: parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0,
          type: seedItem.type,
          poster_url: r.poster_path ? IMG_BASE + r.poster_path : '',
          overview: r.overview || '',
          score,
          genres,
          // 추천 이유: 씨앗 항목 기준
          reason: `${seedItem.title}을(를) 좋아하셨다면`,
        });
      }
    }

    // 취향 점수 내림차순 정렬, 최대 12개 후보 캐시
    const candidates = allRecs
      .sort((a, b) => b.score - a.score)
      .slice(0, 12);

    // 캐시 저장
    await pool.query(
      `INSERT INTO daily_recommendations (user_id, results, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET results = $2, created_at = NOW()`,
      [req.user.id, JSON.stringify(candidates)]
    );

    res.json({ success: true, data: candidates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
