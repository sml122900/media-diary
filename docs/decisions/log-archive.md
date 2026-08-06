# 기술 결정 로그 아카이브 (~2026-07-30)

CLAUDE.md의 기술 결정 로그가 길어져 2026-07-30 이전 항목을 이곳으로 옮겼습니다.
CLAUDE.md에는 최근 항목(2026-08-02~)만 남겨 두었습니다.
개별 결정의 상세 배경은 이 폴더의 문서별 파일을 참고하세요.

| 날짜 | 결정 | 이유 | 포기한 대안 |
|------|------|------|------------|
| 2026-05-05 | DB: Supabase (PostgreSQL) | 무료 플랜, pg로 직접 쿼리 | Firebase, SQLite |
| 2026-05-05 | 첫 로그인 시 기본 데이터 시딩 | 빈 화면 방지, 즉시 체험 | 빈 상태 시작 |
| 2026-05-11 | TMDB API 백엔드 프록시로 이전 | API 키 노출 방지, 캐싱/Rate Limit 관리 용이 | 프론트 직접 호출 |
| 2026-05-11 | 컴포넌트/훅/유틸 3레이어 분리 | 950줄 단일 파일 → 독립 모듈, 확장성 | 단일 파일 유지 |
| 2026-05-11 | watched_at TIMESTAMP 컬럼 추가 | 이번 달/올해 감상 통계, 최근 감상 정렬 | review_date 문자열 파싱 |
| 2026-05-12 | 재시청 UNIQUE 재설계 (user_id,title,year) → (user_id,title,year,rewatch_count) | 재시청 허용 + 중복 방지 유지 | UNIQUE 전체 제거 |
| 2026-05-12 | DB 시간 비교 EXTRACT(EPOCH) 패턴 | pg TIMESTAMP vs JS Date.now() 비교 시 KST +9h 오차 | TIMESTAMPTZ 컬럼 전환 |
| 2026-05-12 | /api/wishlist → /api/me/watchlist 경로 통일 | me 컨텍스트 일관성 (/api/me/watch-stats 등과 동일) | /api/wishlist 유지 |
| 2026-05-13 | Claude tool_choice: any (강제 도구 호출) | 텍스트 → 구조화 JSON 보장, 파싱 실패 제거 | system prompt JSON 요구 |
| 2026-05-13 | 큐레이션 계층 SUPER_GROUPS (프론트 정의) | DB 신규 컬럼 없이 2단계 아코디언 구현 | subcategory 컬럼 추가 |
| 2026-05-13 | 시드 3스크립트 파이프라인 (fill→fetch→seed) | 50개 리스트 반복 실행, 데이터 업데이트 용이 | 단일 스크립트 |
| 2026-05-13 | person/search 라우트 먼저 등록 | :tmdbId 패턴이 'search'를 캡처하는 충돌 방지 | 라우트 순서 무관 |
| 2026-05-14 | 이미지 프록시 패턴 (html2canvas CORS 우회) | 원본 URL 캐시 오염 방지, 프록시 URL로 캐시 충돌 제거 | img crossOrigin 일괄 추가 |
| 2026-05-14 | crypto.randomUUID() 클라이언트 세션 ID | 서버 세션 테이블 불필요, JWT와 동일 stateless | 서버에서 session_id 발급 |
| 2026-05-14 | 리포트 항목 COMPONENT_PROMPTS 상수 분리 | templateId별 지시문 동적 구성, 항목 추가 시 상수만 수정 | 프롬프트 하드코딩 |
| 2026-05-14 | byFeature 동적 집계 (하드코딩 제거) | 신규 feature 자동 포함, 코드 변경 불필요 | 기능 추가마다 수동 등록 |
| 2026-07-20 | Capacitor 네이티브 래핑 채택 (WebView + Bridge, 번들 모드) | 웹 자산 재사용으로 Google Play 출시, 재작성 불필요 | React Native 재작성, PWA만 유지 |
| 2026-07-20 | AndroidManifest screenOrientation=portrait 고정 | 카드 그리드·모달 UX라 세로 전용이 자연스러움 | 양방향 지원 + 반응형 |
| 2026-07-30 | Vercel SPA fallback rewrite (frontend/vercel.json) | 클라 라우팅 경로 직접 접근 404 방지, Play Console 제출 URL 필요 | 서버사이드 라우팅 전환 |
| 2026-07-30 | TMDB 단일 검색 결과 최대 3페이지(60개) 병합 | 프랜차이즈 등 결과 많은 작품이 1페이지로 잘림 | 프론트 무한스크롤 UI |
| 2026-07-30 | 공백 1개 삽입 검색 fallback (선형, 길이-1개 변형) | TMDB가 붙여쓴 한글을 공백 토큰 매칭 → 결과 3개 미만일 때만 트리거, 조합 폭발 없이 실사용 대부분 커버 | 검색 팁 문구만 제공 |
| 2026-07-30 | 이모지 대신 인라인 SVG 아이콘(TokenIcon) 사용 | 🪙(Unicode 13.0)가 구형 Android WebView에서 tofu로 깨짐, Capacitor 배포 대비 | lucide-react 추가 |
