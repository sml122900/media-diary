# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

---

## 프로젝트 개요

- **서비스명**: 미디어 다이어리
- **한 줄 설명**: 본인이 본 영화·애니·드라마를 기록하고 별점/리뷰를 관리하는 개인 미디어 기록장
- **기술 스택**: React + Vite / Node.js + Express / Supabase (PostgreSQL) / TMDB API
- **배포**: 미정
- **로컬 실행**: 프론트 5173 / 백엔드 4000

---

## 기술 스택 상세

### Backend
| 패키지 | 버전 | 용도 |
|---|---|---|
| express | ^5 | HTTP 서버 |
| pg | ^8 | PostgreSQL 클라이언트 (Supabase 연결) |
| bcrypt | ^6 | 비밀번호 해시 |
| jsonwebtoken | ^9 | JWT 발급/검증 |
| dotenv | - | 환경변수 |
| nodemon | ^3 | 개발용 자동 재시작 |

### Frontend
| 패키지 | 버전 | 용도 |
|---|---|---|
| react | ^19 | UI 라이브러리 |
| vite | ^8 | 번들러 / dev server |
| axios | ^1 | HTTP 클라이언트 |
| react-router-dom | ^7 | 클라이언트 사이드 라우팅 |
| zustand | ^5 | 전역 상태 관리 (인증) |

### 외부 API
- **TMDB API** — 영화/애니/드라마 포스터, 상세 정보, OTT 스트리밍 정보 (백엔드 프록시 경유)
- **recharts** — 통계 페이지 차트 (파이/바/캘린더)

---

## 현재 진행 상황

**완성 (2026-05-14 기준)**
- 회원가입/로그인, JWT 인증, 로그인 상태 유지
- 탭 전환 (영화/애니메이션/드라마), 10년 단위 섹션 그룹핑
- 카드 그리드, TMDB 포스터 프리패치, 상세 모달
- 미디어 추가(TMDB 검색·단건/일괄)/편집/삭제/분류 변경
- 포스터 수동 교체 (PosterPicker 모달)
- 실시간 검색 + 필터 패널 (감독/별점/연도 범위)
- 홈 위젯: 이번 달·올해 감상 수+시청 시간, 최근 감상 가로 스크롤
- 통계 페이지 (/stats): 도넛/바/캘린더 차트 + 시청 시간 카드
- CSV 내보내기 / CSV 가져오기 (미리보기·중복처리)
- 모바일 반응형 (2열 그리드, 하단 시트 모달)
- TMDB API 키 백엔드 프록시 이전
- Phase 3: AI 검색, 취향 프로필, 오늘의 추천, AI 리포트
- Phase 4: 공개 프로필, 팔로우/피드, 공유 워치리스트, 리스트
- Phase 5.1: 연말 결산 (Spotify Wrapped 스타일 9슬라이드, PNG 저장)
- Phase 5.2: 개인 위시리스트 (/wishlist, /api/me/watchlist)
- Phase 5.3: 시청 시간 합산 (API + StatsPage 카드 + 홈 위젯)
- Phase 5.4: 재시청 추적 (rewatch_count, 이력 조회, 🔁 배지)
- Phase 5.5: 빠른 입력 (FAB, Cmd+K, QuickInputModal, 토스트)
- Phase 5.6: 시청 컨텍스트 (watched_with/place/mood, DetailModal 섹션)
- Phase 6.1: 큐레이션 체크 (50개 리스트 포스터 그리드, already_added 마킹)
- Phase 6.2: AI 대화형 기억 복원 (Claude Haiku tool_choice:any, 일일 30회 한도)
- Phase 6.3: 스크린샷 인식 강화 (멀티 업로드, OTT 힌트, 신뢰도 배지, 수동 재검색)
- Phase 6.4: 통합 온보딩 마법사 (/onboarding, 5단계, 신규가입자 자동 진입)
- Phase 6.5: 시청 시기 태그 (life_period) + Letterboxd CSV 가져오기
- Phase 7.1: 큐레이션 50개 확장 (573개 아이템, 7개 JSON 시드 파일 추가)
- Phase 7.2: 자유 인물 검색 (TMDB person API, 감독/배우 전작 그리드)
- Phase 7.3: 2단계 아코디언 UX + 필터 검색바 (영화/드라마/애니 3대 카테고리)
- Phase 8.1~8.6: UX 개선 (회원탈퇴, 큐레이션 추가, 스크린샷 정확도, 상세모달 재설계, 시청날짜 입력 개편, 재시청 UX)
- 큐레이션 데이터 전수 검증: TMDB ID 60건 수정, 포스터 재수집, CURATION_AUDIT.md 작성
- Phase 9: AI 토큰 결제 시스템 (토스페이먼츠 단건결제, 토큰 차감 미들웨어, 결제 UI, 약관, 사용량 대시보드)
- Phase 10.1: YIR 포스터 X박스 수정 (백엔드 이미지 프록시 /api/proxy/poster, SSRF 방어)
- Phase 10.2: 다크모드 토글 제거 + useTheme 자동 감지 (prefers-color-scheme, SettingsPage 3-way 선택)
- Phase 10.3: 스크린샷 인식 모델 Haiku → Sonnet 업그레이드
- Phase 10.4: /discover 추천 페이지 분리 (24시간 캐시, 홈 링크 카드)
- Phase 10.5: AI 채팅형 추천 (/discover/chat, discovery_chats 테이블, 세션 대화 이력, 2토큰)
- Phase 10.6: 리포트 커스터마이징 (report_templates 테이블, 16개 항목, AI 자동 선택 2토큰, 실시간 미리보기 5토큰)
- Phase 10 감사 + 개선: 사용량 통계 동적 집계 (전 feature), discover_chat/report_chat 표시 추가
- Phase 11.1.1: PWA 매니페스트 & 아이콘 (manifest.json, favicon.svg 기반 PNG 아이콘, index.html 메타 태그)
- Phase 11.1.2: 세로 모드 고정 결정
- Phase 11.2.1: Capacitor 프로젝트 셋업 (core/cli/android 설치, appId com.mediadiary.app, AndroidManifest screenOrientation=portrait, gradlew assembleDebug 빌드 검증)
- 배포/검색 버그 수정 묶음 (2026-07-30): Vercel SPA 404 (vercel.json), TMDB 단일검색 페이지네이션 누락 (3페이지 병합), 검색 띄어쓰기 미스매치 (내 목록 정규화 + TMDB 공백 삽입 fallback), 토큰 잔액 🪙 이모지 tofu 렌더링 → SVG 아이콘(TokenIcon) 교체
- 모바일 메뉴 오버레이 드로어 전환 (2026-08-02): 600px 이하에서 헤더 드롭다운이 뷰포트를 −6px 이탈해 항목 첫 글자가 잘리던 문제를 `position: fixed` 우측 드로어 + 백드롭으로 해결, 데스크톱 무변경. 실기기(갤럭시) APK 설치로 동작 확인 완료

