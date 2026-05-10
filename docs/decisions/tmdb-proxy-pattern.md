# 기술 결정 — TMDB API 키 백엔드 프록시로 이전

## Problem (상황/문제)

> TMDB API 키가 프론트엔드 소스코드에 하드코딩되어 GitHub에 공개되어 있었다.
> TMDB read-only 키라 악용 위험은 낮지만, 포트폴리오 공개 시 보안 습관 문제로 지적받을 수 있다.

## Action (결정 및 근거)

> 백엔드 `GET /api/tmdb/*` 프록시 라우터를 신설하고, 프론트엔드는 해당 엔드포인트를 경유해 TMDB를 호출하도록 변경했다.

- 백엔드 `.env`에 `TMDB_API_KEY` 추가 (git 미포함)
- `frontend/src/api/tmdb.js` 생성: 백엔드 프록시를 호출하는 함수 모음
- 기존 TMDB 직접 호출 코드 전량 제거

## Result (결과)

> API 키가 소스코드에서 사라지고 환경변수로만 관리된다.
> 프록시 패턴으로 향후 TMDB 호출에 Rate Limit, 캐싱, 인증 추가가 용이해졌다.

주의: 이미 GitHub 히스토리에 키가 노출됐으므로 실제 운영 시에는 TMDB에서 키 재발급 필요.
