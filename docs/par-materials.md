# 이력서 소재 모음

> PAR 형식: Problem → Action → Result

---

## 프로젝트: 미디어 다이어리 웹 서비스

### 소재 1 — React StrictMode 비동기 루프 디버깅

**Problem (상황/문제)**
> 개발 환경에서 비동기 루프가 1건만 처리하고 멈추는 버그가 발생했고 원인을 특정할 수 없었다.

**Action (내가 한 것)**
> 콘솔 로그로 범위를 좁혀나가다 React StrictMode가 개발 환경에서 effect를 mount → unmount → mount 순서로 두 번 실행한다는 메커니즘을 파악했다. cleanup 함수의 `cancelled = true`가 첫 루프를 중단시키고, 두 번째 실행은 ref 플래그에 막혀 시작도 못 하는 구조임을 확인했다. cleanup 제거 + `useRef` 단일 실행 플래그 패턴으로 수정했다.

**Result (결과)**
> 178건 순차 API 처리가 정상 동작하도록 수정했고, StrictMode 환경에서 비동기 루프를 안전하게 실행하는 패턴을 확립했다.

---

### 소재 2 — TMDB API 설계 파악 및 DB 데이터 복구

**Problem (상황/문제)**
> 미디어 제목 자동 동기화 기능 실행 후 DB 178건의 제목이 전혀 다른 작품명으로 오염되었다. (`이웃집 토토로` → `뽀빠이`, `살인의 추억` → `어벤져스`)

**Action (내가 한 것)**
> TMDB의 movie ID와 TV ID가 완전히 독립된 네임스페이스를 사용한다는 구조를 파악했다. anime 항목을 `tv` 타입으로 조회했을 때 동일한 숫자 ID가 전혀 다른 TV 프로그램을 가리켰던 것이 원인이었다. Supabase SQL Editor에서 즉시 삭제 후 재시딩으로 데이터를 복구했고, 타입 추측 기반 동기화 설계를 철회했다.

**Result (결과)**
> 데이터 무결성을 복구했다. 이후 사용자가 TMDB 검색 결과를 직접 선택해 추가하는 방식으로 전환해 tmdb_id와 타입이 항상 정확히 매핑되도록 구조를 개선했다.

---

### 소재 3 — 실시간 검색 UX 개선

**Problem (상황/문제)**
> 검색창에 제목을 입력한 후 Enter 또는 버튼을 클릭해야 결과가 나타나, 사용자 경험이 불편했다.

**Action (내가 한 것)**
> 400ms 디바운스 `useEffect` 패턴을 적용해 타이핑 즉시 TMDB API를 호출하고 결과를 갱신하도록 수정했다. 디바운스로 과도한 API 호출을 방지하면서 실시간 응답성을 확보했다.

**Result (결과)**
> 구글·네이버 검색창과 동일한 자동완성 UX를 구현했고, 불필요한 API 호출 없이 타이핑 중 즉시 결과가 표시된다.

---

### 소재 4 — 단일 파일 950줄 → 컴포넌트/훅 아키텍처 분리

**Problem (상황/문제)**
> HomePage.jsx 단일 파일이 950줄에 달해 기능 추가 시 충돌 위험이 높고, 어느 코드가 어떤 역할인지 파악하기 어려웠다.

**Action (내가 한 것)**
> UI 렌더링(components/), 상태·비즈니스 로직(hooks/), 상수(utils/) 세 레이어로 분리 기준을 세웠다. 컴포넌트는 props만 받아 렌더링, 훅은 API 호출·상태 관리, 유틸은 무상태 상수로 역할을 명확히 나눴다. 총 8개 컴포넌트 + 2개 훅 + 1개 유틸로 분리했다.

**Result (결과)**
> HomePage.jsx가 250줄로 감소했다. 새 기능(PosterPicker, CsvImportModal, StatsPage 등)을 파일 하나 추가하는 방식으로 독립적으로 구현할 수 있는 구조가 됐다.

---

### 소재 5 — API 키 보안 처리 (프록시 패턴)

**Problem (상황/문제)**
> TMDB API 키가 프론트엔드 소스코드에 하드코딩되어 GitHub에 노출돼 있었다. 포트폴리오 제출 시 보안 결함으로 지적될 수 있었다.

