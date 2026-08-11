# CLAUDE.md

## 코딩 원칙

**추측 금지. 혼란 숨기지 말 것. 트레이드오프 드러낼 것.**

- 가정은 명시. 불확실하면 질문.
- 해석이 여럿이면 전부 제시, 조용히 하나 고르지 말 것.
- 더 단순한 방법 있으면 말할 것. 반대 의견도 낼 것.
- 요청 범위 밖 기능·추상화·미사용 유연성·불가능한 케이스 에러 처리 금지.
- 200줄 짤 걸 50줄로 가능하면 다시 쓸 것.
- 기존 코드 수정 시: 인접 코드/주석/포맷 "개선" 금지, 안 망가진 것 리팩터 금지, 기존 스타일 따를 것.
- 무관한 죽은 코드는 언급만, 삭제 금지. 단 내 변경으로 미사용이 된 import/변수/함수는 제거.
- 기준: 바뀐 모든 줄이 사용자 요청으로 추적되어야 함.

**성공 기준 정의 후 검증될 때까지 반복.**

- "검증 추가" → "잘못된 입력 테스트 작성 후 통과시키기"
- "버그 수정" → "재현 테스트 작성 후 통과시키기"
- 다단계 작업은 `1. [단계] → 검증: [확인]` 형태로 짧은 계획 먼저.

---

## 프로젝트 개요

- **서비스명**: 미디어 다이어리 — 본 영화·애니·드라마 기록 + 별점/리뷰 관리
- **스택**: React 19 + Vite 8 / Express 5 + pg / Supabase (PostgreSQL) / TMDB API / Claude API
- **상태 관리**: zustand, 라우팅 react-router-dom 7, 차트 recharts
- **네이티브**: Capacitor (Android, Google Play 출시 준비)
- **로컬 실행**: 프론트 5173 / 백엔드 4000
- 버전 상세는 각 `package.json`이 원본. 이 문서에 중복 기재하지 않음.

---

## 현재 진행 상황

> **작업 이어갈 때 `STATUS.md` 먼저 읽을 것.**
> 진행 중 / 다음 할 일 / 완료 이력 / 작업 환경 주의사항 전부 `STATUS.md`에 있음.
> 진행 상황 갱신도 이 파일 말고 `STATUS.md`에 한다.

---

## 코드 구조

```
backend/src/    app.js(엔트리·DB 초기화·라우터 등록) db/ middleware/ routes/ utils/
frontend/src/   App.jsx pages/ components/ hooks/ api/ store/ data/ utils/
docs/           daily/ decisions/ troubleshooting/ par-materials.md
phase/          ROADMAP*.md
android/        Capacitor 네이티브 프로젝트
```

- 라우트·페이지 목록은 실제 디렉터리가 원본. 개수가 많고 자주 늘어나므로 여기 나열하지 않음.
- DB 스키마 원본은 `backend/src/app.js`의 `CREATE TABLE` 문. 이 문서에 사본을 두지 않음
  (사본이 낡아 실제 제약과 어긋난 전례 있음).
- API 응답 형식은 전부 `{ success, data, message }`.

---

## 코딩 컨벤션

- **변수명**: camelCase
- **커밋**: 컨벤셔널 커밋 (feat/fix/refactor/docs/chore)
- **주석**: 한국어
- **함수**: JSDoc 설명
- **파일 상단**: 역할 설명 한 줄
- **백엔드 모듈**: CommonJS (`require`)
- **에러 처리**: try/catch 필수

---

## 기술 결정 로그

2026-07-30 이전 항목은 `docs/decisions/log-archive.md`. 개별 상세는 `docs/decisions/`.

