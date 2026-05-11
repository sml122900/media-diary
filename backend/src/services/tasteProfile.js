/**
 * @file tasteProfile.js
 * 취향 프로필 계산 서비스 — 감상 기록에서 장르/감독/연대 가중치 계산
 */

const pool = require('../db');

const TMDB_BASE = 'https://api.themoviedb.org/3';
const TMDB_KEY = process.env.TMDB_API_KEY;

// 별점 → 가중치 매핑 (높은 별점일수록 취향 반영 비율 증가)
const RATING_WEIGHTS = { 5: 2.0, 4: 1.5, 3: 1.0, 2: 0.5, 1: 0.2 };

/**
 * TMDB에서 단일 항목의 장르 목록 조회
 * @param {number} tmdbId
 * @param {'movie'|'anime'|'drama'} type
 * @returns {Promise<string[]>} 장르 이름 배열
 */
async function fetchItemGenres(tmdbId, type) {
  if (!tmdbId || !TMDB_KEY) return [];
  try {
    // anime/drama는 TV 엔드포인트 사용
    const endpoint = type === 'movie' ? 'movie' : 'tv';
    const res = await fetch(
      `${TMDB_BASE}/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&language=ko-KR`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.genres || []).map(g => g.name);
  } catch {
    return [];
  }
}

/**
 * 배치 단위로 TMDB 장르를 병렬 조회 (Rate Limit 방지)
 * @param {Array<{tmdb_id, type}>} items
 * @returns {Promise<Map<number, string[]>>} tmdb_id → 장르 배열
 */
async function fetchGenresBatch(items) {
  const result = new Map();
  const BATCH_SIZE = 5;
  const DELAY_MS = 120; // Rate Limit 방지 딜레이

  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const responses = await Promise.all(
      batch.map(item => fetchItemGenres(item.tmdb_id, item.type))
    );
    batch.forEach((item, idx) => {
      if (responses[idx].length > 0) result.set(item.tmdb_id, responses[idx]);
    });
    // 마지막 배치가 아니면 딜레이
    if (i + BATCH_SIZE < items.length) {
      await new Promise(r => setTimeout(r, DELAY_MS));
    }
  }
  return result;
}

/**
 * 점수 객체를 최대값 기준으로 0-1 정규화
 * @param {Record<string, number>} scores
 * @returns {Record<string, number>}
 */
function normalize(scores) {
  const max = Math.max(...Object.values(scores), 1);
  return Object.fromEntries(
    Object.entries(scores)
      .map(([k, v]) => [k, Math.round((v / max) * 100) / 100])
      .sort(([, a], [, b]) => b - a) // 높은 순 정렬
  );
}

/**
 * 사용자 취향 프로필 계산
 * - 별점 1-5 전체 항목을 가중치 기반으로 분석
 * - 장르는 별점 4+ 항목에서 TMDB API로 실시간 조회 (최대 25개)
 * @param {number} userId
 * @returns {Promise<object|null>}
 */
async function calculateTasteProfile(userId) {
  // 별점 있는 항목 전체 조회
  const { rows: ratedItems } = await pool.query(
    `SELECT id, type, year, director, rating, tmdb_id
     FROM user_media
     WHERE user_id = $1 AND rating > 0
     ORDER BY rating DESC, created_at DESC`,
    [userId]
  );

  if (ratedItems.length === 0) return null;

  const totalRated = ratedItems.length;
  const avgRating =
    ratedItems.reduce((s, r) => s + r.rating, 0) / totalRated;

  // ── 감독/연대 가중치 집계 (모든 별점 항목 대상) ──
  const directorScores = {};
  const decadeScores = {};

  ratedItems.forEach(({ type, year, director, rating }) => {
    const w = RATING_WEIGHTS[rating] || 1.0;

    if (director?.trim()) {
      directorScores[director] = (directorScores[director] || 0) + w;
    }
    if (year > 0) {
      const decade = String(Math.floor(year / 10) * 10);
      decadeScores[decade] = (decadeScores[decade] || 0) + w;
    }
  });

  // ── 장르 가중치 집계 (별점 4+ TMDB 실시간 조회, 최대 25개) ──
  const highRated = ratedItems
    .filter(r => r.rating >= 4 && r.tmdb_id > 0)
    .slice(0, 25);

  const genreMap = await fetchGenresBatch(highRated);
  const genreScores = {};

  highRated.forEach(({ tmdb_id, rating }) => {
    const genres = genreMap.get(tmdb_id) || [];
    const w = RATING_WEIGHTS[rating] || 1.5;
    genres.forEach(g => {
      genreScores[g] = (genreScores[g] || 0) + w;
    });
  });

  return {
    genres: Object.keys(genreScores).length > 0 ? normalize(genreScores) : {},
    directors: normalize(directorScores),
    decades: normalize(decadeScores),
    avg_rating: Math.round(avgRating * 100) / 100,
    total_count: totalRated,
  };
}

/**
 * 사용자 취향 프로필 계산 후 DB Upsert
 * 별점 기록이 없으면 프로필을 삭제
 * @param {number} userId
 */
async function updateTasteProfile(userId) {
  const profile = await calculateTasteProfile(userId);

  if (!profile) {
    // 별점 기록 없으면 프로필 제거
    await pool.query(
      'DELETE FROM user_taste_profile WHERE user_id = $1',
      [userId]
    );
    return;
  }

  await pool.query(
    `INSERT INTO user_taste_profile
       (user_id, genres, directors, decades, avg_rating, total_count, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (user_id) DO UPDATE SET
       genres      = EXCLUDED.genres,
       directors   = EXCLUDED.directors,
       decades     = EXCLUDED.decades,
       avg_rating  = EXCLUDED.avg_rating,
       total_count = EXCLUDED.total_count,
       updated_at  = NOW()`,
    [
      userId,
      JSON.stringify(profile.genres),
      JSON.stringify(profile.directors),
      JSON.stringify(profile.decades),
      profile.avg_rating,
      profile.total_count,
    ]
  );
}

module.exports = { calculateTasteProfile, updateTasteProfile };