**Action (내가 한 것)**
> 백엔드에 `GET /api/tmdb/*` 프록시 라우터를 신설하고, API 키를 `backend/.env`의 환경변수로 이전했다. 프론트엔드는 백엔드 프록시를 경유해 TMDB를 호출하도록 `api/tmdb.js` 모듈을 신설했다. Express 5의 path-to-regexp Breaking Change(`*` 와일드카드 불가)를 정규식(`/(.*)/)`)으로 우회했다.

**Result (결과)**
> API 키가 소스코드에서 완전히 제거됐다. 프록시 패턴으로 향후 Rate Limit, 캐싱, 로깅을 백엔드에서 일괄 관리할 수 있는 확장 구조가 됐다.

---

### 소재 6 — 데이터 시각화 통계 페이지 구현 (Recharts)

**Problem (상황/문제)**
> 178건의 미디어 데이터가 쌓여 있지만 수치로만 보여져 패턴을 파악하기 어려웠다.

**Action (내가 한 것)**
> Recharts 라이브러리로 분류 도넛 파이차트, 연대별 바 차트, 별점 분포 차트, GitHub 잔디 스타일 활동 캘린더를 구현했다. watched_at TIMESTAMP 컬럼을 DB에 추가하고 리뷰 저장 시 갱신해 감상 날짜 기반 통계를 지원했다.

**Result (결과)**
> `/stats` 라우트로 분리된 통계 페이지를 구현했다. 사용자가 "어떤 연대 영화를 주로 봤는지", "별점 경향" 등 자신의 감상 패턴을 시각적으로 파악할 수 있다.

---

### 소재 7 — Spotify Wrapped 스타일 연말 결산 페이지 구현

**Problem (상황/문제)**
> 1년 치 감상 기록이 쌓여있지만 사용자가 자신의 취향을 한눈에 회고할 방법이 없었다. SNS 공유용 바이럴 기능도 없었다.

**Action (내가 한 것)**
> Spotify Wrapped 스타일의 9슬라이드 연간 결산 페이지를 구현했다. 백엔드에서 총 감상 수·시청 시간·장르 분포·감독 TOP 3·월별 추이·YoY 비교를 단일 API로 집계하고 1시간/영구 캐시를 적용했다. 프론트엔드는 CSS transition 기반 슬라이드, 키보드 방향키 지원, html2canvas PNG 저장을 구현했다.

**Result (결과)**
> `/year-in-review/:year` 경로로 접근 가능한 풀스크린 회고 페이지 완성. Spotify Wrapped와 동일한 UX로 연간 감상 패턴을 시각화하고 PNG로 저장·공유할 수 있다.

---

### 소재 8 — PostgreSQL Timezone 버그 디버깅

**Problem (상황/문제)**
> 연말 결산 캐시가 1시간 TTL로 설계됐으나 매번 `cached: false`를 반환하며 재계산이 일어났다. console.log 추가 후 `ageHours: 9.031`로 캐시가 항상 9시간 전 것으로 인식되는 것을 발견했다.

**Action (내가 한 것)**
> pg 클라이언트가 `TIMESTAMP WITHOUT TIME ZONE` 컬럼을 서버 로컬 TZ(KST, UTC+9)로 파싱하고, JavaScript `Date.now()`는 UTC 기준이어서 9시간 차이가 발생한다는 원인을 규명했다. 해결책으로 JavaScript에서 비교하는 대신 `EXTRACT(EPOCH FROM (NOW() - generated_at))`로 DB 내부에서 경과 시간을 계산하도록 변경했다.

**Result (결과)**
> TZ 설정에 무관하게 정확한 캐시 TTL이 동작하게 됐다. Node.js + PostgreSQL 환경에서 재사용 가능한 timezone-safe 패턴을 확립했다.

---

### 소재 9 — Phase 5 전체 기능 감사 프로세스 설계 및 실행

**Problem (상황/문제)**
> 6개 Phase(5.1~5.6)를 단기간에 구현한 후 체크박스 표시만으로는 실제 동작 여부를 보장할 수 없었다. 선언과 구현이 다른 경우가 실제로 존재할 수 있었다.

**Action (내가 한 것)**
> 6단계 감사 프로세스(ROADMAP 체크박스 대조 → API 직접 호출 → DB 스키마 확인 → 프론트 컴포넌트 확인 → 코드 품질 → 보고서)를 직접 설계하고 실행했다. PowerShell로 실제 API를 호출해 응답을 검증했고, 3개 버그와 3개 누락 항목을 발견해 즉시 수정했다.