- 실기기 전수 테스트 + 발견 이슈 수정 (2026-08-05): 갤럭시 SM-S942N(Android 16)에서 7개 항목 점검 → 통계 페이지 가로 깨짐(`.chart-card min-width:0`), 연대별 정렬 NaN, 다크모드 하드코딩 색상 일괄 정리, Phase 10 라이트 모드 지원(`useTheme` 루트 호출), 모달 뒤로가기, 토큰 배지 즉시 갱신, 스크린샷 빈 결과 무차감. 커밋 `0a037e2`·`060ae76`·`aebed00`·`af041c2`

**진행 중:** Phase 11 (Google Play Store 출시) — Stage 11.2 Capacitor 셋업 (실기기 빌드·설치·동작 확인까지 완료)

**예정:**
- Phase 9 운영 전환 (사업자 등록 → 토스 정식 계약 → 운영 키 교체)
- 배포 (Render 백엔드 + Vercel 프론트엔드) — VITE_TOSS_CLIENT_KEY, TOSS_SECRET_KEY 환경변수 추가 필요
- 브라우저 UI 결제 플로우 테스트 (결제 취소 시나리오)
- ~~모바일 실기기 UI 점검~~ → 2026-08-05에 홈·메뉴·검색·AI 검색·통계·뒤로가기·이모지 점검 완료. **피드/프로필/위시리스트/리스트/온보딩/결제 화면은 여전히 미점검**
- Letterboxd CSV 실제 파일로 파싱 검증

**후속 조치 (2026-08-02 세션에서 발생):**
- ~~Adoptium Temurin 21 설치 + `JAVA_HOME` 전환~~ → **완료.** 플래그 없이 `assembleDebug` 성공(27초), 실기기 재설치까지 검증
- ~~`~/.android/debug.keystore` 백업~~ → **완료** (2026-08-05 재설치 6회 모두 `install -r`로 처리되어 효과 확인)
- 릴리스 keystore는 Stage 11.4 생성 시 클라우드+로컬 이중 백업 (**생성 직후·첫 업로드 이전**에 수행)

