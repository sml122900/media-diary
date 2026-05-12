# 기술 결정 — 신규 가입 시 자동 시딩 제거

## Problem (상황/문제)

> 개발 초기 테스트 편의를 위해 첫 로그인 시 178건의 기본 미디어 목록을 자동 삽입하는 코드가 있었다.
> 실제 배포 후 신규 가입자가 본인이 추가하지 않은 목록을 보게 되는 문제가 발생했다.
> 또한 개발자 개인 취향의 영화/애니 목록이 모든 신규 사용자에게 노출되는 것은
> 서비스 취지(개인 기록장)에도 맞지 않았다.

## Action (결정 및 근거)

> `useMediaList.js`의 시딩 로직을 전면 제거했다.

제거 항목:
- `localStorage` seedKey 체크 (`media_diary_seeded_${user.id}`)
- `bulkSaveMedia` 호출 및 import
- `DEFAULT_MOVIE`, `DEFAULT_ANIME`, `DEFAULT_DRAMA` import
- `seedingMsg` state (HomePage 참조도 제거)

포기한 대안:
- 관리자 전용 시딩 엔드포인트로 이전 → 실제 서비스에서 불필요
- 온보딩 화면에서 "예시 데이터로 시작하기" 선택지 제공 → 복잡도 대비 효용 낮음

## Result (결과)

> 신규 가입자는 빈 목록으로 시작한다.
> 직접 TMDB 검색 또는 단건/일괄 추가로 본인 목록을 구성한다.
> 백엔드 `/api/user-media/bulk` 엔드포인트는 CSV 가져오기 등에서 여전히 사용되므로 유지.
