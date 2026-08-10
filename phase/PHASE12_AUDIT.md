# Phase 12.0 — 차별화 스프린트 사전 감사

> 읽기 전용 조사 문서. 코드 수정 없음. 사실만 기술, 개선 제안 없음.
> 작성일: 2026-08-11

---

## 1. 감상 전 요소 인벤토리

### 1-1. 시청 가능처(watch provider) 표시

| 항목 | 내용 |
|---|---|
| 컴포넌트 | `frontend/src/components/TmdbInfoPanel.jsx` |
| 호출 API | `GET /api/tmdb/:type/:id/watch/providers` (백엔드 `routes/tmdb.js`가 TMDB 프록시) → `frontend/src/api/tmdb.js`의 `fetchTmdbDetail()`이 `providers: { flatrate, rent, buy, link }` 형태로 가공 |
| 노출 위치 | `DetailModal.jsx` — "기본 정보 / 보러가기" 2탭 중 "보러가기"(`tab='ott'`) 탭에서 구독/대여/구매 OTT 로고 표시 (한국 리전 `KR` 고정) |
| 제거 시 영향 | `DetailModal.jsx`의 탭 UI(292~301행) 자체를 걷어내야 함. `TmdbInfoPanel.jsx`는 `tab='info'`(런타임·장르·줄거리)도 같은 컴포넌트가 담당하므로 컴포넌트 삭제가 아니라 `tab='ott'` 분기만 제거 필요. `fetchTmdbDetail()`의 `watch/providers` 병렬 호출 제거 가능 |

### 1-2. 랭킹/인기순 정렬 노출

| 항목 | 내용 |
|---|---|
| TMDB `vote_average` 표시 (정렬 아님, 정보성 배지) | `AddModal.jsx:169`, `AiSearchModal.jsx:155`, `WishlistPage.jsx:198` — 검색 결과 목록에 `★{vote_average}` 표시 |
| `popularity` 기준 정렬 | `frontend/src/api/tmdb.js` `searchTmdb()` — 붙여쓴 한글 쿼리 fallback 병합 시 관련도 정렬용(143~145행). 검색 결과 랭킹 UI 아님 |
| 큐레이션 "박스오피스" 카테고리 | `RestorePage.jsx` `SUPER_GROUPS`의 `boxoffice` 서브그룹(26행) — TMDB 흥행 순위 기반 리스트. 단, 이 페이지 전체는 "과거 기록 복원"(이미 본 작품을 일괄 추가) 목적, 감상 전 추천이 아님 |
| 제거 시 영향 | `vote_average` 표시 3곳은 각 파일의 해당 JSX 한 줄만 제거하면 됨. `boxoffice` 서브그룹은 `curation_lists` 테이블의 `category='boxoffice'` 데이터와 `RestorePage.jsx` 필터 항목 제거 필요 |

### 1-3. "볼만한 콘텐츠" 류 추천 섹션

| 항목 | 내용 | 유지/제거 |
|---|---|---|
| "내 취향 기반 추천" (오늘의 추천) | `DiscoverPage.jsx` — `GET /api/recommend/daily` (`backend/src/routes/recommend.js`). 별점 4+ 상위 5개 항목 기반 TMDB 추천 + 취향 장르 가중치 재정렬, 24h DB 캐시(`daily_recommendations` 테이블) | 검토 대상 (제거 후보) |
| "이 작품을 좋아하셨다면" | `SimilarRecommendations.jsx` (DetailModal 하단 삽입) — `GET /api/recommend/similar/:mediaId` (`recommend.js`). TMDB 추천 API + 취향 재정렬 + 시청 이력 필터, 24h DB 캐시(`recommendations` 테이블) | 검토 대상 (제거 후보) |
| 큐레이션 둘러보기(77개 리스트) | `DiscoverPage.jsx` 하단 배너 → `/restore`(`RestorePage.jsx`, `CurationListPage.jsx`) — 감독/수상작/국가/장르/프랜차이즈/드라마별 명작 리스트, 체크박스 일괄 추가. `backend/src/routes/curation.js` | 검토 대상 (제거 후보) — 단 "과거 기록 복원"용으로 설계돼 있어 감상 전 추천과 성격이 다름 |
| 감독/배우 자유 검색 → 작품 목록 | `RestorePage.jsx` (Phase 7.2) → `GET /api/curation/person/:tmdbId/works` | 위와 동일 맥락(과거 기록 복원 도구) |
| **discover/chat AI 채팅 추천** | `DiscoverChatPage.jsx` → `backend/src/routes/discover.js` | **유지 — 제거 대상 아님** (내 기록 기반 AI 발견, 핵심 차별점) |
| **restore/chat AI 채팅 복원** | `backend/src/routes/restore.js`의 `/chat` 계열 | **유지 — 제거 대상 아님** (동일 근거) |

