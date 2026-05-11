# 기술 결정 — DB 시간 비교를 서버사이드 EXTRACT로 처리

## Problem (상황/문제)

> `year_in_review_cache` 테이블의 `generated_at TIMESTAMP` 컬럼을 pg가 서버 로컬 TZ(KST, UTC+9)로 파싱해
> JavaScript의 `Date.now()` (UTC 기준)와 비교하면 항상 9시간 차이가 발생했다.
> 결과적으로 1시간 TTL 캐시가 항상 만료된 것으로 판단되어 매 요청마다 재계산이 일어났다.

## Action (결정 및 근거)

> 시간 경과 계산을 JavaScript에서 하지 않고 PostgreSQL 내부에서 처리하도록 변경했다.

```js
// 변경 전 — JS에서 비교 (timezone 오차 발생)
const { rows } = await pool.query(
  'SELECT data, generated_at FROM cache WHERE user_id=$1 AND year=$2',
  [userId, year]
);
const ageHours = (Date.now() - new Date(rows[0].generated_at)) / 3_600_000;

// 변경 후 — DB에서 비교 (timezone 무관)
const { rows } = await pool.query(
  `SELECT data, EXTRACT(EPOCH FROM (NOW() - generated_at)) AS age_seconds
   FROM cache WHERE user_id=$1 AND year=$2`,
  [userId, year]
);
const ageHours = rows[0].age_seconds / 3600;
```

포기한 대안:
- `TIMESTAMPTZ`로 컬럼 타입 변경 → 이미 생성된 테이블이므로 `ALTER COLUMN TYPE` 마이그레이션 필요, 위험 부담
- `pg` 클라이언트 TZ 설정 (`pgPool.query("SET timezone = 'UTC'")`) → 모든 연결에 적용해야 해 부작용 가능성

## Result (결과)

> `EXTRACT(EPOCH FROM (NOW() - generated_at))`는 DB 서버 내부에서만 계산되므로
> Node.js 서버의 TZ 설정과 무관하게 항상 정확한 경과 시간을 반환한다.
> 연말 결산 캐시가 1시간 TTL 내에서 정상적으로 `cached: true`를 반환하게 됨.

재사용 패턴: 다른 캐시 테이블에도 동일하게 적용 권장.
향후 신규 테이블 설계 시 `TIMESTAMP`보다 `TIMESTAMPTZ` 사용이 더 안전하다.
