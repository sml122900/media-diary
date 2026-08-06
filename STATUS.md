# STATUS — 미디어 다이어리 진행 상황

> **작업을 이어갈 때 가장 먼저 읽는 파일.** 진행 상황은 여기에만 기록한다.
> 기술 결정·트러블슈팅 로그는 `CLAUDE.md`(최근 항목) 및 `docs/*/log-archive.md`(2026-07-30 이전),
> 단계별 계획은 `phase/ROADMAP_V*.md`, 날짜별 상세는 `docs/daily/`.
>
> **최종 갱신:** 2026-08-06

---

## 진행 중

**Phase 11 (Google Play Store 출시)** — Stage 11.2 Capacitor 셋업 (실기기 빌드·설치·동작 확인까지 완료)

**블로킹 이슈:** 없음

---

## 다음 할 일

- **이슈 C 실기기 검증 대기** — 로컬 실측은 완료, 배포 후 기기 확인만 남음. AI 검색 4건 + `discover/chat` + `restore/chat` = 8토큰 예상
- **`customize-chat` 빈 결과 검증** — 의도적 유도가 어려워 배포 후 `token_usage_log`에서 `feature='report_chat' AND tokens_used=0` 누적 관찰 방식으로 합의
- 빈 결과 남용 여부는 `token_usage_log`의 `metadata.empty_result` 누적치를 보고 판단 (일일 상한은 현재 미도입)
- 릴리스 keystore는 Stage 11.4 생성 시 클라우드+로컬 이중 백업 (**생성 직후·첫 업로드 이전**에 수행)
- Phase 9 운영 전환 (사업자 등록 → 토스 정식 계약 → 운영 키 교체)
- 배포 (Render 백엔드 + Vercel 프론트엔드) — VITE_TOSS_CLIENT_KEY, TOSS_SECRET_KEY 환경변수 추가 필요
- 브라우저 UI 결제 플로우 테스트 (결제 취소 시나리오)
- 모바일 실기기 UI 점검 — **피드/프로필/위시리스트/리스트/온보딩/결제 화면은 여전히 미점검** (홈·메뉴·검색·AI 검색·통계·뒤로가기·이모지는 2026-08-05 완료)
- Letterboxd CSV 실제 파일로 파싱 검증
- `KNOWN_ISSUES.md`·`CHECKLIST.md`가 Phase 7(2026-05-13) 기준에서 멈춰 있음 — 현재 시점으로 갱신 필요

---

## 작업 환경 주의사항

- **실기기 테스트 시 절전 모드를 꺼야 함** — 화면이 꺼지면 `netpolicy`가 앱 네트워크를 차단(`BATTERY_SAVER|APP_BACKGROUND`)해 WebView의 모든 외부 요청이 실패한다. 테스트 후 원복 필요
- **USB 케이블·포트 점검 권장** — 2026-08-05 세션 2에서 실기기 연결이 2회 끊김. 끊길 때마다 잠금 해제부터 재시작해야 함
- **Python은 설치돼 있으나 실행 중인 셸 PATH에는 없을 수 있음** — 2026-08-06에 `Python 3.13.14` 설치(winget). `python`을 치면 Microsoft Store 스텁이 잡힐 수 있으니 새 셸을 열거나 전체 경로 `%LOCALAPPDATA%\Programs\Python\Python313\python.exe`를 쓸 것. `ANDROID_HOME`(2026-07-20)·`JAVA_HOME`(2026-08-02)과 같은 현상

---

## 완료 이력

### 최근 세션

