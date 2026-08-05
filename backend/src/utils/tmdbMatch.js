/**
 * @file tmdbMatch.js
 * AI가 낸 작품 정보(제목·원제·연도)를 TMDB의 실제 작품에 매칭한다.
 *
 * 기존 search/natural은 검색 결과를 vote_average 내림차순으로만 정렬했다.
 * TMDB의 vote_average는 표가 1~4개여도 8점대가 나오기 때문에, "Arrival" 검색에서
 * 표 3개짜리 The Arrival(2017)이 표 19,635개의 Arrival(2016)을 이기고 1위가 됐다.
 * 그래서 평점 단독 정렬을 버리고 제목 유사도·연도 근접도·표수를 함께 점수화한다.
 *
 * discover/chat, restore/chat도 results[0]을 무조건 채택하던 것을 이 모듈로 통일했다.
 * (importScreenshot은 자체 5단계 전략 + 신뢰도 계산이 이미 동작 중이라 건드리지 않는다)
 */

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';

/**
 * 매칭 채택 하한. 이 아래는 엉뚱한 작품일 가능성이 높아 결과에서 제외한다.
 * 엉뚱한 걸 보여주느니 빼는 편이 낫다는 판단.
 */
const SCORE_THRESHOLD = 0.5;

/**
 * 연도를 건 검색에서 나온 후보에 주는 가산점.
 *
 * TMDB의 original_title은 원어라서(타르코프스키 Stalker의 원제는 "Сталкер")
 * 문자열 유사도가 0에 가깝게 나온다. 그 탓에 한국어 제목이 우연히 같은
 * 엉뚱한 작품(One Hour Photo의 한국 제목이 "스토커")이 이겨버렸다.
 * 연도를 걸고 검색했는데도 TMDB가 그 작품을 돌려줬다는 건, TMDB 자체 색인이
 * (별칭 제목까지 포함해) 제목과 연도 양쪽에 동의했다는 뜻이라 신뢰할 만하다.
 */
const YEAR_QUERY_BONUS = 0.5;

/**
 * 제목 정규화 — 시즌/회차/괄호연도 제거
 * "기묘한 이야기 시즌 4" → "기묘한 이야기"
 */