**Result (결과)**
> 감사를 통해 발견된 6개 항목을 모두 수정·보완했다. 특히 캐시 timezone 버그와 ON CONFLICT 오류는 감사 없이는 운영 환경에서 발견됐을 문제였다. 체계적인 감사 프로세스의 필요성을 실증했다.

---

### 소재 10 — DB UNIQUE 제약 재설계로 재시청 기능 구현

**Problem (상황/문제)**
> `UNIQUE(user_id, title, year)` 제약으로 같은 작품을 두 번 이상 기록할 수 없었다. 장기 사용자가 재시청한 영화의 새로운 감상을 남길 방법이 없었다.

**Action (내가 한 것)**
> `rewatch_count INTEGER DEFAULT 1` 컬럼을 추가하고 UNIQUE를 `(user_id, title, year, rewatch_count)`로 확장해 재시청마다 별도 행이 생성되도록 했다. 기존 제약을 안전하게 DROP하고 새 인덱스를 생성하는 멱등성 마이그레이션을 작성했다.

**Result (결과)**
> 재시청 기록이 가능해졌고 시청 이력 조회 API(`GET /api/user-media/history/:tmdbId`)로 모든 회차를 확인할 수 있다. 카드에 🔁 N회 배지가 표시되어 재시청 작품을 한눈에 식별 가능하다.

---

### 소재 11 — 프론트엔드 API URL 환경변수 이전 (배포 준비)

**Problem (상황/문제)**
> 프론트엔드 18개 파일에 `http://localhost:4000`이 하드코딩되어 있어 개발·프로덕션 환경 분리가 불가능했다. Vercel + Render 배포 시 코드 수정 없이 URL을 바꿀 방법이 없었다.

**Action (내가 한 것)**
> `grep -rn "localhost:4000"` 으로 21곳을 전수 발견하고, Vite의 `import.meta.env.VITE_*` 패턴으로 일괄 교체했다. `frontend/.env`에 개발용 URL을 설정하고 Vercel 환경변수에 프로덕션 URL을 주입하는 구조를 만들었다. `fetch` 호출과 `axios` 모두 커버하기 위해 파일별로 직접 치환했다.

**Result (결과)**
> 18개 파일에서 하드코딩 URL이 완전히 제거됐다. `.env` 파일 한 줄만 바꾸면 환경 전환이 가능하며, Vercel CI/CD에서 빌드 시 자동으로 프로덕션 URL이 주입된다.

---

### 소재 12 — 자동 시딩 제거 (프로덕션 이슈 대응)

**Problem (상황/문제)**
> 배포 후 신규 가입자가 본인이 추가하지 않은 178건의 미디어 목록을 자동으로 보게 되는 문제가 발생했다. 개발 중 편의를 위해 만든 기능이 실제 서비스에서 비정상 동작을 유발했다.

**Action (내가 한 것)**
> `localStorage` seedKey 체크, `bulkSaveMedia` 호출, 기본 데이터 import를 `useMediaList.js`에서 전면 제거했다. 관련 state(`seedingMsg`)와 UI 참조도 정리했다. 백엔드 `/bulk` 엔드포인트는 CSV 가져오기에서 계속 사용되므로 유지했다.

**Result (결과)**
> 신규 가입자는 빈 목록으로 시작한다. 프로덕션 환경과 개발 환경의 동작이 일치하게 됐다.

---

### 소재 13 — 시청 날짜 소급 입력 기능 구현

**Problem (상황/문제)**
> 별점 저장 시 항상 현재 시각(`NOW()`)으로 `watched_at`이 기록됐다. 과거에 본 작품을 나중에 입력하거나, 특정 날짜를 기억하는 경우 정확한 날짜를 기록할 방법이 없었다.

**Action (내가 한 것)**
> 저장 버튼 위에 날짜 입력창(`<input type="date">`)과 "오늘 시청" 버튼을 추가했다. 프론트는 `watched_at_custom`을 context에 포함해 전송하고, 백엔드 PUT /:id 쿼리의 CASE 조건에 "custom date가 있으면 우선 사용" 분기를 추가했다. 날짜를 비워두면 기존 동작(NOW() or NULL)을 그대로 유지해 하위 호환성을 보장했다.