**후속 조치 (2026-08-05 세션에서 발생):**
- **배포 후 4개 경로 검증 필요** — 이번 백엔드 변경분(스크린샷·리포트 `token_balance`, 빈 결과 무차감)은 Render 배포 전이라 미검증. AI 검색 / 스크린샷 정상 인식 / **스크린샷 빈 결과(배지 유지 확인)** / 리포트 생성·미리보기
- **C. AI 검색 결과 매칭 오류** — AI 해석은 정확한데 TMDB 제목 매칭이 엉뚱한 동명 작품을 반환(예: "우주 배경의 잔잔한 SF" → *The Arrival*(2017), *Arrival*(2013, 산악자전거 다큐)). 줄거리도 영문으로 내려옴
- **종료 확인 다이얼로그 영문 버튼** — 네이티브 `confirm()`이라 CANCEL/OK가 영문. Play 출시 전 커스텀 다이얼로그 권장
- 빈 결과 남용 여부는 `token_usage_log`의 `metadata.empty_result` 누적치를 보고 판단 (일일 상한은 현재 미도입)

**블로킹 이슈:** 없음

---

## 폴더 구조

```
media-diary/
├── backend/
│   └── src/
│       ├── app.js           ← 엔트리포인트, DB 초기화, 라우터 등록
│       ├── db/
│       │   └── index.js     ← pg Pool 설정 (Supabase 연결)
│       ├── middleware/
│       │   └── auth.js      ← JWT 검증 미들웨어
│       └── routes/
│           ├── auth.js      ← 회원가입·로그인 API
│           └── userMedia.js ← 미디어 CRUD API
├── frontend/
│   └── src/
│       ├── App.jsx          ← 라우팅 설정, PrivateRoute
│       ├── App.css          ← 인증 페이지 공통 스타일
│       ├── index.css        ← 전역 스타일 + 미디어 다이어리 UI 스타일
│       ├── api/
│       │   ├── auth.js      ← 인증 API 호출 함수
│       │   └── userMedia.js ← 미디어 CRUD API 호출 함수
│       ├── data/
│       │   └── defaultMedia.js ← 기본 미디어 178건 (영화/애니/드라마)
│       ├── pages/
│       │   ├── HomePage.jsx ← 메인 화면 (탭·카드·모달 전체 포함)
│       │   ├── LoginPage.jsx
│       │   └── RegisterPage.jsx
│       └── store/
│           └── authStore.js ← Zustand 인증 상태 (user, token, isLoading)
└── docs/
    ├── daily/               ← 날짜별 작업 일지
    ├── decisions/           ← 기술 결정 기록
    ├── troubleshooting/     ← 버그·에러 기록
    └── par-materials.md     ← 이력서 소재
```

---

## 코딩 컨벤션

- **변수명**: camelCase
- **커밋**: 컨벤셔널 커밋 형식 (feat/fix/refactor/docs/chore)
- **주석**: 한국어
- **함수**: JSDoc 형식으로 설명 추가
- **파일 상단**: 파일 역할 설명 한 줄 추가
- **백엔드 모듈**: CommonJS (`require`) 사용
- **API 응답 형식**: `{ success, data, message }`
- **에러 처리**: try/catch 필수

---

