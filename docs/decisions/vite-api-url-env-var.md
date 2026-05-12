# 기술 결정 — Vite 환경변수로 API URL 분리 (VITE_API_URL)

## Problem (상황/문제)

> 프론트엔드 18개 파일에 `http://localhost:4000`이 하드코딩되어 있었다.
> 배포 환경(Vercel + Render)에서는 다른 URL을 사용해야 하는데
> 코드 수정 없이 환경을 전환할 방법이 없었다.

## Action (결정 및 근거)

> Vite의 `import.meta.env.VITE_*` 환경변수 패턴으로 전환했다.

```
# frontend/.env (로컬 개발, gitignore)
VITE_API_URL=http://localhost:4000

# Vercel 환경변수 (배포)
VITE_API_URL=https://your-render-url.onrender.com
```

```js
// 변경 전
const BASE = 'http://localhost:4000/api';

// 변경 후
const BASE = `${import.meta.env.VITE_API_URL}/api`;
```

**교체 범위**: grep으로 21곳 발견, 18개 파일 일괄 수정
- `api/`: auth.js(baseURL), tmdb.js(PROXY), userMedia.js(BASE), recommend.js(BASE)
- `components/`: AiSearchModal, DailyRecommendations, DetailModal(인라인 5곳), ScreenshotImportModal
- `pages/`: FeedPage, ListsPage, ComparePage, ReportsPage, PublicProfilePage, SettingsPage, StatsPage, WatchlistsPage, WishlistPage, YearInReviewPage

포기한 대안:
- Vite `proxy` 설정 → 빌드 결과물에는 작동 안 함, 개발 전용
- axios `baseURL` 전역 설정 → fetch 호출(tmdb.js)까지 커버 불가

## Result (결과)

> `frontend/.env` 한 줄만 바꾸면 개발/스테이징/프로덕션 환경 전환 가능.
> Vercel에 `VITE_API_URL` 환경변수를 추가하면 배포 빌드에서 자동 주입된다.
> 코드에 URL이 전혀 남지 않아 보안 리스크도 제거.