**Result (결과)**
> 과거 감상 날짜를 소급 입력할 수 있게 됐다. 연말 결산·캘린더 통계 등 `watched_at` 기반 기능이 더 정확한 데이터를 사용할 수 있다.

---

### 소재 14 — 큐레이션 데이터 자동화 파이프라인 구축

**Problem (상황/문제)**
> 신규 가입자가 빈 화면에서 과거 기록을 추가하기 매우 어려웠다. 12개 카테고리 247개 작품의 TMDB ID와 포스터 경로를 모두 수동으로 수집하는 것은 불가능했다.

**Action (내가 한 것)**
> 3단계 자동화 파이프라인을 설계했다: ① `fill-tmdb-ids.js` — JSON에서 tmdb_id: 0 항목을 TMDB Search API로 검색해 자동 매칭 (Rate Limit 준수 260ms 딜레이, 연도 없이 재시도 fallback 포함) ② `fetch-curation-posters.js` — TMDB Detail API로 포스터 경로 수집 ③ `seed-curation.js` — ON CONFLICT UPDATE로 멱등 DB 삽입. 프론트엔드는 `already_added` 소프트 인증 패턴으로 비로그인도 조회 가능하게 했다.

**Result (결과)**
> 스크립트 1회 실행으로 64개 TMDB ID 자동 매칭, 233개 포스터 수집 완료. 큐레이션 API는 순수 DB 조회로 빠르게 응답. JSON 파일 수정 → 스크립트 재실행으로 언제든 데이터 업데이트 가능한 구조가 됐다.

---

### 소재 15 — Claude API Tool Use로 자연어 기억 복원 시스템

**Problem (상황/문제)**
> "90년대 SF 영화 좋아했어요"처럼 막연한 기억을 작품 목록으로 변환해야 했다. Claude 텍스트 응답을 정규식·JSON.parse로 파싱하면 구조 실패 시 기능 전체가 무너지는 위험이 있었다.

**Action (내가 한 것)**
> Claude API의 `tool_choice: { type: "any" }`로 도구 호출을 강제했다. `suggest_works` 도구 스키마에 title, original_title, year, tmdb_type, media_type을 정의해 항상 구조화된 배열을 받도록 했다. 도구 결과를 TMDB API로 보강(tmdb_id, poster_path)한 뒤 memory_chats 테이블에 저장했다. 사용자 기존 목록을 시스템 프롬프트에 포함해 중복 제안을 방지했고, 일일 30회 한도와 날짜별 자동 리셋을 구현했다.

**Result (결과)**
> 자연어 대화 → 포스터 카드 그리드 → 체크박스 선택 → 일괄 추가 흐름이 완성됐다. tool_choice 강제로 파싱 오류 없이 안정적으로 동작하며, original_title 필드로 TMDB 매칭 정확도도 향상됐다.

---

### 소재 16 — 멀티 스크린샷 인식 강화 (신뢰도 기반 매칭)

**Problem (상황/문제)**
> 기존 스크린샷 인식은 이미지 1장만 지원하고, OTT 앱 종류 힌트 없이 제목만 추출했다. TMDB 매칭 정확도가 낮았고 실패 항목을 사용자가 수정할 방법이 없었다.

**Action (내가 한 것)**
> multer를 `upload.single` → `upload.array('images', 10)`으로 변경해 최대 10장 병렬 처리를 지원했다. Claude 프롬프트에 OTT 종류 힌트(넷플릭스·CGV 등 9종)를 삽입하고, 제목만이 아닌 `{title, year, type}` 구조화 JSON을 추출하도록 개선했다. TMDB 검색을 3단계 fallback(연도 포함 → 없음 → 반대 타입)으로 구성하고, `calcConfidence()` 함수로 제목 유사도·연도 일치를 0~1 점수로 계산했다. 낮은 신뢰도 항목에 `InlineSearch` 컴포넌트(실시간 TMDB 검색 + 클릭 교체)를 제공했다.

**Result (결과)**
> 멀티 업로드로 1회 세션에서 여러 OTT 기록을 처리할 수 있고, 신뢰도 배지(높음/보통/낮음)로 결과 품질을 시각화했다. 실패 항목도 수동 재검색으로 커버 가능해 전반적인 가져오기 성공률이 높아졌다.

---

### 소재 17 — Letterboxd CSV 가져오기 (외부 라이브러리 없는 내장 파서)