function normalizeTitle(title) {
  return String(title || '')
    .replace(/\s*시즌\s*\d+/g, '')
    .replace(/\s*Season\s*\d+/gi, '')
    .replace(/\s*S\d{1,2}E\d{1,2}/gi, '')
    .replace(/\s*\d+화/g, '')
    .replace(/\s*EP\.?\s*\d+/gi, '')
    .replace(/\(\d{4}\)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 제목 유사도 (0~1) — 완전 일치 > 포함 > 공통 글자 비율
 * @returns {number}
 */
function titleSimilarity(a, b) {
  const na = String(a || '').toLowerCase().replace(/\s+/g, '');
  const nb = String(b || '').toLowerCase().replace(/\s+/g, '');
  if (!na || !nb) return 0;
  if (na === nb) return 1.0;
  if (na.includes(nb) || nb.includes(na)) return 0.85;
  const setA = new Set(na.split(''));
  const common = nb.split('').filter(c => setA.has(c)).length;
  return common / Math.max(na.length, nb.length, 1);
}

/** TMDB GET — 실패하면 null */
async function tmdbGet(path, params = {}) {
  const qs = new URLSearchParams({ ...params, api_key: process.env.TMDB_API_KEY }).toString();
  try {
    const res = await fetch(`${TMDB_BASE}${path}?${qs}`);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/** TMDB 검색 1회 — 결과 배열 반환 */
async function tmdbSearch(query, tmdbType, year) {
  const yearParam = tmdbType === 'tv' ? 'first_air_date_year' : 'year';
  const params = { query, language: 'ko-KR' };
  if (year) params[yearParam] = year;
  const data = await tmdbGet(`/search/${tmdbType}`, params);
  return data?.results || [];
}

/** TMDB 결과에서 연도 추출 */
function resultYear(r) {
  return parseInt((r.release_date || r.first_air_date || '').slice(0, 4)) || 0;
}

/**
 * 후보 점수 = 제목 유사도 + 연도 근접도 + 표수 가중
 * 연도가 2년 이상 어긋나면 감점해서, 동명 다른 작품이 뽑히지 않게 한다.
 * @param {{title: string, original_title?: string, year?: number}} work AI가 낸 작품
 * @param {object} r TMDB 검색 결과 1건
 * @returns {number}
 */
function scoreCandidate(work, r) {
  const title = r.title || r.name || '';
  const original = r.original_title || r.original_name || '';

  // 한국어 제목·원제를 교차로 비교해 가장 높은 유사도를 쓴다
  const sim = Math.max(
    titleSimilarity(work.title, title),
    titleSimilarity(work.title, original),
    titleSimilarity(work.original_title, title),
    titleSimilarity(work.original_title, original)
  );

  let yearScore = 0;
  const y = resultYear(r);
  if (work.year && y) {
    const diff = Math.abs(work.year - y);
    yearScore = diff === 0 ? 0.3 : diff === 1 ? 0.15 : -0.3;
  }

  // 표수 가중 — 평점 단독 정렬이 무명작을 1위로 올리던 문제를 막는 핵심
  const vc = r.vote_count || 0;
  const voteScore = vc >= 1000 ? 0.2 : vc >= 100 ? 0.12 : vc >= 10 ? 0.05 : 0;

  return sim + yearScore + voteScore;
}

/**
 * 줄거리가 비어 있으면 원어(en-US)로 한 번 더 채운다.
 * TMDB는 한국어 번역이 없으면 overview를 빈 문자열로 준다 (fallback 안 해줌).
 */
async function fillOverview(tmdbType, id, overview) {
  if (overview) return overview;
  const detail = await tmdbGet(`/${tmdbType}/${id}`, { language: 'en-US' });
  return detail?.overview || '';
}

/**
 * 작품 1건을 TMDB에서 찾아 가장 그럴듯한 후보를 돌려준다.
 * 여러 검색 전략의 결과를 모두 모아 점수화한 뒤 최고점 1건만 채택하고,
 * 임계 미달이면 null을 준다 (호출 측에서 결과에서 빼면 된다).
 *
 * @param {{title: string, original_title?: string, year?: number, tmdb_type?: string}} work
 * @returns {Promise<object|null>}
 */
async function matchWork(work) {
  const title = String(work?.title || '').trim();
  if (!title) return null;

  const tmdbType = work.tmdb_type === 'tv' ? 'tv' : 'movie';
  const normalized = normalizeTitle(title);
  const original = work.original_title ? String(work.original_title).trim() : '';

  // 전략별 검색 결과를 전부 모은다 (하나라도 맞으면 되는 게 아니라, 모아서 점수로 고른다)
  const queries = [
    { q: title, y: work.year },
    { q: title, y: null },
    ...(original ? [{ q: original, y: work.year }, { q: original, y: null }] : []),
    ...(normalized !== title ? [{ q: normalized, y: null }] : []),
  ];

  const batches = await Promise.all(
    queries.map(async s => ({ hadYear: !!s.y, results: await tmdbSearch(s.q, tmdbType, s.y) }))
  );

  // 같은 작품이 여러 전략에서 나올 수 있으므로 후보별 최고점을 남긴다
  const scores = new Map(); // id → { r, score }
  for (const { hadYear, results } of batches) {
    for (const r of results) {
      const score = scoreCandidate(work, r) + (hadYear ? YEAR_QUERY_BONUS : 0);
      const prev = scores.get(r.id);
      if (!prev || score > prev.score) scores.set(r.id, { r, score });
    }
  }

  let best = null;
  let bestScore = -Infinity;
  for (const { r, score } of scores.values()) {
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }

  if (!best || bestScore < SCORE_THRESHOLD) return null;

  const overview = await fillOverview(tmdbType, best.id, best.overview || '');

  return {
    tmdb_id: best.id,
    title: best.title || best.name || title,
    original_title: best.original_title || best.original_name || '',
    year: resultYear(best),
    tmdb_type: tmdbType,
    type: tmdbType === 'movie' ? 'movie' : 'drama',
    poster_path: best.poster_path || null,
    poster_url: best.poster_path ? IMG_BASE + best.poster_path : '',
    overview,
    vote_average: best.vote_average || 0,
    vote_count: best.vote_count || 0,
    popularity: best.popularity || 0,
    score: Math.round(bestScore * 100) / 100,
  };
}

module.exports = {
  matchWork,
  normalizeTitle,
  titleSimilarity,
  scoreCandidate,
  SCORE_THRESHOLD,
};
