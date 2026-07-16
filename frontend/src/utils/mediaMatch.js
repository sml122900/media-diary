/**
 * @file mediaMatch.js
 * 기존 목록과 후보 작품이 동일한 항목인지 판단하는 공통 로직
 * tmdb_id 일치 OR title+year 일치 시 동일 작품으로 간주 (tmdb_id 누락/오염 데이터에도 안전)
 */

export function isSameMedia(existing, candidate) {
  if (existing.tmdb_id && candidate.tmdb_id && existing.tmdb_id === candidate.tmdb_id) return true;
  return existing.title === candidate.title && existing.year === candidate.year;
}

export function findExistingMedia(existingItems, candidate) {
  return existingItems.find(e => isSameMedia(e, candidate));
}