**Problem (상황/문제)**
> Letterboxd 사용자가 자신의 감상 기록(수백~수천 건)을 마이그레이션할 방법이 없었다. csv-parse 등 외부 라이브러리를 추가하면 의존성이 늘어나고, Letterboxd CSV 형식에 특화된 처리가 필요했다.

**Action (내가 한 것)**
> 따옴표 필드를 지원하는 `parseCsvLine()`, 헤더 인덱스 기반 `parseLetterboxdCsv()` 함수를 20줄로 직접 구현했다. Letterboxd의 0.5~5.0 Rating을 앱 내 1~5로 `Math.round()` 변환하고, Watched Date를 watched_at으로 삽입했다. TMDB 검색(영화 → TV fallback), tmdb_id 기준 중복 체크, 일괄 삽입을 하나의 엔드포인트에서 처리했다.

**Result (결과)**
> 외부 의존성 없이 Letterboxd watched.csv를 그대로 업로드하면 자동으로 내 목록에 추가된다. 결과 화면에 "N편 추가 / M편 중복 / K편 실패"가 표시되어 가져오기 결과를 명확하게 파악할 수 있다.

---

### 소재 18 — 큐레이션 2단계 계층 UX (DB 컬럼 추가 없이 계층 분류)

**Problem (상황/문제)**
> 큐레이션 리스트가 12개에서 50개로 늘어나면서 flat 목록으로는 원하는 리스트를 찾기 어려워졌다. DB에 계층 컬럼을 추가하면 기존 시드 데이터와 마이그레이션 부담이 발생했다.

**Action (내가 한 것)**
> DB 변경 없이 프론트엔드에서 `SUPER_GROUPS` 상수를 정의하고, 각 서브그룹의 filter 함수가 기존 `category + region + media_type` 3개 필드 조합으로 리스트를 분류하도록 설계했다. 2단계 아코디언으로 최상위(영화/드라마/애니)를 열면 서브그룹(한국감독/해외감독/장르별 등)이 펼쳐지는 구조를 구현했다. 이 과정에서 `baeksang-drama-winners`가 kr-drama와 awards-drama 양쪽에 중복 표시되는 버그를 발견해 filter 조건에 `&& l.category !== 'awards'`를 추가해 수정했다.

**Result (결과)**
> DB 마이그레이션 없이 50개 리스트를 3개 최상위 + 8개 서브그룹으로 정리했다. 필터 검색바와 결합해 원하는 리스트를 빠르게 찾을 수 있다.

---

### 소재 19 — TMDB 인물 검색 기반 작품 탐색 (Promise.all 병렬 처리)

**Problem (상황/문제)**
> 고정된 큐레이션 외 "이 감독 작품 다 봤나?", "이 배우 출연작 뭐가 있나?" 같은 수요를 충족할 방법이 없었다. 감독 credits와 배우 credits는 TMDB의 별개 엔드포인트에서 제공된다.

**Action (내가 한 것)**
> `/person/:tmdbId/works?type=director|actor` 엔드포인트를 설계하고, `Promise.all([movieCredits, tvCredits])`로 영화/TV 크레딧을 병렬 조회했다. 감독은 crew에서 job: 'Director', 배우는 cast 필터링으로 분리했다. 포스터 있는 작품 우선 정렬, already_added 마킹, tmdb_id 기준 중복 제거를 포함했다. Express에서 `/person/search`가 `/person/:tmdbId`로 오인되는 라우트 충돌을 리터럴 경로 우선 등록으로 해결했다.

**Result (결과)**
> 봉준호 검색 → 19개 감독 작품, 송강호 검색 → 49개 출연작이 already_added 상태와 함께 즉시 표시된다. 300ms 디바운스 PersonSearch 컴포넌트로 타이핑 중 실시간 인물 드롭다운이 나타난다.

---

### 소재 20 — 50개 리스트 / 573개 아이템 데이터 감사 프로세스

**Problem (상황/문제)**
> Phase 7 구현 후 DB에 50개 리스트 / 573개 아이템이 존재하지만, TMDB ID가 0으로 잘못 저장된 항목이 있으면 포스터도 없고 bulk-add도 의미 없는 "빈 껍데기" 데이터가 된다.

