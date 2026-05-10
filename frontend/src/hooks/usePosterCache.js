/**
 * @file usePosterCache.js
 * 포스터 URL 캐시 관리 훅 — localStorage 영속 + 백그라운드 TMDB 프리패치
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { searchTmdbPoster } from '../api/tmdb';

/**
 * @param {Array} items - 미디어 항목 배열
 * @returns {{ getPosterUrl: Function, updateCacheKey: Function }}
 */
export function usePosterCache(items) {
  // localStorage에 저장된 포스터 캐시 (title_year → URL)
  const posterCache = useRef((() => {
    try { return JSON.parse(localStorage.getItem('mdb_poster_url') || '{}'); } catch { return {}; }
  })());

  // React 렌더링을 트리거하는 포스터 상태
  const [posters, setPosters] = useState({});

  const savePosterCache = useCallback(() => {
    try { localStorage.setItem('mdb_poster_url', JSON.stringify(posterCache.current)); } catch { }
  }, []);

  /** 포스터 URL 결정: DB저장값 > localStorage캐시 > 백그라운드 프리패치 결과 */
  const getPosterUrl = useCallback((item) => {
    if (item.poster_url) return item.poster_url;
    const key = `${item.title}_${item.year}`;
    return posterCache.current[key] || posters[key] || '';
  }, [posters]);

  /** 캐시 키 수동 업데이트 (포스터 교체 시) */
  const updateCacheKey = useCallback((key, url) => {
    posterCache.current[key] = url;
    setPosters(p => ({ ...p, [key]: url }));
    savePosterCache();
  }, [savePosterCache]);

  // 포스터 없는 항목 백그라운드 프리패치 (type 기반으로 정확한 TMDB 타입 사용)
  useEffect(() => {
    if (!items.length) return;
    const missing = items.filter(i => {
      if (i.poster_url) return false;
      const key = `${i.title}_${i.year}`;
      return !posterCache.current[key];
    });
    if (!missing.length) return;

    let cancelled = false;
    (async () => {
      for (const item of missing) {
        if (cancelled) break;
        const key = `${item.title}_${item.year}`;
        if (posterCache.current[key]) continue;
        // anime/drama → tv 타입으로 검색, movie → movie 타입 (type 버그 수정)
        const preferType = item.type === 'movie' ? 'movie' : 'tv';
        const res = await searchTmdbPoster(item.title, item.year, preferType);
        if (res?.posterUrl && !cancelled) {
          posterCache.current[key] = res.posterUrl;
          setPosters(p => ({ ...p, [key]: res.posterUrl }));
        }
        await new Promise(r => setTimeout(r, 80));
      }
      savePosterCache();
    })();
    return () => { cancelled = true; };
  }, [items]);

  return { getPosterUrl, updateCacheKey };
}