### 1-4. 가격/구매 정보

- `TmdbInfoPanel.jsx`의 "구매"(`buy`) 항목이 OTT 구매 옵션 로고를 보여주나, 가격 숫자 자체는 표시하지 않음(로고만).
- `WishlistPage.jsx`의 `intended_platform`(위시리스트 아이템에 "어디서 볼 계획인지" 플랫폼 태그, `PLATFORMS` 상수: 넷플릭스·왓챠·웨이브·시즌·디즈니+·극장·기타)은 가격 정보가 아니라 사용자가 직접 입력하는 시청 예정처 메모.
- 별도의 가격/구매 UI(결제 연동, 대여료 등)는 발견되지 않음.

---

## 2. 중복 관람(N회차) 현황

**이미 허용되어 있고, 백엔드·프론트 모두 구현 완료 상태.**

- **스키마**: `user_media` 테이블 원래 제약은 `UNIQUE(user_id, title, year)`였으나, `ALTER TABLE ... DROP CONSTRAINT` 후 `rewatch_count` 컬럼을 추가한 복합 UNIQUE 인덱스로 교체됨:
  ```sql
  CREATE UNIQUE INDEX idx_user_media_rewatch ON user_media(user_id, title, year, rewatch_count)
  ```
  (`backend/src/app.js` 289~297행). `rewatch_count` 기본값 1.
- **API**: `POST /api/user-media/:id/rewatch` (`backend/src/routes/userMedia.js` 181행~) — 원본 항목의 `title`/`year` 기준 현재 최대 `rewatch_count`를 조회해 `+1`로 새 행 삽입. 별점·리뷰·시청일을 회차별로 독립 기록.
  - 조회용: `GET /api/user-media/history/:tmdb_id` — `rewatch_count ASC` 정렬로 전체 시청 이력 반환.
- **UI**:
  - `MediaCard.jsx` 25~26행 — `item.rewatch_count > 1`일 때 카드에 `🔁 N회` 배지.
  - `DetailModal.jsx` — "🔁 다시 봤어요" 버튼(494행~)으로 재시청 폼(별점/날짜/메모) 오픈, 저장 시 `/rewatch` 호출. "시청 이력" 섹션(477행~)에서 회차별 목록(회차·별점·날짜·메모) 표시.
  - **제약**: 재시청 버튼은 `item.tmdb_id > 0`(TMDB 매칭된 항목)일 때만 노출(494행). TMDB 미매칭 항목은 재시청 기록 불가.
- 결론: 마이그레이션 초안이 필요한 상태가 아님 — 이미 마이그레이션이 반영·배포된 상태(Phase 5.4 완료 항목).

---

## 3. 기록 엔트리 필드 현황

### 3-1. `user_media` 테이블 전체 필드 (`backend/src/app.js` CREATE TABLE + 이후 ALTER 누적)

