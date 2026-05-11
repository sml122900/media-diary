# Year in Review 캐시가 항상 만료되는 버그

## 문제 상황

`GET /api/year-in-review/:year` API를 연속으로 3번 호출해도
매번 `cached: false`가 반환되며 데이터를 재계산한다.
1시간 TTL 캐시가 의도한 대로 동작하지 않는 것.

## 시도한 것들

1. `console.log`로 SELECT 결과 확인 → `cache rows: 1` — 행은 존재함
2. `ageHours` 값 출력 → **`ageHours: 9.031`** — 항상 9시간으로 나옴
3. INSERT ON CONFLICT 구문 확인 → 이상 없음
4. year 파라미터 타입 확인 (number vs string) → 이상 없음

## 최종 해결법

**원인**: PostgreSQL `TIMESTAMP WITHOUT TIME ZONE` 컬럼을 `pg` 클라이언트가 **서버 로컬 타임존(KST, UTC+9)**으로 파싱한다.
DB는 `NOW()`를 UTC로 저장하지만, pg는 이 값을 KST 시각으로 해석해 `new Date()`에 넘긴다.
JavaScript의 `Date.now()`는 UTC 기준이므로, 결과적으로 **9시간 차이**가 발생한다.

```
DB 저장: 2026-05-12 07:48:00 (UTC)
pg 파싱: 2026-05-12 07:48:00 → KST 로 간주 → UTC 기준으로는 22:48:00(전날)
Date.now(): 2026-05-12 07:48:xx (UTC)
ageHours = (07:48 - (전날)22:48) / 3600 = 9시간
```

**해결**: 시간 비교 자체를 DB에서 처리해 TZ 불일치 제거.

```js
// 수정 전 (timezone 오차 발생)
const { rows } = await pool.query(
  'SELECT data, generated_at FROM year_in_review_cache WHERE user_id = $1 AND year = $2',
  [userId, year]
);
const ageHours = (Date.now() - new Date(rows[0].generated_at)) / 3_600_000;

// 수정 후 (DB 내부에서 계산)
const { rows } = await pool.query(
  `SELECT data, EXTRACT(EPOCH FROM (NOW() - generated_at)) AS age_seconds
   FROM year_in_review_cache WHERE user_id = $1 AND year = $2`,
  [userId, year]
);
const ageHours = rows[0].age_seconds / 3600;
```

**근본 해결책**: 컬럼 타입을 `TIMESTAMPTZ`로 변경하면 pg가 UTC로 정확히 파싱한다.
단기 패치로 `EXTRACT` 방식을 적용했고, 추후 컬럼 타입 마이그레이션 검토 필요.

## 이력서 소재 한 줄

PostgreSQL TIMESTAMP 컬럼을 Node.js pg 클라이언트가 서버 로컬 TZ로 파싱하는 특성을 디버깅해, `EXTRACT(EPOCH FROM (NOW()-col))` 패턴으로 timezone 독립적 캐시 TTL 비교를 구현함.
