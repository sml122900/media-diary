/**
 * @file yearInReview.js
 * 연말 결산 API (Phase 5.1)
 * Spotify Wrapped 스타일 연간 감상 통계 집계 및 캐시
 */

const express = require('express');
const router = express.Router();
const pool = require('../db');
const auth = require('../middleware/auth');

// 타입별 평균 상영 시간 (분) — TMDB runtime 없을 때 추정값
const RUNTIME_ESTIMATE = { movie: 110, drama: 60, anime: 24 };

/**
 * 총 시청 시간(분)을 위트 있는 비교 문구로 변환
 * @param {number} minutes
 */
function watchTimeComment(minutes) {
  const hours = Math.round(minutes / 60);
  if (hours >= 200) return `서울-부산 KTX를 ${Math.floor(minutes / 112)}번 탈 수 있는 시간이에요`;
  if (hours >= 50)  return `마라톤을 ${Math.floor(minutes / 300)}번 뛸 수 있는 시간이에요`;
  if (hours >= 10)  return `잠을 ${Math.floor(minutes / 480)}일치 더 잘 수 있었어요`;
  return `작은 영화관 한 편 분량이에요`;
}

/**
 * 연도 결산 데이터 집계
 * @param {number} userId
 * @param {number} year
 */
async function computeYearData(userId, year) {
  const yStart = `${year}-01-01 00:00:00`;
  const yEnd   = `${year}-12-31 23:59:59`;

  // 올해 감상 항목 전체
  const { rows: items } = await pool.query(
    `SELECT id, type, title, year AS release_year, director,
            rating, watched_at, poster_url, tmdb_id, runtime_minutes
     FROM user_media
     WHERE user_id = $1
       AND watched_at >= $2::timestamp
       AND watched_at <= $3::timestamp
     ORDER BY watched_at ASC`,
    [userId, yStart, yEnd]
  );

  if (items.length === 0) return null;

  // 작년 통계
  const prevYear = year - 1;
  const { rows: prevRows } = await pool.query(
    `SELECT COUNT(*)::int AS count,
            ROUND(AVG(NULLIF(rating, 0))::numeric, 1)::float AS avg_rating
     FROM user_media
     WHERE user_id = $1
       AND watched_at >= $2::timestamp
       AND watched_at <= $3::timestamp`,
    [userId, `${prevYear}-01-01`, `${prevYear}-12-31 23:59:59`]
  );

  const totalCount = items.length;
  const ratedItems = items.filter(i => i.rating > 0);
  const avgRating  = ratedItems.length
    ? Math.round(ratedItems.reduce((s, i) => s + i.rating, 0) / ratedItems.length * 10) / 10
    : null;

  // 총 시청 시간 (runtime_minutes 없으면 타입별 추정)
  const totalMinutes = items.reduce((s, i) => {
    return s + (i.runtime_minutes || RUNTIME_ESTIMATE[i.type] || 90);
  }, 0);

  // 타입별 분포
  const typeDistribution = { movie: 0, anime: 0, drama: 0 };
  items.forEach(i => { typeDistribution[i.type] = (typeDistribution[i.type] || 0) + 1; });

  // 감독 TOP 3 (감독명 있는 항목만)
  const directorMap = {};
  items.forEach(i => {
    if (i.director?.trim()) {
      directorMap[i.director] = (directorMap[i.director] || 0) + 1;
    }
  });
  const topDirectors = Object.entries(directorMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([name, count]) => ({ name, count }));

  // 연대별 TOP 3
  const decadeMap = {};
  items.forEach(i => {
    if (i.release_year > 0) {
      const d = String(Math.floor(i.release_year / 10) * 10);
      decadeMap[d] = (decadeMap[d] || 0) + 1;
    }
  });
  const topDecades = Object.entries(decadeMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([decade, count]) => ({ decade, count }));

  // 별점 ★5 작품 (최대 20개)
  const fiveStarItems = items
    .filter(i => i.rating === 5)
    .slice(0, 20)
    .map(i => ({ title: i.title, poster_url: i.poster_url, release_year: i.release_year }));

  // 월별 감상 수 (1~12월)
  const monthlyCounts = Array(12).fill(0);
  items.forEach(i => {
    const m = new Date(i.watched_at).getMonth(); // 0-indexed
    monthlyCounts[m]++;
  });

  // 가장 긴/짧은 작품 (runtime_minutes 있는 것만)
  const withRuntime = items.filter(i => i.runtime_minutes > 0);
  const longest  = withRuntime.length
    ? withRuntime.reduce((a, b) => a.runtime_minutes > b.runtime_minutes ? a : b)
    : null;
  const shortest = withRuntime.length
    ? withRuntime.reduce((a, b) => a.runtime_minutes < b.runtime_minutes ? a : b)
    : null;

  return {
    year,
    total_count:       totalCount,
    total_minutes:     totalMinutes,
    watch_time_comment: watchTimeComment(totalMinutes),
    avg_rating:        avgRating,
    type_distribution: typeDistribution,
    top_directors:     topDirectors,
    top_decades:       topDecades,
    five_star_items:   fiveStarItems,
    monthly_counts:    monthlyCounts,
    longest_item:      longest  ? { title: longest.title,  runtime: longest.runtime_minutes }  : null,
    shortest_item:     shortest ? { title: shortest.title, runtime: shortest.runtime_minutes } : null,
    prev_year_count:     prevRows[0]?.count      || 0,
    prev_year_avg_rating: prevRows[0]?.avg_rating || null,
  };
}

/**
 * GET /api/year-in-review/:year
 * 연도별 결산 데이터 반환 (1시간 캐시, 끝난 연도는 영구 캐시)
 */
router.get('/:year', auth, async (req, res) => {
  const year = parseInt(req.params.year);
  if (!year || year < 2000 || year > 2035) {
    return res.status(400).json({ success: false, message: '유효하지 않은 연도입니다' });
  }

  try {
    // 캐시 조회
    const { rows: cached } = await pool.query(
      'SELECT data, generated_at FROM year_in_review_cache WHERE user_id = $1 AND year = $2',
      [req.user.id, year]
    );

    const isCurrentYear = year === new Date().getFullYear();

    if (cached[0]) {
      const ageHours = (Date.now() - new Date(cached[0].generated_at)) / 3_600_000;
      // 끝난 연도는 영구 캐시, 진행 중 연도는 1시간 캐시
      if (!isCurrentYear || ageHours < 1) {
        return res.json({ success: true, data: cached[0].data, cached: true });
      }
    }

    // 새로 집계
    const data = await computeYearData(req.user.id, year);

    if (!data) {
      return res.json({ success: true, data: null, message: `${year}년 감상 기록이 없습니다` });
    }

    // 캐시 저장
    await pool.query(
      `INSERT INTO year_in_review_cache (user_id, year, data, generated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, year) DO UPDATE SET data = $3, generated_at = NOW()`,
      [req.user.id, year, JSON.stringify(data)]
    );

    res.json({ success: true, data, cached: false });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
