/**
 * @file tmdb.js
 * TMDB API 호출 함수 — 백엔드 프록시(/api/tmdb)를 통해 호출
 * API 키는 백엔드 환경변수에 보관되어 프론트엔드 소스코드에 노출되지 않음
 */

import { IMG_BASE } from '../utils/constants';

const PROXY = `${import.meta.env.VITE_API_URL}/api/tmdb`;

/** 백엔드 TMDB 프록시 호출 */
async function tmdbGet(path, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${PROXY}${path}${qs ? '?' + qs : ''}`;
  const res = await fetch(url);
  if (!res.ok) return null;
  return res.json();
}

/**
 * TMDB 세부정보(런타임, OTT, 장르 등) 조회
 * @param {number} tmdbId
 * @param {'movie'|'tv'} type
 */
export async function fetchTmdbDetail(tmdbId, type) {
  try {
    const [d, pd] = await Promise.all([
      tmdbGet(`/${type}/${tmdbId}`, { language: 'ko-KR' }),
      tmdbGet(`/${type}/${tmdbId}/watch/providers`),
    ]);
    if (!d) return null;
    const kr = pd?.results?.KR || {};
    const runtime =
      type === 'movie'
        ? d.runtime ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` : null
        : d.episode_run_time?.[0] ? `회당 ${d.episode_run_time[0]}m` : null;
    return {
      tmdbTitle: d.title || d.name || null,
      runtime,
      overview: d.overview || null,
      score: d.vote_average ? Math.round(d.vote_average * 10) / 10 : null,
      genres: (d.genres || []).map(g => g.name).slice(0, 3),
      providers: {
        flatrate: (kr.flatrate || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        rent: (kr.rent || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        buy: (kr.buy || []).map(p => ({ name: p.provider_name, logo: p.logo_path })),
        link: kr.link || null,
      },
    };
  } catch { return null; }
}

/**
 * TMDB 제목 검색 → 포스터 URL + ID + type 반환
 * preferType이 'tv'면 TV 먼저 검색, 'movie'면 영화 먼저 검색
 * @param {string} title
 * @param {number} year
 * @param {'movie'|'tv'} preferType
 */
export async function searchTmdbPoster(title, year, preferType) {
  // anime/drama는 tv 우선, movie는 movie 우선
  const types = preferType === 'tv' ? ['tv', 'movie'] : ['movie', 'tv'];
  for (const type of types) {
    try {
      const [r1, r2] = await Promise.all([
        tmdbGet(`/search/${type}`, { query: title, language: 'ko-KR' }),
        tmdbGet(`/search/${type}`, { query: title, language: 'en-US' }),
      ]);
      const results = [...(r1?.results || []), ...(r2?.results || [])];
      const match =
        results.find(x => {
          const y = parseInt((x.release_date || x.first_air_date || '').slice(0, 4));
          return Math.abs(y - year) <= 1 && x.poster_path;
        }) || results.find(x => x.poster_path);
      if (match) {
        return {
          posterUrl: IMG_BASE + match.poster_path,
          tmdbId: match.id,
          tmdbType: match.title ? 'movie' : 'tv',
          tmdbTitle: match.title || match.name || '',
        };
      }
    } catch { /* 다음 타입으로 */ }
  }
  return null;
}

function dedupeById(results) {
  const seen = new Set();
  return results.filter(r => !seen.has(r.id) && seen.add(r.id));
}

/** 붙여쓴 한글 쿼리에 대해 공백 1개를 각 위치에 끼워넣은 변형들 (길이-1개, 선형) */
function spaceInsertVariants(q) {
  const variants = [];
  for (let i = 1; i < q.length; i++) variants.push(q.slice(0, i) + ' ' + q.slice(i));
  return variants;
}

// TMDB는 한글 쿼리를 공백 기준으로 토큰 매칭 — 붙여쓴 쿼리는 fallback 대상으로만 판단
const SPACE_FALLBACK_ELIGIBLE = /^[가-힣]{2,12}$/;

async function searchTmdbPages(query, type) {
  const page1 = await tmdbGet(`/search/${type}`, { query, language: 'ko-KR', page: 1 });
  let results = page1?.results || [];
  const totalPages = Math.min(page1?.total_pages || 1, 3);
  if (totalPages > 1) {
    const extraPages = await Promise.all(
      Array.from({ length: totalPages - 1 }, (_, i) =>
        tmdbGet(`/search/${type}`, { query, language: 'ko-KR', page: i + 2 })
      )
    );
    for (const p of extraPages) results = results.concat(p?.results || []);
  }
  return dedupeById(results);
}

/**
 * TMDB 키워드 검색 (단건 추가·포스터 교체용)
 * 결과가 20개(1페이지) 넘게 존재하면 최대 3페이지까지 병합해 반환
 * (예: "짱구는 못말려" 극장판 32편처럼 페이지 하나로 안 잡히는 시리즈 대응)
 * 1차 결과가 부실하고 붙여쓴 한글 쿼리로 보이면, 공백 1개 삽입 변형(최대 12개)으로 재검색
 * (예: "다크나이트" → "다크 나이트" 등 — TMDB가 공백 없는 한글 쿼리를 못 찾는 문제 보완)
 * @param {string} query
 * @param {'movie'|'tv'} type
 * @returns {Promise<Array>} TMDB 결과 배열 (관련도순, 최대 60개)
 */
export async function searchTmdb(query, type) {
  const trimmed = query.trim();
  if (!trimmed) return [];
  try {
    let results = await searchTmdbPages(trimmed, type);
    const needsSpaceFallback =
      results.length < 3 && !trimmed.includes(' ') && SPACE_FALLBACK_ELIGIBLE.test(trimmed);
    if (needsSpaceFallback) {
      const variants = spaceInsertVariants(trimmed).slice(0, 12);
      const variantResponses = await Promise.all(
        variants.map(v => tmdbGet(`/search/${type}`, { query: v, language: 'ko-KR', page: 1 }))
      );
      const existingIds = new Set(results.map(r => r.id));
      const fallbackResults = dedupeById(variantResponses.flatMap(d => d?.results || []))
        .filter(r => !existingIds.has(r.id));
      // 관련도(popularity) 기준으로 합쳐서 정렬 — 1차 결과가 소수의 엉뚱한 매칭일 수 있어
      // fallback에서 찾은 진짜 인기작이 위로 오도록 함
      results = [...results, ...fallbackResults].sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    }
    return results.slice(0, 60);
  } catch { return []; }
}

/**
 * TMDB 포스터 그리드 검색 (PosterPicker용, ko+en 중복 제거)
 * @param {string} query
 * @param {'movie'|'tv'} type
 * @returns {Promise<Array>} 포스터 있는 결과 배열 (최대 12개)
 */
export async function searchTmdbPosters(query, type) {
  if (!query.trim()) return [];
  try {
    const [r1, r2] = await Promise.all([
      tmdbGet(`/search/${type}`, { query, language: 'ko-KR' }),
      tmdbGet(`/search/${type}`, { query, language: 'en-US' }),
    ]);
    const seen = new Set();
    return [...(r1?.results || []), ...(r2?.results || [])]
      .filter(r => r.poster_path && !seen.has(r.id) && seen.add(r.id))
      .slice(0, 12);
  } catch { return []; }
}
