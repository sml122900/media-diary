# 기술 결정 — 큐레이션 데이터 파이프라인 설계 (JSON → TMDB → DB)

## Problem (상황/문제)

> 12개 큐레이션 리스트, 247개 작품의 TMDB ID와 포스터 경로를
> 수동으로 입력하는 것은 불가능하다.
> 제목과 연도만 알고 있을 때 자동으로 TMDB ID를 채워야 했다.

## Action (결정 및 근거)

> 3단계 파이프라인 스크립트를 설계했다.

```
JSON 파일 작성 (tmdb_id: 0)
    ↓
fill-tmdb-ids.js  ← TMDB search API로 ID 자동 매칭
    ↓
JSON 파일 업데이트 (tmdb_id 채워짐)
    ↓
fetch-curation-posters.js  ← TMDB detail API로 poster_path 수집
    ↓
seed-curation.js  ← DB 일괄 삽입 (ON CONFLICT UPDATE)
```

각 스크립트 설계 원칙:
- `fill-tmdb-ids.js`: 260ms 딜레이로 Rate Limit 준수, 연도 없이 재시도 fallback
- `fetch-curation-posters.js`: DB에서 poster_path IS NULL 항목만 대상
- `seed-curation.js`: `ON CONFLICT (slug) DO UPDATE` — 재실행 안전

포기한 대안:
- TMDB ID 수동 입력 → 247개 불가
- 스크립트 없이 API 즉시 호출 → 페이지 로딩마다 TMDB 247회 호출

## Result (결과)

> fill-tmdb-ids.js 1회 실행으로 64개 자동 매칭 (1개만 수동).
> fetch-curation-posters.js로 233개 포스터 DB 사전 저장.
> 이후 큐레이션 API 응답은 순수 DB 조회로 빠르게 처리 가능.
> JSON 파일 수정 → 스크립트 재실행으로 언제든 데이터 업데이트 가능.
