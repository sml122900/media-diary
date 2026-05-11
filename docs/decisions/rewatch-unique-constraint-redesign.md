# 기술 결정 — 재시청 지원을 위한 UNIQUE 제약 재설계

## Problem (상황/문제)

> 기존 `user_media`의 `UNIQUE(user_id, title, year)` 제약이 같은 작품을 한 번만 기록하도록 강제했다.
> 영화를 두 번 이상 보는 경우 새로운 시청 기록을 남길 수 없었다.

## Action (결정 및 근거)

> `rewatch_count INTEGER DEFAULT 1` 컬럼을 추가하고 UNIQUE를 `(user_id, title, year, rewatch_count)`로 확장했다.

- 기존 제약 `user_media_user_id_title_year_key` DROP
- `CREATE UNIQUE INDEX idx_user_media_rewatch ON user_media(user_id, title, year, rewatch_count)`

**왜 이 방식을 선택했나**:
- 첫 번째 시청: `rewatch_count=1` → 기존 행 업서트 가능 (ON CONFLICT)
- 두 번째 시청: `rewatch_count=2` → 새 행 생성 (충돌 없음)
- 포기한 대안: UNIQUE 자체를 제거 → 실수로 중복 추가되는 사고 방지 불가

**마이그레이션 전략**:
```sql
ALTER TABLE user_media ADD COLUMN IF NOT EXISTS rewatch_count INTEGER DEFAULT 1;
UPDATE user_media SET rewatch_count = 1 WHERE rewatch_count IS NULL;
ALTER TABLE user_media DROP CONSTRAINT IF EXISTS user_media_user_id_title_year_key;
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_media_rewatch ON user_media(user_id, title, year, rewatch_count);
```

`IF NOT EXISTS` / `IF EXISTS` 패턴으로 멱등성 확보.

## Result (결과)

> 같은 작품을 여러 번 시청 기록할 수 있고, 실수 중복 방지도 유지된다.
> `POST /api/user-media/:id/rewatch` 엔드포인트로 재시청 시 max(rewatch_count)+1 자동 계산.
> DetailModal에서 시청 이력 전체를 `GET /api/user-media/history/:tmdbId`로 조회 가능.

주의: 기존 `ON CONFLICT (user_id, title, year)` 구문이 있는 파일을 모두 수정해야 한다.
누락 시 500 오류 발생 (wishlist.js에서 실제로 발생, 감사에서 발견).
