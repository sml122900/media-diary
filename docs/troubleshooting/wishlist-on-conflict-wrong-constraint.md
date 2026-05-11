# Wishlist /watched에서 ON CONFLICT 제약 불일치 500 오류

## 문제 상황

`POST /api/wishlist/:id/watched` 호출 시 500 오류 발생.

```json
{ "success": false, "message": "there is no unique or exclusion constraint matching the ON CONFLICT specification" }
```

위시리스트 작품을 "봤어요!"로 user_media에 이동하는 기능이 전혀 동작하지 않는 상태.

## 시도한 것들

1. API 요청 본문 확인 → 정상
2. 위시리스트 항목 존재 여부 → 정상
3. 에러 메시지 해석 → `ON CONFLICT` 대상 제약 없음

## 최종 해결법

**원인**: Phase 5.4에서 재시청 지원을 위해 `UNIQUE(user_id, title, year)` 제약을 삭제하고
`UNIQUE INDEX(user_id, title, year, rewatch_count)`로 교체했다.
그런데 `wishlist.js`의 `/watched` 엔드포인트는 여전히 삭제된 제약을 참조하고 있었다.

```js
// 수정 전 — 존재하지 않는 제약 참조
ON CONFLICT (user_id, title, year) DO UPDATE SET ...

// 수정 후 — 새 인덱스와 일치
ON CONFLICT (user_id, title, year, rewatch_count) DO UPDATE SET ...
// + VALUES에 rewatch_count = 1 명시
```

**교훈**: UNIQUE 제약을 변경할 때 해당 제약을 참조하는 `ON CONFLICT` 구문이 있는 파일을
모두 grep으로 확인하고 함께 수정해야 한다.

```bash
grep -rn "ON CONFLICT (user_id, title, year)" backend/src/
```

## 이력서 소재 한 줄

DB UNIQUE 제약 재설계(재시청 지원) 후 연관된 ON CONFLICT 구문이 누락된 채 배포되어
발생한 500 오류를 감사 과정에서 발견, 전체 코드베이스 grep으로 영향 범위를 파악 후 수정함.