**Action (내가 한 것)**
> Node.js DB 쿼리로 리스트 수, 아이템 수, tmdb_id = 0 항목, 포스터 NULL 항목을 체계적으로 집계했다. 미매칭 5개를 식별하고 TMDB API를 직접 호출해 올바른 ID를 확인한 뒤 DB UPDATE + JSON 파일 수정을 동시에 진행했다. (Somewhere=39210, Asteroid City=747188, Heavenly Creatures=1024, Right Now Wrong Then=354275, Sacro GRA=216790)

**Result (결과)**
> TMDB 미매칭 5개 → 0개. 포스터 없는 18개는 TMDB 원본이 없는 정상 케이스로 확인했다. DB와 JSON 소스 파일이 동기화된 상태로 유지돼 재시딩 시에도 동일한 결과를 보장한다.

---

### 소재 21 — AI 결제 토큰 시스템 설계 및 구현 (토스페이먼츠 연동)

**Problem (상황/문제)**
> AI 기능 남용을 막고 서비스 지속 가능성을 확보해야 했다. 기존 일일 횟수 제한 방식은 기능별 비용 차이를 반영하지 못하고, 배포 후 비용 통제 수단이 없었다.

**Action (내가 한 것)**
> 토큰 경제(token economy) 구조를 설계했다. DB에 `token_balance`, `payment_history`, `token_usage_log` 테이블을 신설하고, `requireTokens(n, feature)` + `deductTokens()` 미들웨어로 AI 엔드포인트마다 기능별 비용(chat 2토큰, screenshot 3토큰, report 5토큰)을 차감했다. AI 호출 실패 시 차감하지 않는 성공 후 차감 원칙을 적용했다. 토스페이먼츠 단건결제 REST API를 직접 연동했고, 금액 서버 검증·중복 order_id 차단·첫충전 보너스 트랜잭션을 구현했다.

**Result (결과)**
> 신규 가입자 50토큰 지급, 차감·충전·환불·Webhook 전 흐름을 E2E 테스트로 검증했다. 사용량 대시보드(PieChart + BarChart)로 기능별 소비 패턴을 시각화해 사용자에게 투명하게 제공한다.

---

### 소재 22 — html2canvas CORS 오염 디버깅 및 포스터 프록시 패턴 도입

**Problem (상황/문제)**
> Spotify Wrapped 스타일 연말 결산 PNG 저장 기능에서 포스터가 X박스로 렌더링됐다. 로컬 환경에서만 재현되지 않아 원인 파악이 어려웠다.

**Action (내가 한 것)**
> 두 가지 원인을 규명했다. ① 앱 곳곳의 일반 `<img>` 태그가 `crossOrigin` 속성 없이 TMDB URL을 로드해 브라우저 캐시를 오염시켰고, html2canvas가 CORS 캐시 충돌로 이미지를 읽지 못했다. ② html2canvas 호출 시점에 이미지가 아직 로딩 중이었다. 백엔드에 `/api/proxy/poster` 엔드포인트(TMDB 도메인만 허용, SSRF 방어, 1주일 캐시, CORS 헤더)를 신설해 프록시 URL로 요청했다. 프록시 URL은 원본과 다르므로 캐시 충돌이 없고, `Promise.all` 프리로딩으로 렌더링 전 로딩을 완료했다.

**Result (결과)**
> PNG 저장 시 포스터가 정상 렌더링됐다. 프록시 패턴은 향후 이미지 최적화·캐싱·Rate Limit 관리를 백엔드에서 일괄 적용할 수 있는 구조도 된다.

---

### 소재 23 — AI 채팅형 맥락 추천 시스템 (/discover/chat)

**Problem (상황/문제)**
> 기존 "오늘의 추천"은 취향 프로필 기반 정적 리스트라 대화 맥락이 없었다. "요즘 힐링 영화 보고 싶어", "박찬욱 다 봤는데 비슷한 감독 있어?" 같은 자연어 수요를 충족하지 못했다.

**Action (내가 한 것)**
> `discovery_chats` 테이블로 세션 단위 대화 이력을 관리했다. 클라이언트에서 `crypto.randomUUID()`로 session_id를 생성해 별도 서버 세션 없이 대화 연속성을 구현했다. Claude 호출 시 취향 프로필(장르·감독 선호)과 최근 감상 목록을 시스템 프롬프트에 포함해 맥락을 인식하고, 추천 결과를 포스터 카드로 렌더링한 뒤 위시리스트 즉시 추가 인라인 액션을 제공했다.