| 날짜 | 결정 | 이유 | 포기한 대안 |
|------|------|------|------------|
| 2026-08-02 | Android 빌드 JDK를 Adoptium Temurin 21로 통일 (`JAVA_HOME` 전환) | Capacitor 8이 Java 21+ 요구, Android Studio 번들 JBR 25는 Gradle 8.14.3 지원 상한(24) 초과 + 경로 하드코딩으로 PC 이식성 상실 | `gradle.properties`에 `org.gradle.java.home` 고정, Gradle wrapper 9.x 상향 |
| 2026-08-02 | keystore 백업 정책 — debug는 로컬 백업, 릴리스는 Stage 11.4 생성 시 클라우드+로컬 이중 백업 | debug keystore 소실로 기존 설치본 업데이트 불가 사고 발생, 릴리스 keystore 분실 시 Play Store 업데이트 영구 불가 | 백업 없이 진행 |
| 2026-08-02 | 모바일 메뉴는 오버레이 드로어(fixed + 백드롭), 데스크톱은 드롭다운 유지 | 좁은 화면에서 absolute 드롭다운은 버튼 위치 따라 뷰포트 이탈, 미디어쿼리 분기로 데스크톱 회귀 위험 제거 | 드롭다운 위치만 보정(clamp), 전 해상도 드로어 통일 |
| 2026-08-05 | 스크린샷 인식 0건 시 **환급이 아니라 차감 시점을 뒤로 이동** | `deductTokens`가 fire-and-forget → 환급 트랜잭션이 먼저 커밋되면 잔액이 오히려 늚(레이스). `await`로 바꾸면 "차감 실패해도 응답은 정상" 의도가 깨짐. 되돌릴 일을 안 만들면 트랜잭션·정합성·남용 문제 모두 소멸 | 차감 후 환급(트랜잭션 + 음수 보정 로그) |
| 2026-08-05 | 빈 결과 일일 환급 상한 생략, `metadata.empty_result` 0토큰 로그로 대체 | 상한은 "N회 초과 시 빈 결과인데 차감"이라는 설명 어려운 UX를 만듦. 집계가 전부 `SUM(tokens_used)`라 0토큰 행은 수치 왜곡 없이 발생 빈도만 남김 → 출시 후 실데이터로 판단 | 일일 5회 상한 즉시 도입 |
| 2026-08-05 | 링크색은 `a { color: inherit }`, 다크 오버라이드 미사용 | `[data-theme="dark"] a`는 특정도 (0,1,1)이라 클래스 규칙 (0,1,0)을 이겨 클래스 지정 색까지 덮음. `inherit`은 라이트 값이 기존과 같아 회귀 없음 | `[data-theme="dark"] a { color: #e8e8e8 }` 추가 |
| 2026-08-05 | `useTheme()`을 App 루트에서 호출 | 페이지별 호출이라 미호출 페이지(/discover 등) 직접 열면 `data-theme` 없어 테마 규칙 전부 미적용 — Phase 10 화면이 다크로 하드코딩된 근본 원인 | 각 페이지에 개별 추가 |
| 2026-08-05 | Phase 10 라이트 대응은 `[data-theme="light"]` 오버라이드 블록 추가 | 기존 다크 정의(~50개 규칙)가 이미 정상 동작 중이라, 값을 라이트로 바꾸고 다크를 다시 얹으면 회귀 위험 큼 | 기존 규칙을 라이트 기본값으로 재작성 + 다크 오버라이드 |
| 2026-08-05 | 캘린더 다크 빈 셀은 `#2e2e2e` (GitHub 원본 `#161b22` 미사용) | 원본은 카드 배경 `#1c1c1c`보다 어두워 셀이 아예 안 보임. `#2e2e2e`는 이 프로젝트가 다크 테두리에 이미 쓰는 톤이라 자연스러움 | GitHub 다크 팔레트 그대로 |
| 2026-08-05 | 안드로이드 뒤로가기는 최상단 백드롭 `click()` 재사용 | 오버레이 11곳 모두 `onClick={e => e.target === e.currentTarget && onClose()}` 동일 구조 → "뒤로가기 = 바깥 탭" 의미 통일, 1파일 수정으로 신규 모달까지 자동 커버 | 오버레이 스택 등록(11파일 수정, 신규 모달 등록 누락 시 앱 종료) |
| 2026-08-05 | `.chart-card { min-width: 0 }` | 그리드 아이템 기본값 `min-width:auto`가 캘린더 min-content(793px)만큼 트랙을 벌리고, ResponsiveContainer가 그 폭을 인라인 고정해 복구 안 됨 | 캘린더 폭 축소, ResponsiveContainer 제거 |
| 2026-08-05 | 실기기 테스트는 관찰 전용, 좌표 탭 금지 | 앱이 백그라운드인 줄 모르고 보낸 `input tap`이 개인 메신저·Play Store·금융 앱으로 샘(송금 버튼 노출). 캡처·CDP 읽기는 안전, 맹목적 입력은 위험 | 포그라운드 검증 후 좌표 탭 계속 사용 |
| 2026-08-05 | 실기기 조작은 **포그라운드 가드 + CDP 요소 지정 클릭** | 좌표 탭 금지를 지키면서 실조작 검증 필요. 매 입력 전 `topResumedActivity` 검사 + CDP로 DOM 요소 지정 `click()` → 좌표 개념 자체가 없어 오발송 원천 차단 | 관찰 전용 유지(검증 불가), 좌표 탭 재개 |
| 2026-08-05 | 토큰 차감은 **`res.json` 직전 한 지점**에서만 | 차감 후 DB INSERT·TMDB 호출이 남으면 거기서 터질 때 500 + 토큰만 소모. 환급은 `deductTokens` fire-and-forget이라 레이스, `await`로 바꾸면 "차감 실패해도 응답은 정상" 의도가 깨짐 | 차감 후 환급(보상 트랜잭션) |
| 2026-08-05 | 빈 결과 무차감 범위는 **코드 형태가 아니라 사용자가 받은 것**으로 판단 | `discover/chat`·`restore/chat`은 `works: []`여도 AI 되묻기 자체가 결과 → 무차감하면 정상 대화를 오작동 취급. 리포트 계열은 Claude 호출 전 `items.length===0` 가드가 이미 있어 대상 아님 | 배열이 비면 일괄 무차감 |
| 2026-08-05 | AI 검색 응답을 `tool_choice: any` + `works[]` required 스키마로 강제 | 자유 텍스트 `keywords`는 연도·원제가 없어 TMDB 결과 검증 기준 부재, "제목 **또는 핵심 단어**" 허용 탓에 장르 설명어("Hong Kong noir 1990s")·인물명이 내려와 0건. 다른 라우트에서 이미 쓰던 패턴 | 프롬프트 문구만 강화 |
| 2026-08-05 | TMDB 매칭은 `vote_average` 정렬 폐기, **다중 신호 점수화** | TMDB 평점은 표 1~4개에서도 8점대라 무명작이 표 19,635개 작품을 이김. 제목 유사도 + 연도 근접도 + 표수로 점수화, 임계 미달 제외 — 엉뚱한 걸 보여주느니 빼는 게 나음 | popularity 단독 정렬, 평점+표수 가중 정렬 |
| 2026-08-05 | 제목이 안 닮은 매칭은 **연도 정확 일치 + 표 100개 이상**일 때만 채택 | TMDB `original_title`이 원어면(`Сталкер`) 유사도가 무력 → 이를 살리려 연도 제약 검색에 가산점을 줬더니 유사도 0인 무명작(표 2~11개)까지 통과 | 연도 가산점 제거(원어 제목 매칭 포기) |
| 2026-08-05 | 잔액 조회(`fetchBalance`)를 App 루트에서 1회 호출 | 페이지별 호출이라 미호출 페이지를 직접 열면 배지가 `···`로 비었음 — `useTheme`을 루트로 올린 것과 동일 원인. 신규 페이지가 추가돼도 자동 커버 | 공통 훅 신설(부르는 걸 잊는 실패 모드가 그대로 남음) |
| 2026-08-05 | 리포트 재생성은 `regenerate` 플래그로 캐시 우회 | 기존엔 리포트 있으면 무조건 `cached` 조기 반환이라 `ON CONFLICT DO UPDATE` 도달 불가 → "다시 생성" 무동작. 캐시 조회는 0토큰 유지 필요라 무조건 재생성 불가 | 캐시 반환 제거(모든 조회가 5토큰이 됨) |
| 2026-08-12 | 수식어 공유 카드 저장은 CSV 내보내기와 동일한 Blob+`<a download>` 패턴 재사용, 공유는 `navigator.canShare` 감지 시에만 버튼 노출 | `@capacitor/filesystem`·`@capacitor/share` 둘 다 미설치 — 신규 플러그인 없이 점진적 향상(progressive enhancement)만으로 구현 범위 충족. CSV 내보내기의 실기기 저장 검증 이력이 원래 없어 이 한계를 그대로 승계 | `@capacitor/share` 설치 후 네이티브 공유 시트 사용 |