| 컬럼 | 타입 | 비고 |
|---|---|---|
| `id` | SERIAL PK | |
| `user_id` | INTEGER FK | |
| `type` | VARCHAR(20) | movie/anime/drama |
| `title` | VARCHAR(500) | |
| `year` | INTEGER | |
| `director` | VARCHAR(500) | |
| `cast_info` | VARCHAR(500) | |
| `tmdb_id` | INTEGER | 0 = 미매칭 |
| `poster_url` | TEXT | |
| `rating` | INTEGER | 0~5 |
| `review_text` | TEXT | |
| `review_date` | VARCHAR(50) | |
| `watched_at` | TIMESTAMP | NULL 허용 |
| `created_at` | TIMESTAMP | |
| `is_public` | BOOLEAN | 리뷰 공개 여부 (Phase 4.2) |
| `runtime_minutes` | INTEGER | NULL 허용 (Phase 5.1/5.3) |
| `rewatch_count` | INTEGER | 기본 1 (Phase 5.4) |
| `watched_with` | TEXT | NULL 허용 (Phase 5.6) |
| `watched_at_place` | TEXT | NULL 허용 (Phase 5.6) |
| `mood` | TEXT | NULL 허용 (Phase 5.6) |
| `companion_names` | TEXT | NULL 허용 (Phase 5.6) |

**참고 — `life_period` 컬럼**: `backend/src/routes/userMedia.js`(131·151·163행)와 `me.js`(168~182행)가 `user_media.life_period`를 조회/갱신하고, `docs/daily/2026-05-13.md`(Phase 6.5.1)에 `user_media.life_period TEXT DEFAULT NULL`로 추가했다는 기록이 있으나, **`backend/src/app.js`의 `initDB()`에는 이 컬럼을 생성하는 `ALTER TABLE` 구문이 없음**(app.js 전체에서 `life_period` 미검출). 즉 실제 운영 DB에는 컬럼이 존재하나 앱 시작 시 자동 마이그레이션 스크립트에는 누락된 상태.

### 3-2. "함께 본 사람 / 장소 / 감정" 류 맥락 필드 — 존재함, 일부만 UI 노출

- `DetailModal.jsx`의 "시청 컨텍스트" 접이식 섹션(366~411행)에서:
  - **누구와**(`watched_with`): 프리셋 칩 4개(혼자/가족/친구/연인) 중 택1 — 자유 텍스트 아님.
  - **어디서**(`watched_at_place`): 프리셋 칩 4개(집/극장/이동 중/기타) 중 택1.
  - **기분**(`mood`): 자유 텍스트 입력.
  - **`companion_names`(동반자 실명 자유 텍스트) 컬럼은 DB·백엔드 PUT 라우트(`userMedia.js` 129·150·160행)에 존재하지만, 프론트엔드 어디에도 입력 UI가 없음** — 즉 API로는 저장 가능하나 앱 화면에서는 값을 넣을 방법이 없음.
- **시청 시기**(`life_period`, 자유 텍스트): "시청 날짜" 섹션에서 "기억이 안 나요" 선택 시 노출되는 별도 입력창(`DetailModal.jsx` 439~457행). `watched_with`/`mood`와 다른 섹션에 위치.

---

## 4. importScreenshot 파이프라인 구조

### 4-1. 흐름 요약 (`backend/src/routes/importScreenshot.js`, `POST /api/import/screenshot`)

1. **입력**: multer로 이미지 최대 10장(장당 5MB) + `ott_type` 힌트(넷플릭스/왓챠/티빙/디즈니+/쿠팡플레이/웨이브/CGV/메가박스/롯데시네마/기타) 멀티파트 업로드.
2. **AI 인식**: 이미지별로 병렬(`Promise.all`)로 Claude Vision(`claude-sonnet-4-6`, `max_tokens: 1500`) 호출. OTT 종류별 UI 패턴 힌트가 포함된 프롬프트(`services/screenshotPrompts.js`)로 "화면에 보이는 작품 제목 전부"를 JSON 배열(`title`/`year`/`type`)로 추출.
3. **병합**: 여러 이미지의 추출 결과를 `title.toLowerCase()` 기준으로 중복 제거해 하나의 리스트로 합침.
4. **매칭**: 병합된 각 항목을 TMDB로 검색(5단계 fallback: 원본제목+연도 → 정규화제목+연도 → 원본제목 → 정규화제목 → 반대타입 정규화제목). 매칭되면 제목 유사도(완전일치/포함/공통글자비율) + 연도 일치 보너스(+0.1) + popularity 보너스(+0.03~0.05)로 `confidence`(0~1) 산출, 신뢰도 내림차순 정렬.
5. **저장**: 이 라우트 자체는 저장하지 않음 — 프론트(`ScreenshotImportModal.jsx`)가 결과를 사용자에게 보여주고, 사용자가 체크박스로 선택한 항목만 기존 `onAdd` 콜백(`POST /api/user-media`)으로 개별 저장.

