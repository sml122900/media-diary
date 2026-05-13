# 큐레이션 TMDB ID 대량 오류 및 복구

**날짜**: 2026-05-14  
**심각도**: 높음 (데이터 정확도 전반 영향)

---

## 문제 상황

77개 큐레이션 리스트, 794개 아이템의 TMDB ID를 메모리에 의존해 수동 입력한 결과:

1. **수동 입력 오류**: 비슷한 번호끼리 혼동 (예: 놀란 리스트에서 인썸니아 6972 → 실제는 320)
2. **MCU 순환 swap**: 닥터스트레인지(284053), 토르라그나로크(284054), 블랙팬서(284052)가 한 칸씩 밀려 순환 참조
3. **Stage 8.3 배치 버그**: 타이틀 필터 없이 `WHERE tmdb_id = $2`만 사용 → 기생충(496243)이 1917(530915)로 6개 리스트에서 오염
4. **포스터 조회 실패 (Error 34)**: TMDB에 없는 ID → 18개 추가 오류 발견

---

## 시도한 것들

### 1단계: seed-curation.js 재실행 시도
- `ON CONFLICT (list_id, tmdb_id) DO NOTHING`이라 기존 잘못된 항목이 그대로 유지됨
- 재실행으로는 수정 불가 확인

### 2단계: 전수 검증 스크립트 작성
- 794개 전체 TMDB API 조회 → ID 유효성 + 제목 반환값 비교
- TITLE_MISMATCH 225건 중 183건은 한국어/영어 번역 차이 false positive 분리

### 3단계: fix-curation-ids.js 작성
- 확인된 42건 직접 UPDATE
- UNIQUE 충돌 시: 정상 ID가 이미 있으면 오류 항목 DELETE 처리

### 4단계: 포스터 fetch 후 추가 오류 발견
- Error 34 = TMDB에 없는 ID 확인
- TMDB 텍스트 검색으로 올바른 ID 재발견 → fix-curation-ids-round2.js

---

## 최종 해결법

```javascript
// 1. ID 유효성 확인
const data = await tmdbGet(`/movie/${id}?language=ko-KR`);
if (data.status_code === 34) { /* TMDB에 없음 */ }

// 2. UNIQUE 충돌 안전 UPDATE
const { rows: existing } = await pool.query(
  'SELECT id FROM curation_items WHERE list_id = $1 AND tmdb_id = $2',
  [listId, correctId]
);
if (existing.length > 0) {
  // 정상 ID 이미 있음 → 오류 항목 삭제
  await pool.query('DELETE FROM curation_items WHERE list_id = $1 AND tmdb_id = $2', [listId, wrongId]);
} else {
  await pool.query('UPDATE curation_items SET tmdb_id = $1 WHERE list_id = $2 AND tmdb_id = $3', [correctId, listId, wrongId]);
}

// 3. MCU 순환 swap — 임시값 경유
await pool.query('UPDATE ... SET tmdb_id = 999999 WHERE tmdb_id = 284052');  // BP → 임시
await pool.query('UPDATE ... SET tmdb_id = 284052 WHERE tmdb_id = 284053');  // DS 수정
await pool.query('UPDATE ... SET tmdb_id = 284053 WHERE tmdb_id = 284054');  // Thor 수정
await pool.query('UPDATE ... SET tmdb_id = 284054 WHERE tmdb_id = 999999');  // BP 복원
```

**총 수정**: 60건 (1차 42건 + 2차 18건)  
**포스터 재수집**: 19개 성공, 0개 실패

---

## 이력서 소재 한 줄

> 794개 큐레이션 데이터 TMDB API 전수 검증 자동화, ON CONFLICT 제약 환경에서 안전한 ID 교체 로직 및 순환 참조 해소 패턴 구현