---

## 기술 부채

| 날짜 | 항목 | 내용 |
|------|------|------|
| 2026-08-11 | `companion_names` 프론트 입력 UI 미구현 | DB 컬럼(`user_media.companion_names`)과 백엔드 PUT 라우트(`userMedia.js`)는 존재하나, DetailModal "시청 컨텍스트" 섹션은 `watched_with`(누구와, 프리셋 칩)까지만 노출하고 동반자 실명 자유 텍스트 입력창은 없음. 보류 결정(2026-08-11) — 추가 여부는 별도 기획 필요 |
| 2026-08-11 | 백엔드 테스트 프레임워크 부재 | vitest 등 테스트 프레임워크 미설치, config 없음, `backend/package.json`의 `test` 스크립트는 자리표시자(`echo "Error: no test specified"`). 도입 보류(2026-08-11). 도입 시 전제: 운영 DB(Supabase) 접속 금지 — 로컬 postgres 또는 별도 테스트용 Supabase 프로젝트로 분리할 것 |
| 2026-08-11 | 미정의 CSS 커스텀 프로퍼티(`var(--x, fallback)`) 77곳 — 전부 fallback으로만 동작 | `--border`(21) · `--border-color`(20) · `--card-bg`(15) · `--text-primary`(18) · `--text-secondary`(23) — 5개 이름, `index.css` + `ScreenshotImportModal.jsx`/`CurationListPage.jsx`/`MemoryChatPage.jsx`/`OnboardingPage.jsx`/`RestorePage.jsx`/`StatsPage.jsx`/`WishlistPage.jsx`에서 참조. `:root`에 실제 값을 정의하는 곳이 프로젝트 어디에도 없어 **항상 fallback 값(라이트 고정)** 으로 렌더링됨 — 다크모드에서 전혀 반응하지 않는 죽은 토큰. Phase 12.4에서 발견, 이번 커밋 범위 밖이라 수정 보류. `:root`에 정의를 채우면 이 7개 파일 전체(다크모드 미적용 화면 포함, 촬영 대상 6개 화면 밖도 다수)에 한 번에 영향을 미치므로 별도 작업으로 분리해 전수 검토 필요 — 이 프로젝트의 실제 다크모드 메커니즘은 `[data-theme="dark"] { .selector {...} }` 개별 오버라이드 방식(기술 결정 로그 참고)이라, 두 메커니즘을 혼용하지 않도록 방향을 먼저 정할 것 |
| 2026-08-11 | 전역 공유 클래스 44px 터치 타깃 미달 (Phase 12.4 44dp 감사) | 촬영 대상 6개 화면(홈/다이어리·상세모달·통계·검색·설정·임포트) 감사에서 발견했으나, 아래는 전부 해당 화면 밖(리스트·위시리스트·리포트·피드·비교 등)까지 광범위하게 쓰이는 공유 클래스라 높이를 키우면 감사 범위 밖 화면에도 번져 수정 보류: `.btn`/`.btn-primary`/`.btn-danger`(약 36px, 앱 전역 거의 모든 버튼) · `.tab`(40px, HomePage+FeedPage) · `.tab-btn`(25px, StatsPage+DetailModal+WishlistPage) · `.token-chip`(29px, HomePage+ReportsPage) · `.search-input`(35px, HomePage+FeedPage+WishlistPage) · `.settings-input`(39px, SettingsPage+ListsPage+WatchlistsPage) · `.add-input`(37px, AiSearchModal+AddModal+PosterPicker). `.sort-select`(37px)는 HomePage 전용이지만 같은 헤더 행(`.mdb-controls`)에서 위 공유 요소들과 나란히 있어 혼자만 키우면 행 안에서 높이가 들쭉날쭉해져 함께 보류. 화면 전용 요소(`.theme-radio-item`/`.poster-change-btn`/`.mtab-btn`/`.mghost-btn`/`.mresearch-btn`/DetailModal 인라인 버튼 일부)는 같은 커밋에서 이미 44px로 보정함 |