### 4-2. 스크린샷 1장에서 복수 작품 인식 가능 여부

**가능함.** `extractWorksFromImage()`가 이미지 1장당 작품 배열을 반환하며, 프롬프트가 명시적으로 "화면에 보이는 영화·드라마·애니메이션 작품 제목을 전부 찾아주세요"라고 지시함(왓챠 시청 기록처럼 세로 리스트형 화면 전제로 설계됨). 여러 장 업로드 시 이미지 간 결과는 제목 기준으로만 중복 제거됨(연도 구분 없음 — 동명이작 충돌 가능).

### 4-3. 벌크 처리 시 관찰되는 구조적 특성

- **토큰 차감 지점**: `requireTokens(5, 'screenshot')` 미들웨어가 요청 시작 시 잔액 확인(차감은 아직 안 함) → 추출 결과가 0건이면 `logZeroUsage`만 기록하고 차감 없이 응답 → 추출 결과가 1건 이상이면 TMDB 매칭까지 끝난 뒤 `res.json` 직전에 `deductTokens` 호출(fire-and-forget, `.catch`로만 로깅). **이미지 장수(1~10장)나 추출된 작품 수(1개~수십개)에 무관하게 요청당 고정 5토큰.**
- **매칭 실패 처리**: TMDB 검색 5단계 모두 실패하면 `result: null, confidence: 0`으로 반환. 프론트(`ScreenshotImportModal.jsx`)는 이를 "검색 결과 없음"으로 표시하고, `InlineSearch` 컴포넌트로 사용자가 수동 재검색(`GET /api/import/screenshot/search`)해 대체 가능. 재검색은 토큰 차감 없음(별도 라우트, `requireTokens` 미들웨어 없음).
- **관찰되는 잠재 병목**(사실 관찰, 제안 아님):
  - Claude Vision 호출이 이미지당 1회, `max_tokens: 1500`으로 고정 — 왓챠피디아 평가 목록형처럼 한 화면에 항목이 많은 스크린샷은 추출 항목 수·정확도가 응답 토큰 상한의 영향을 받을 수 있음(코드상 잘림 감지·재시도 로직 없음).
  - 이미지 최대 10장, 장당 5MB 제한 — 앱 하나의 전체 평가 목록(수십~수백 개)을 스크린샷 여러 장으로 나눠 올릴 경우 10장 제한에 걸릴 수 있음.
  - 병합 시 중복 제거 기준이 `title.toLowerCase()` 단일 키 — 동명이작(예: 리메이크작)이 있으면 하나로 합쳐져 유실됨(연도 미고려).
  - TMDB 검색이 항목별로 최대 5단계 순차 요청(항목 간은 `Promise.all` 병렬이지만 항목 내부는 순차 `await`) — 추출 항목 수가 많을수록 TMDB API 호출 총량이 선형 증가.
  - 전체 요청이 동기 처리(스트리밍/부분 응답 없음) — 이미지 10장 + 추출 항목 다수인 경우 사용자는 분석 완료까지 단일 로딩 상태(`analyzing`)로 대기.
  - 신뢰도 0.5 미만 항목은 자동 선택되지 않음(`autoSelected` 필터) — 목록형 스크린샷에서 다수 항목이 낮은 신뢰도로 나오면 사용자가 다건 수동 확인·재검색해야 할 가능성.

---

## 조사 방법 메모

코드베이스 직접 열람(Grep/Read) 기반. 실행 중인 애플리케이션이나 실제 DB에 접속해 확인하지 않았으므로, `life_period` 컬럼처럼 "코드가 참조하지만 마이그레이션 스크립트에는 없는" 항목은 실제 운영 DB 상태와 다를 수 있음(4-2/3-1 참고).