## DB 스키마

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_media (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(20) NOT NULL DEFAULT 'movie',
  title VARCHAR(500) NOT NULL,
  year INTEGER DEFAULT 0,
  director VARCHAR(500) DEFAULT '',
  cast_info VARCHAR(500) DEFAULT '',
  tmdb_id INTEGER DEFAULT 0,
  poster_url TEXT DEFAULT '',
  rating INTEGER DEFAULT 0,
  review_text TEXT DEFAULT '',
  review_date VARCHAR(50) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, title, year)
);
```

---

## API 엔드포인트

| Method | Path | 설명 | 인증 |
|---|---|---|---|
| POST | /api/auth/register | 회원가입 | - |
| POST | /api/auth/login | 로그인 → JWT 발급 | - |
| GET | /api/user-media | 내 미디어 목록 | ✓ |
| POST | /api/user-media/bulk | 기본 데이터 일괄 삽입 (시딩) | ✓ |
| POST | /api/user-media | 미디어 단건 추가 | ✓ |
| PUT | /api/user-media/:id | 미디어 수정 (정보·별점·리뷰) | ✓ |
| DELETE | /api/user-media/:id | 미디어 삭제 | ✓ |

---

## 기술 결정 로그

| 날짜 | 결정 | 이유 | 포기한 대안 |
|------|------|------|------------|
| 2026-05-05 | DB: Supabase (PostgreSQL) | 무료 플랜, pg 클라이언트로 직접 쿼리 가능 | Firebase, SQLite |
| 2026-05-05 | 첫 로그인 시 기본 데이터 시딩 | 빈 화면 방지, UX 즉시 체험 가능 | 빈 상태 시작 |
| 2026-05-11 | TMDB API 백엔드 프록시로 이전 | API 키 소스코드 노출 방지, 향후 캐싱/Rate Limit 관리 용이 | 프론트 직접 호출 유지 |
| 2026-05-11 | 컴포넌트/훅/유틸 3레이어 분리 | 950줄 단일 파일 → 독립 모듈, 확장성 확보 | 단일 파일 유지 |
| 2026-05-11 | watched_at TIMESTAMP 컬럼 추가 | 이번 달/올해 감상 통계, 최근 감상 정렬 지원 | review_date 문자열 파싱 |
| 2026-05-12 | 재시청 UNIQUE 재설계 (user_id,title,year) → (user_id,title,year,rewatch_count) | 재시청 기록 허용, 완전한 중복 방지 유지 | UNIQUE 전체 제거 |
| 2026-05-12 | DB 시간 비교 EXTRACT(EPOCH) 패턴 | pg TIMESTAMP를 JS Date.now()와 비교 시 KST +9h 오차 발생 | TIMESTAMPTZ 컬럼 타입 변경 |
| 2026-05-12 | /api/wishlist → /api/me/watchlist 경로 통일 | me 컨텍스트 일관성 (/api/me/watch-stats 등과 동일 패턴) | /api/wishlist 유지 |
| 2026-05-13 | Claude tool_choice: any (강제 도구 호출) | 텍스트 응답 → 구조화 JSON 보장, 파싱 실패 제거 | system prompt JSON 요구 |
| 2026-05-13 | 큐레이션 계층 SUPER_GROUPS (프론트 정의) | DB 신규 컬럼 없이 2단계 아코디언 계층 구현 | subcategory 컬럼 추가 |
| 2026-05-13 | 시드 3스크립트 파이프라인 (fill→fetch→seed) | 50개 리스트 반복 실행 가능, 데이터 업데이트 용이 | 단일 스크립트 |
| 2026-05-13 | person/search 라우트 먼저 등록 | :tmdbId 패턴이 'search' 문자열을 캡처하는 충돌 방지 | 라우트 순서 무관 |
| 2026-05-14 | 이미지 프록시 패턴 (html2canvas CORS 우회) | 원본 URL 캐시 오염 방지, 프록시 URL로 캐시 충돌 제거 | img crossOrigin 속성 일괄 추가 |
| 2026-05-14 | crypto.randomUUID() 클라이언트 세션 ID | 서버 세션 테이블 불필요, JWT와 동일한 stateless 설계 | 서버에서 session_id 발급 |
| 2026-05-14 | 리포트 항목 COMPONENT_PROMPTS 상수 분리 | templateId별 지시문 동적 구성, 항목 추가 시 상수만 수정 | 프롬프트 하드코딩 |
| 2026-05-14 | byFeature 동적 집계 (하드코딩 제거) | 신규 feature 추가 시 코드 변경 없이 자동 포함 | 기능 추가 시마다 수동 등록 |
| 2026-07-20 | Capacitor 네이티브 래핑 채택 (WebView + Bridge, 번들 모드) | 기존 웹 자산 재사용으로 Google Play 출시, 코드 재작성 불필요 | React Native 재작성, PWA만 유지 |
| 2026-07-20 | AndroidManifest screenOrientation=portrait 고정 | 카드 그리드·모달 중심 UX라 세로 전용이 자연스러움 | 양방향 지원 후 반응형 처리 |
| 2026-07-30 | Vercel SPA fallback rewrite (frontend/vercel.json) | 클라이언트 라우팅 경로 직접 접근 시 404 방지, Play Console 제출용 URL 필요 | 서버사이드 라우팅 전환 |
| 2026-07-30 | TMDB 단일 검색 결과 최대 3페이지(60개) 병합 | 결과 많은 작품(프랜차이즈)이 1페이지로 잘리는 문제 해결 | 프론트 무한스크롤 페이지네이션 UI |
| 2026-07-30 | 공백 1개 삽입 검색 fallback (선형, 길이-1개 변형) | TMDB가 붙여쓴 한글 쿼리를 공백 기준 토큰 매칭 → 결과 3개 미만일 때만 트리거, 조합 폭발 없이 실사용 대부분 커버 | 검색 팁 안내 문구만 제공 |
| 2026-08-02 | Android 빌드 JDK를 Adoptium Temurin 21로 통일 (`JAVA_HOME` 전환) | Capacitor 8이 Java 21+ 요구, Android Studio 번들 JBR 25는 Gradle 8.14.3 공식 지원 상한(24) 초과 + 경로 하드코딩으로 PC 이식성 상실 | `gradle.properties`에 `org.gradle.java.home` 고정, Gradle wrapper 9.x 상향 |
| 2026-08-02 | keystore 백업 정책 — debug는 로컬 백업, 릴리스는 Stage 11.4 생성 시 클라우드+로컬 이중 백업 | debug keystore 소실로 기존 설치본 업데이트 불가 사고 발생, 릴리스 keystore 분실 시 Play Store 앱 업데이트 영구 불가 | 백업 없이 진행 |
| 2026-08-02 | 모바일 메뉴는 오버레이 드로어(fixed + 백드롭), 데스크톱은 기존 드롭다운 유지 | 좁은 화면에서 absolute 드롭다운은 버튼 위치에 따라 뷰포트를 벗어남, 미디어쿼리 분기로 데스크톱 회귀 위험 제거 | 드롭다운 위치만 보정(clamp), 전 해상도 드로어 통일 |
| 2026-07-30 | 이모지 대신 인라인 SVG 아이콘(TokenIcon) 사용 | 🪙(Unicode 13.0)가 구형 Android WebView에서 tofu로 깨짐, Capacitor 배포 대비 | lucide-react 라이브러리 추가 |
| 2026-08-05 | 스크린샷 인식 0건 시 **환급이 아니라 차감 시점을 뒤로 이동** | `deductTokens`가 fire-and-forget이라 환급 트랜잭션이 먼저 커밋되면 잔액이 오히려 늘어나는 레이스 발생. 환급하려면 `await`로 바꿔야 하는데 "차감 실패해도 응답은 정상 반환" 의도가 깨짐. 되돌릴 일을 안 만들면 트랜잭션·정합성·남용 문제가 모두 소멸 | 차감 후 환급(트랜잭션 + 음수 보정 로그) |
| 2026-08-05 | 빈 결과 일일 환급 상한 생략, `metadata.empty_result` 0토큰 로그로 대체 | 상한은 "N회 초과 시 빈 결과인데 차감"이라는 설명하기 어려운 UX를 만듦. 집계가 전부 `SUM(tokens_used)` 기반이라 0토큰 행은 수치를 왜곡하지 않으면서 발생 빈도만 남김 → 출시 후 실데이터로 판단 | 일일 5회 상한 즉시 도입 |
| 2026-08-05 | 링크색은 `a { color: inherit }`, 다크 오버라이드 미사용 | `[data-theme="dark"] a`는 특정도 (0,1,1)이라 클래스 규칙 (0,1,0)을 이겨 클래스 지정 색까지 덮어버림. `inherit`은 라이트 값이 기존과 동일해 회귀도 없음 | `[data-theme="dark"] a { color: #e8e8e8 }` 추가 |
| 2026-08-05 | `useTheme()`을 App 루트에서 호출 | 페이지별 호출이라 미호출 페이지(/discover 등)를 직접 열면 `data-theme`이 없어 테마 규칙이 하나도 적용 안 됨 — Phase 10 화면이 다크로 하드코딩된 근본 원인 | 각 페이지에 개별 추가 |
| 2026-08-05 | Phase 10 라이트 대응은 `[data-theme="light"]` 오버라이드 블록 추가 | 기존 다크 정의(~50개 규칙)가 이미 올바르게 동작 중이라, 값을 라이트로 바꾸고 다크를 다시 얹으면 회귀 위험이 큼 | 기존 규칙을 라이트 기본값으로 재작성 + 다크 오버라이드 |
| 2026-08-05 | 캘린더 다크 빈 셀은 `#2e2e2e` (GitHub 원본 `#161b22` 미사용) | 원본은 카드 배경 `#1c1c1c`보다 어두워 셀이 아예 안 보임. `#2e2e2e`는 이 프로젝트가 다크 테두리에 이미 쓰는 톤이라 자연스럽게 이어짐 | GitHub 다크 팔레트 그대로 사용 |
| 2026-08-05 | 안드로이드 뒤로가기는 최상단 백드롭 `click()` 재사용 | 오버레이 11곳이 모두 `onClick={e => e.target === e.currentTarget && onClose()}` 동일 구조 → "뒤로가기 = 바깥 탭"으로 의미 통일, 1파일 수정으로 신규 모달까지 자동 커버 | 오버레이 스택 등록(11파일 수정, 신규 모달이 등록 누락 시 앱 종료) |
| 2026-08-05 | `.chart-card { min-width: 0 }` | 그리드 아이템 기본값 `min-width:auto`가 캘린더 min-content(793px)만큼 트랙을 벌리고, ResponsiveContainer가 그 폭을 인라인으로 고정해 되돌아오지 않음 | 캘린더 폭 축소, ResponsiveContainer 제거 |
| 2026-08-05 | 실기기 테스트는 관찰 전용, 좌표 탭 금지 | 앱이 백그라운드인 줄 모르고 보낸 `input tap`이 개인 메신저·Play Store·금융 앱으로 새어 들어감(송금 버튼 노출). 화면 캡처·CDP 읽기는 안전하나 맹목적 입력은 위험 | 포그라운드 검증 후 좌표 탭 계속 사용 |

---

## 트러블슈팅 로그

| 날짜 | 문제 | 해결 방법 |
|------|------|----------|
| 2026-05-05 | `.mposter` opacity가 포스터 이미지까지 반투명하게 만듦 | 이모지 span에만 opacity 적용, 이미지에 z-index: 1 추가 |
| 2026-05-05 | 편집 저장 후 재편집 시 이전 값 잔존 | 편집 버튼 클릭 시 editFields를 현재 props로 재초기화 |
| 2026-05-05 | 배치 INSERT 파라미터 인덱스 충돌 | idx * F + offset 방식으로 배치별 플레이스홀더 수동 계산 |
| 2026-05-05 | tmdb_id를 잘못된 타입으로 조회해 엉뚱한 제목으로 덮어씀 | 제목 자동 동기화 기능 제거, TMDB 검색으로 추가하는 방식으로 전환 |
| 2026-05-11 | Express 5 서버 시작 실패 (`router.get('*', ...)`) | path-to-regexp v8 Breaking Change → 정규식 `/(.*)/` 으로 변경 |
| 2026-05-11 | anime 포스터 프리패치에서 엉뚱한 결과 반환 | movie 타입으로 조회하던 버그 → `item.type !== 'movie'`면 'tv'로 분기 |
| 2026-05-12 | YIR 캐시 항상 만료 (ageHours: 9) | pg가 TIMESTAMP를 KST로 파싱 → JS Date.now()와 9h 차이 → EXTRACT(EPOCH FROM (NOW()-col)) 패턴으로 해결 |
| 2026-05-12 | Wishlist /watched 500 오류 | UNIQUE 재설계 후 ON CONFLICT (user_id,title,year) 참조가 잔존 → (user_id,title,year,rewatch_count)로 수정 |
| 2026-05-13 | baeksang-drama-winners 중복 표시 | kr-drama 필터가 awards까지 포함 → `&& l.category !== 'awards'` 추가 |
| 2026-05-13 | TMDB 미매칭 5개 (tmdb_id: 0 잔존) | fill-tmdb-ids.js가 못 찾은 항목 수동 TMDB 검색 후 DB UPDATE + JSON 동기화 |
| 2026-05-14 | 큐레이션 ID 60건 오류 (수동 입력 오류 + 배치 스크립트 버그) | 전수 검증 스크립트로 오류 발견 → fix-curation-ids.js 2회 실행, MCU 순환 swap은 임시값(999999) 경유 |
| 2026-05-14 | seed-curation.js 재실행으로 오류 수정 불가 | ON CONFLICT DO NOTHING 제약 → 별도 UPDATE/DELETE 스크립트 필요 |
| 2026-05-14 | 가장 따뜻한 색, 블루 수정 오류 (152584→129575 → 재수정) | 칸 리스트의 129575가 오류였는데 world-cinema의 정상값 152584를 대신 수정 → 재역전 처리 |
| 2026-05-14 | BillingSuccessPage auth race condition | useEffect가 token=null 상태에서 실행 → isLoading 의존성 추가로 auth 초기화 완료 후 실행 |
| 2026-07-20 | ANDROID_HOME이 VSCode 재시작 후에도 세션에 미반영 | 레지스트리엔 정상 등록됐으나 세션 셸 프로세스가 예전 환경 스냅샷 유지 → 명령마다 export로 우회 (근본 해결은 재부팅 필요) |
| 2026-07-30 | Vercel 배포에서 /policy/privacy 직접 접근 시 404 | vercel.json 부재로 SPA fallback 미설정 → rewrites로 모든 경로를 index.html로 전달 |
| 2026-07-30 | "짱구는 못말려" 검색 시 극장판 10개 안팎만 표시 (실제 32편) | searchTmdb가 TMDB page=1만 조회 → 최대 3페이지(60개) 병합 + dedupe로 수정 |
| 2026-07-30 | "다크나이트"(붙여쓰기) 검색 시 "다크 나이트" 결과 누락 | TMDB가 한글 쿼리를 공백 기준 토큰 매칭 → 결과 3개 미만일 때 공백 1개 삽입 변형(최대 12개)으로 fallback 검색 |
| 2026-07-30 | 🪙 이모지가 구형 Android WebView에서 빈 네모(tofu)로 표시 | Unicode 13.0(2020) 신규 이모지라 폰트 미지원 → stroke 기반 인라인 SVG(TokenIcon)로 교체 |
| 2026-08-02 | 모바일에서 메뉴 항목 첫 글자 잘림 + 메인 위에 백드롭 없이 겹침 | `right:0` absolute 드롭다운이 wrap된 버튼 기준으로 왼쪽 160px 뻗어 뷰포트 밖(-6px) 이탈 → 600px 이하에서 fixed 우측 오버레이 드로어 + 백드롭으로 전환 |
| 2026-08-02 | `gradlew assembleDebug` 실패 — `invalid source release: 21` (`:capacitor-android:compileDebugJavaWithJavac`) | **Capacitor 8은 Java 21+ 필요한데 `JAVA_HOME`이 JDK 17이었음.** 임시로 `-Dorg.gradle.java.home=...\Android Studio\jbr`(JDK 25) 우회 → **해결: Adoptium Temurin 21 설치 + `JAVA_HOME` 전환**. 전환 후 플래그 없이 `BUILD SUCCESSFUL in 27s` 검증 완료. 단 환경변수는 Machine 레벨에 등록돼도 실행 중인 셸에는 반영 안 됨(2026-07-20 항목과 동일 현상) → 새 셸/재부팅 필요 |
| 2026-08-02 | `adb install` 실패 — `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match` | 7/31 설치본을 서명한 `~/.android/debug.keystore`가 소실돼 빌드 시 Gradle이 새 keystore를 자동 생성(mtime=빌드 시각) → 서명 불일치. 원본 복구 불가라 `adb uninstall` 후 재설치로 해결(로컬 로그인 세션·화면모드 설정만 소실, 기록은 Supabase 보존). **`~/.android/debug.keystore` 백업 권장 — 분실 시 기존 앱을 제거해야만 재설치 가능.** 릴리스 keystore는 분실 시 Play Store 업데이트가 영구 불가하므로 Stage 11.4에서 클라우드+로컬 이중 백업 |
| 2026-08-05 | `/stats` 페이지 폭이 411 → 850 CSS px로 늘어나 차트가 화면 밖으로 잘림 | 캘린더 min-content(793px) → `.chart-card`가 그리드 아이템인데 `min-width:auto`라 트랙이 벌어짐 → ResponsiveContainer가 그 폭을 측정해 `.recharts-wrapper`에 인라인 `width:793px` 고정 → 이후 되돌아오지 않음(사후 `min-width:0`·`resize` 모두 무효). `.chart-card { min-width: 0 }`으로 해결 (scrollWidth 850→411, 차트 793→338px) |
| 2026-08-05 | 연대별 분포 x축이 `1980s…2020s, 1970s` 순으로 1970s가 맨 뒤 | 키가 `'1980s'` 문자열이라 `Number('1980s')`가 **NaN** → 비교 함수가 항상 NaN을 반환해 정렬이 무효화(삽입 순서 유지). 연대 숫자를 키로 집계 후 `a.decade - b.decade` 정렬 |
| 2026-08-05 | 다크모드에서 연대별 막대·파이 영화 슬라이스가 안 보임 | `fill: #1a1a1a`가 카드 배경 `#1c1c1c`와 대비 1.02. 영화가 전체의 85%라 도넛 대부분이 사라짐 → `BAR_COLOR`/`PIE_COLORS` 테마 분기 |
| 2026-08-05 | `/discover`, `/discover/chat`, `/reports/customize`가 라이트 모드에서 어두운 카드로 표시 | `useTheme()`이 페이지별 호출인데 이 세 페이지는 미호출 → 직접 열면 `data-theme`이 `undefined`라 테마 규칙이 하나도 적용 안 됨(다크 블록조차). 그래서 값이 다크로 하드코딩돼 있었음 → `App.jsx` 루트에서 `useTheme()` 호출 + `[data-theme="light"]` 오버라이드 추가 |
| 2026-08-05 | 모달이 열린 상태에서 뒤로가기 → 모달이 안 닫히고 앱 종료 확인으로 직행 | `useAndroidBackButton`이 `location.pathname`만 보고 오버레이 상태를 모름 → 최상단 백드롭을 `click()`해 "바깥 탭"과 동일 처리 후 `return` |
| 2026-08-05 | AI 기능 사용 후 헤더 토큰 배지가 새로고침 전까지 이전 값 유지 | 차감 지점 대부분이 응답에 잔액을 안 실어 보냄 → 4개 라우트에 `token_balance` 추가 + 프론트 3곳에 `setBalance` 연결. `ReportsCustomizePage`는 `setBalance`를 호출 중이었으나 백엔드가 값을 안 줘 무동작이었음 |
| 2026-08-05 | 스크린샷 인식 0건인데 5토큰 차감 | `deductTokens`가 빈 결과 체크보다 먼저 호출됨 → 차감 시점을 분기 이후로 이동(환급 아님, 레이스 회피). 기존 피해 이력은 `token_usage_log` 조회 결과 0건 |
| 2026-08-05 | CDP(`Runtime.evaluate`)가 응답 없이 멈춤 — 크래시로 오인 | ① 앱이 백그라운드로 내려가면 삼성 Freecess가 프로세스를 freeze(`D ActivityManager: freezing <pid>`) ② JS `confirm()` 다이얼로그가 렌더러를 블록. ①은 `am start`로 포그라운드 복귀 후 `adb forward` 재설정, ②는 `Page.enable` + `Page.handleJavaScriptDialog`로 해제 |
| 2026-08-05 | `adb shell input tap`이 다른 앱(개인 메신저·Play Store·금융 앱)으로 들어감 | 앱이 백그라운드인 줄 모르고 좌표 탭 전송. 금융 앱 송금 버튼이 노출된 화면이라 위험했음 → 탭 전 `topResumedActivity` 검증 필수, 이후 좌표 탭 전면 금지·관찰 전용으로 전환 |

---

## 문서화 규칙

세션 종료 전 반드시 실행:
1. `docs/daily/YYYY-MM-DD.md` 업데이트
2. 기술 결정이 있었으면 위 로그에 추가
3. 트러블슈팅이 있었으면 위 로그에 추가

---

## ROADMAP 연동

이 프로젝트는 phase/ROADMAP.md (Phase 3-4), phase/ROADMAP_V2.md (Phase 5),
phase/ROADMAP_V3.md (Phase 6-7), phase/ROADMAP_V4.md (Phase 8),
phase/ROADMAP_V5.md (Phase 9), phase/ROADMAP_V6.md (Phase 10),
phase/ROADMAP_V7.md (Phase 11 — Google Play Store 출시, Capacitor 네이티브 래핑 +
플랫폼 분기 결제) 파일을 따라 진행됩니다.
새 작업 시작 전 해당 ROADMAP을 먼저 읽고 미완료 항목을 확인하세요.
작업 완료 시 ROADMAP을 업데이트하세요.

---

## 절대 건드리지 말 것

- `.env` 파일 — git 커밋 금지
- TMDB API 키 — 추후 env로 이전 권장

---

## 개발 서버 실행

```bash
# 백엔드 (포트 4000)
cd backend && npm run dev

# 프론트엔드 (포트 5173)
cd frontend && npm run dev
```