---

## 트러블슈팅 로그

2026-07-30 이전 항목은 `docs/troubleshooting/log-archive.md`. 개별 상세는 `docs/troubleshooting/`.

| 날짜 | 문제 | 해결 방법 |
|------|------|----------|
| 2026-08-02 | 모바일에서 메뉴 항목 첫 글자 잘림 + 메인 위에 백드롭 없이 겹침 | `right:0` absolute 드롭다운이 wrap된 버튼 기준 왼쪽 160px 뻗어 뷰포트 밖(-6px) 이탈 → 600px 이하에서 fixed 우측 오버레이 드로어 + 백드롭 |
| 2026-08-02 | `gradlew assembleDebug` 실패 — `invalid source release: 21` (`:capacitor-android:compileDebugJavaWithJavac`) | **Capacitor 8은 Java 21+ 필요한데 `JAVA_HOME`이 JDK 17.** 임시로 `-Dorg.gradle.java.home=...\Android Studio\jbr`(JDK 25) 우회 → **해결: Adoptium Temurin 21 설치 + `JAVA_HOME` 전환**. 전환 후 플래그 없이 `BUILD SUCCESSFUL in 27s` 검증. 단 환경변수는 Machine 레벨 등록돼도 실행 중 셸엔 미반영(2026-07-20과 동일) → 새 셸/재부팅 필요 |
| 2026-08-02 | `adb install` 실패 — `INSTALL_FAILED_UPDATE_INCOMPATIBLE: signatures do not match` | 7/31 설치본을 서명한 `~/.android/debug.keystore` 소실 → 빌드 시 Gradle이 새 keystore 자동 생성(mtime=빌드 시각) → 서명 불일치. 원본 복구 불가라 `adb uninstall` 후 재설치(로컬 로그인 세션·화면모드만 소실, 기록은 Supabase 보존). **`~/.android/debug.keystore` 백업 권장 — 분실 시 기존 앱 제거해야만 재설치 가능.** 릴리스 keystore는 분실 시 Play Store 업데이트 영구 불가라 Stage 11.4에서 클라우드+로컬 이중 백업 |
| 2026-08-05 | `/stats` 페이지 폭이 411 → 850 CSS px로 늘어나 차트가 화면 밖으로 잘림 | 캘린더 min-content(793px) → `.chart-card`가 그리드 아이템인데 `min-width:auto`라 트랙이 벌어짐 → ResponsiveContainer가 그 폭을 측정해 `.recharts-wrapper`에 인라인 `width:793px` 고정 → 복구 안 됨(사후 `min-width:0`·`resize` 모두 무효). `.chart-card { min-width: 0 }`으로 해결 (scrollWidth 850→411, 차트 793→338px) |
| 2026-08-05 | 연대별 분포 x축이 `1980s…2020s, 1970s` 순으로 1970s가 맨 뒤 | 키가 `'1980s'` 문자열이라 `Number('1980s')`가 **NaN** → 비교 함수가 항상 NaN 반환, 정렬 무효(삽입 순서 유지). 연대 숫자를 키로 집계 후 `a.decade - b.decade` 정렬 |
| 2026-08-05 | 다크모드에서 연대별 막대·파이 영화 슬라이스가 안 보임 | `fill: #1a1a1a`가 카드 배경 `#1c1c1c`와 대비 1.02. 영화가 전체의 85%라 도넛 대부분이 사라짐 → `BAR_COLOR`/`PIE_COLORS` 테마 분기 |
| 2026-08-05 | `/discover`, `/discover/chat`, `/reports/customize`가 라이트 모드에서 어두운 카드로 표시 | `useTheme()`이 페이지별 호출인데 이 세 페이지는 미호출 → 직접 열면 `data-theme`이 `undefined`라 테마 규칙 전부 미적용(다크 블록조차). 그래서 값이 다크로 하드코딩돼 있었음 → `App.jsx` 루트에서 `useTheme()` 호출 + `[data-theme="light"]` 오버라이드 추가 |
| 2026-08-05 | 모달 열린 상태에서 뒤로가기 → 모달이 안 닫히고 앱 종료 확인으로 직행 | `useAndroidBackButton`이 `location.pathname`만 보고 오버레이 상태를 모름 → 최상단 백드롭을 `click()`해 "바깥 탭"과 동일 처리 후 `return` |
| 2026-08-05 | AI 기능 사용 후 헤더 토큰 배지가 새로고침 전까지 이전 값 유지 | 차감 지점 대부분이 응답에 잔액 미포함 → 4개 라우트에 `token_balance` 추가 + 프론트 3곳에 `setBalance` 연결. `ReportsCustomizePage`는 `setBalance` 호출 중이었으나 백엔드가 값을 안 줘 무동작 |
| 2026-08-05 | 스크린샷 인식 0건인데 5토큰 차감 | `deductTokens`가 빈 결과 체크보다 먼저 호출됨 → 차감 시점을 분기 이후로 이동(환급 아님, 레이스 회피). 기존 피해 이력은 `token_usage_log` 조회 결과 0건 |
| 2026-08-05 | CDP(`Runtime.evaluate`)가 응답 없이 멈춤 — 크래시로 오인 | ① 앱이 백그라운드로 내려가면 삼성 Freecess가 프로세스를 freeze(`D ActivityManager: freezing <pid>`) ② JS `confirm()` 다이얼로그가 렌더러를 블록. ①은 `am start`로 포그라운드 복귀 후 `adb forward` 재설정, ②는 `Page.enable` + `Page.handleJavaScriptDialog`로 해제 |
| 2026-08-05 | `adb shell input tap`이 다른 앱(개인 메신저·Play Store·금융 앱)으로 들어감 | 앱이 백그라운드인 줄 모르고 좌표 탭 전송. 금융 앱 송금 버튼 노출 화면이라 위험했음 → 탭 전 `topResumedActivity` 검증 필수, 이후 좌표 탭 전면 금지·관찰 전용 전환 |
| 2026-08-05 | 실기기에서 WebView의 모든 외부 요청이 `Failed to fetch` (기기 네트워크는 정상) | 화면 꺼진 채 절전 모드라 `dumpsys netpolicy`가 `blocked_state={effective=BATTERY_SAVER\|APP_BACKGROUND}`로 앱 소켓 차단. 액티비티는 `ResumedActivity`로 보여 혼동 → `low_power=0` + 화면 켜기로 해결, 테스트 후 원복 |
| 2026-08-05 | AI 검색이 엉뚱한 동명 작품 반환 + 특정 질의는 0건 | 원인 3개가 겹쳤고 **두 증상의 원인이 서로 달랐음**. ① AI가 장르 설명어("Hong Kong noir 1990s") 반환 → TMDB 제목 색인 0건(매칭 실패 아님) ② `vote_average` 단독 정렬 — 표 3개 8.3점이 표 19,635개 7.6점을 이김 ③ 영어 키워드 경로가 `en-US`라 줄거리 영문 → 스키마 강제 + `tmdbMatch.js` 점수화 + `ko-KR` 통일로 해결 |
| 2026-08-05 | TMDB 매칭에서 *One Hour Photo*(한국 제목 "스토커")가 타르코프스키 *Stalker*를 이김 | TMDB `original_title`이 원어(`Сталкер`)라 문자열 유사도 0에 가까움 → 연도를 걸고 검색해도 TMDB가 돌려준 후보에 가산점(색인이 별칭 제목까지 포함해 동의했다는 신호). 단 이 가산점이 무명작을 통과시켜 표 100개 조건 추가 |
| 2026-08-05 | `"Snowpiercer"`가 포함된 표 1개짜리 특별판 애니가 설국열차를 밀어냄 | 포함 관계에 무조건 0.85를 주던 유사도 계산 → `0.85 × (짧은 쪽/긴 쪽)` 길이 비율로 스케일. 연도·표가 모두 없는 TMDB 스텁도 제외 |
| 2026-08-05 | 리포트 "다시 생성" 버튼이 아무 동작도 안 함 | `/generate`가 기존 리포트가 있으면 무조건 `cached: true` 조기 반환 → 아래 `ON CONFLICT DO UPDATE`에 도달 불가. UI 안내("덮어씁니다")와 실제 동작 불일치 → `regenerate` 플래그로 캐시 우회 |
| 2026-08-05 | gradle 파일 2개가 계속 `modified` (내용 차이 없음) | 줄바꿈 문제로 오진했으나 **워크트리 해시가 HEAD blob과 동일**. 실제 원인은 `cap sync`가 같은 내용으로 재작성해 mtime만 바뀐 **git stat 캐시 불일치** → `git add`로 인덱스 stat 갱신(스테이징 0). 재발 방지용 `.gitattributes` 별도 추가 |
| 2026-08-05 | curl로 보낸 한글 쿼리가 서버에서 "홍길동"으로 해석됨 | AI 비결정성으로 오진 → DB 저장 바이트가 `efbfbd`(U+FFFD) 반복. Git Bash가 한글을 UTF-8 아닌 바이트로 curl에 넘겨 도착 시점에 이미 깨짐. 기기 WebView 요청은 정상 → **관측값이 이상하면 관측 도구부터 검증** |
| 2026-08-12 | 수식어 카드용 TMDB 포스터가 `crossOrigin="anonymous"` 로드에서 매번 실패 (taint) | TMDB CDN은 실제로 `Access-Control-Allow-Origin: *`를 보냄(curl로 확인) — CORS 미지원이 원인이 아니었음. 같은 포스터 URL이 앱 다른 화면에서 이미 crossOrigin 없이 `<img>`로 로드된 뒤라 브라우저가 그 캐시(오염된 상태)를 재사용해 이후 crossOrigin 요청이 서버 재검증 없이 실패 — 재현 확인(같은 URL을 캐시 무효 상태에서 먼저 요청하면 성공). 캐시 키를 분리하는 더미 쿼리 파라미터(`?_cors=1`)를 붙여 우회 |

---

## 문서화 규칙

세션 **시작 시**: `STATUS.md` 먼저 읽고 진행 중 / 다음 할 일 확인.

세션 종료 전 필수:
1. `STATUS.md` 업데이트 (진행 중·다음 할 일·완료 이력 + 최종 갱신 날짜)
2. `docs/daily/YYYY-MM-DD.md` 업데이트
3. 기술 결정 있었으면 위 로그에 추가
4. 트러블슈팅 있었으면 위 로그에 추가

위 두 로그가 다시 길어지면 오래된 항목을 `docs/*/log-archive.md`로 옮기고 최근 것만 남긴다.

---

## ROADMAP 연동

`phase/ROADMAP.md`(Phase 3-4), `_V2`(5), `_V3`(6-7), `_V4`(8), `_V5`(9), `_V6`(10),
`_V7`(11 — Google Play Store 출시, Capacitor 네이티브 래핑 + 플랫폼 분기 결제) 순으로 진행.
새 작업 전 해당 ROADMAP 읽고 미완료 항목 확인. 완료 시 ROADMAP 업데이트.

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