- **2026-08-06 — CLAUDE.md 압축·구조 정리 (346줄 → 166줄)**: 세션 시작마다 읽히는 파일이라 입력 토큰 절감이 목적
  - 문장 압축만으로는 4.8%에 그침 — 파일 대부분이 보존해야 할 코드 블록·인라인 코드 137개·인과 설명인 한국어 로그 표였음
  - **폴더 구조·API 엔드포인트·DB 스키마·버전 표 4개 섹션이 실제 코드와 어긋나 있어 제거** (routes 2개 기재/실제 21개, DB 스키마의 `UNIQUE`가 같은 문서 기술 결정 로그와 모순). 각각 원본 위치를 가리키는 문장으로 대체
  - 로그 표는 2026-07-30 이전 항목을 `docs/decisions/log-archive.md`·`docs/troubleshooting/log-archive.md`로 이관 (원본 80행 = 본문 39 + 아카이브 41, 손실 0)
  - `Python 3.13.14` 설치(winget) — 압축 스킬의 `validate.py` 실행에 필요했음
  - **`STATUS.md`가 git에 추적되지 않고 있던 것을 발견해 이번 커밋에 포함** (`.gitignore` 문제 아니고 `git add` 누락). `CLAUDE.md`는 원래부터 정상 추적 중
  - 상세: `docs/daily/2026-08-06.md`
- **2026-08-05 세션 2 — 배포 후 검증 + 토큰 정합성 + 이슈 C 해결** (커밋 9개): 세션 1의 미해결 3건을 모두 처리
  - 배포 후 4경로 실기기 검증 통과 (배지·서버 잔액 전부 일치, 빈 결과 0토큰 로그 확인)
  - 토큰 정합성 4건 — `/reports` 배지, AI 검색·`customize-chat` 빈 결과 무차감, **차감 시점을 `res.json` 직전으로 통일**(4개 라우트, 차감 후 실패 시 과금되던 문제)
  - 종료 확인 커스텀 다이얼로그 (네이티브 `confirm()` 영문 버튼 제거, 다크/라이트 대응)
  - 리포트 "다시 생성" 무동작 수정(`regenerate` 플래그), 잔액 조회를 App 루트로 통합
  - **이슈 C 해결** — AI 응답 `tool_choice` + 구조화 스키마 강제, `tmdbMatch.js` 공통 모듈 신설(제목 유사도·연도·표수 점수화), `ko-KR` 통일. 0건이던 "90년대 홍콩 느와르"가 6건 정상 반환. `docs/troubleshooting/ai-search-wrong-results.md` 참고
  - 커밋 `d7f70a5`·`41aac9b`·`2b2e4fd`·`b20afe5`·`4b58979`·`c4eeba8`·`278f84b`·`987c4ec`·`e4a5888`
- **2026-08-05 세션 1 — 실기기 전수 테스트 + 발견 이슈 수정**: 갤럭시 SM-S942N(Android 16)에서 7개 항목 점검 → 통계 페이지 가로 깨짐(`.chart-card min-width:0`), 연대별 정렬 NaN, 다크모드 하드코딩 색상 일괄 정리, Phase 10 라이트 모드 지원(`useTheme` 루트 호출), 모달 뒤로가기, 토큰 배지 즉시 갱신, 스크린샷 빈 결과 무차감. 커밋 `0a037e2`·`060ae76`·`aebed00`·`af041c2`
- **2026-08-02 — 모바일 메뉴 오버레이 드로어 전환**: 600px 이하에서 헤더 드롭다운이 뷰포트를 −6px 이탈해 항목 첫 글자가 잘리던 문제를 `position: fixed` 우측 드로어 + 백드롭으로 해결, 데스크톱 무변경. 실기기(갤럭시) APK 설치로 동작 확인 완료
  - Adoptium Temurin 21 설치 + `JAVA_HOME` 전환 완료 (플래그 없이 `assembleDebug` 성공, 27초)
  - `~/.android/debug.keystore` 백업 완료 (2026-08-05 재설치 6회 모두 `install -r`로 처리되어 효과 확인)
- **2026-07-30 — 배포/검색 버그 수정 묶음**: Vercel SPA 404 (vercel.json), TMDB 단일검색 페이지네이션 누락 (3페이지 병합), 검색 띄어쓰기 미스매치 (내 목록 정규화 + TMDB 공백 삽입 fallback), 토큰 잔액 🪙 이모지 tofu 렌더링 → SVG 아이콘(TokenIcon) 교체

### 기능 완성 목록

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