**Result (결과)**
> 대화 흐름 내에서 맥락이 이어지는 추천이 가능해졌다. 세션당 2토큰으로 비용을 통제하면서 ChatGPT 스타일 AI 추천 UX를 구현했다.

---

### 소재 24 — 리포트 커스터마이징: 16개 항목 선택 + AI 자동 구성

**Problem (상황/문제)**
> 월간 리포트가 고정된 4개 섹션만 생성해 사용자마다 다른 관심사(장르 분석, 재시청 패턴, 함께 본 사람 통계 등)를 반영하지 못했다.

**Action (내가 한 것)**
> 16개 리포트 항목(`REPORT_COMPONENTS`)과 항목별 Claude 지시문(`COMPONENT_PROMPTS`)을 정의했다. 사용자가 항목을 체크박스로 직접 선택하거나 자연어로 설명하면 Claude가 적합한 4~8개 항목을 자동 선택(2토큰)하도록 했다. 선택한 항목을 `report_templates` DB에 저장하고, 리포트 생성 시 `templateId`로 조회해 선택된 항목의 `COMPONENT_PROMPTS`만 Claude에 전달하는 동적 지시문 구성 방식을 적용했다. 실시간 미리보기(5토큰)로 저장 전 결과를 확인할 수도 있다.

**Result (결과)**
> 사용자마다 다른 리포트를 생성할 수 있는 커스터마이징 시스템이 완성됐다. AI가 자연어로 항목을 선택해주는 메타 AI 기능과, 저장 없이 즉시 확인하는 미리보기 UX까지 갖췄다.

---

## 키워드 뱅크 (기술 스택 & 성과 표현)

- React, Vite, Zustand, React Router
- Node.js, Express, PostgreSQL, Supabase
- JWT 인증, REST API 설계
- TMDB API 연동, 외부 API 클라이언트
- 배치 INSERT 최적화, UNIQUE 제약조건 upsert
- React StrictMode, useEffect 생명주기
- 디바운스, 실시간 검색 UX
- DB 데이터 복구, 무결성 관리
- 컴포넌트/훅/유틸 아키텍처 분리, 관심사 분리 (SoC)
- API 키 환경변수 관리, 백엔드 프록시 패턴
- Recharts, 데이터 시각화 (파이/바/캘린더 차트)
- watched_at DB 컬럼 설계, ALTER TABLE 마이그레이션
- Express 5 Breaking Change 대응 (path-to-regexp)
- CSV 파싱/생성, BOM UTF-8, 파일 업로드 UX
- 모바일 반응형 CSS (미디어 쿼리, 하단 시트 모달)
- Spotify Wrapped 스타일 슬라이드 UX, html2canvas PNG 저장
- 연간 데이터 집계 API, JSONB 캐시 설계 (PostgreSQL)
- TIMESTAMP vs TIMESTAMPTZ, pg 클라이언트 TZ 파싱 특성
- EXTRACT(EPOCH FROM ...), timezone-safe DB 비교 패턴
- UNIQUE 제약 재설계 (재시청 지원), 멱등성 마이그레이션
- ON CONFLICT 제약 참조 일관성 관리
- 체계적 QA 감사 프로세스 (6단계, API E2E 검증)
- FAB 플로팅 버튼, 키보드 단축키 (Cmd+K)
- 시청 컨텍스트 메타데이터 설계 (watched_with, mood 등)
- 개인 위시리스트 (mark-as-watched 흐름, 우선순위 관리)
- Vite 환경변수 (`import.meta.env.VITE_*`), 개발/프로덕션 URL 분리
- 하드코딩 URL 전수 grep → 일괄 환경변수 이전 (18개 파일)
- 자동 시딩 제거, 프로덕션 이슈 대응, 신규 가입자 UX 개선
- watched_at 소급 입력, nullable custom date, CASE 우선순위 쿼리
- Render `npm start` / Vercel CI 배포 환경변수 설계
- Claude API tool_choice: any, 강제 도구 호출 패턴
- Tool Use 스키마 설계 (title, original_title, year, tmdb_type, media_type)
- 배치 TMDB API 스크립트 (Rate Limit, 재시도 fallback, 멱등 upsert)
- 큐레이션 데이터 파이프라인 (JSON → fill IDs → fetch posters → seed DB)
- 멀티 이미지 업로드 (multer array), 병렬 Claude Vision 처리
- OTT 종류 힌트 기반 Claude 프롬프트 최적화
- 신뢰도 계산 알고리즘 (제목 유사도 + 연도 일치 → 0~1 점수)
- InlineSearch 컴포넌트 (실시간 TMDB 재검색, 결과 인라인 교체)
- 5단계 온보딩 마법사 UX (아코디언, 프로그레스 바, 단계별 건너뛰기)
- 소프트 인증 패턴 (already_added 마킹, 비로그인 공개 조회)
- Letterboxd CSV 내장 파서 (따옴표 필드, 헤더 인덱스, Rating 변환)
- life_period 메타데이터 설계 (COALESCE 부분 업데이트, 자유 텍스트)
- 시청 시기 그룹 통계 (GROUP BY + json_agg, 가로 포스터 스크롤)
- 2단계 아코디언 UX (SUPER_GROUPS 계층 정의, filter 함수 기반 분류)
- category+region+media_type 3-key 계층 분류 (DB 컬럼 추가 없음)
- TMDB person credits (movie_credits + tv_credits, Promise.all 병렬)
- 감독/배우 크레딧 필터링 (crew job:'Director' vs cast)
- Express 라우트 순서 (리터럴 경로 우선 등록으로 충돌 방지)
- 시드 데이터 감사 (tmdb_id=0 항목 식별, DB + JSON 동기화)
- 데이터 파이프라인 멱등성 (ON CONFLICT UPDATE, fill → seed 재실행 가능)
- 300ms 디바운스 인물 검색 (PersonSearch, 프로필 드롭다운)
- 큐레이션 필터 검색바 (리스트 이름 실시간 필터링)
- 토큰 경제 설계 (requireTokens / deductTokens 미들웨어, 성공 후 차감 원칙)
- 토스페이먼츠 REST API 연동 (금액 서버 검증, 첫충전 보너스 트랜잭션, Webhook paymentKey 재조회)
- html2canvas CORS 오염 디버깅 (crossOrigin 캐시 충돌, 이미지 프리로딩 패턴)
- 백엔드 이미지 프록시 (SSRF 방어, TMDB 도메인 화이트리스트, 1주일 캐시)
- crypto.randomUUID() 클라이언트 세션 관리 (서버 세션 없이 대화 이력 연속성)
- prefers-color-scheme 자동 감지 (matchMedia 리스너, 3-way 다크모드)
- 리포트 항목 동적 구성 (COMPONENT_PROMPTS 매핑, templateId 기반 지시문 빌드)
- 자연어 → AI 항목 자동 선택 (Claude + JSON 배열 파싱, fallback 처리)
- 실시간 미리보기 (DB 저장 없는 임시 Claude 호출, 5토큰 확인 모달)

---

### 소재 — 큐레이션 데이터 품질 감사 및 자동 수정 시스템

**Problem (상황/문제)**
> 77개 큐레이션 리스트 794개 아이템의 TMDB ID를 기억에 의존해 수동 입력했는데, 검증 전까지는 오류 여부를 알 수 없었다. MCU 3개 ID가 순환으로 뒤바뀌거나, 감독 리스트에서 전혀 다른 영화 ID가 입력되는 등 구조적 오류가 누적된 상태였다.

**Action (내가 한 것)**
> TMDB API를 통해 794개 전체를 자동 검증하는 스크립트를 작성했다. ID 유효성과 반환 제목을 비교해 실제 오류와 한국어 번역 차이(false positive)를 분리했고, 잘못된 항목은 TMDB 텍스트 검색으로 올바른 ID를 재발견했다. DB 수정 시 ON CONFLICT 제약으로 UPDATE만으로는 부족해 '정상 ID 이미 존재하면 오류 항목 DELETE' 로직을 추가했다. MCU 3개 순환 swap은 임시값(999999) 경유 4단계 UPDATE로 해결했다.

**Result (결과)**
> 60건의 잘못된 TMDB ID를 수정하고 포스터 19개를 재수집했다. 검증 과정에서 Stage 8.3 배치 스크립트 버그로 기생충(496243)이 1917(530915)로 덮어씌워진 6개 리스트를 추가 발견·복구했다. CURATION_AUDIT.md 형태로 전체 감사 결과를 문서화했다.

**이력서 한 줄**
> 794개 큐레이션 데이터 TMDB API 전수 검증 자동화, 60건 오류 수정 및 데이터 품질 감사 문서 작성
