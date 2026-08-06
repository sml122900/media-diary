# 트러블슈팅 로그 아카이브 (~2026-07-30)

CLAUDE.md의 트러블슈팅 로그가 길어져 2026-07-30 이전 항목을 이곳으로 옮겼습니다.
CLAUDE.md에는 최근 항목(2026-08-02~)만 남겨 두었습니다.
개별 사건의 상세 기록은 이 폴더의 문서별 파일을 참고하세요.

| 날짜 | 문제 | 해결 방법 |
|------|------|----------|
| 2026-05-05 | `.mposter` opacity가 포스터 이미지까지 반투명 | 이모지 span에만 opacity, 이미지에 z-index: 1 |
| 2026-05-05 | 편집 저장 후 재편집 시 이전 값 잔존 | 편집 버튼 클릭 시 editFields를 현재 props로 재초기화 |
| 2026-05-05 | 배치 INSERT 파라미터 인덱스 충돌 | idx * F + offset으로 배치별 플레이스홀더 수동 계산 |
| 2026-05-05 | tmdb_id를 잘못된 타입으로 조회해 엉뚱한 제목으로 덮어씀 | 제목 자동 동기화 제거, TMDB 검색으로 추가하는 방식 전환 |
| 2026-05-11 | Express 5 서버 시작 실패 (`router.get('*', ...)`) | path-to-regexp v8 Breaking Change → 정규식 `/(.*)/` 으로 변경 |
| 2026-05-11 | anime 포스터 프리패치가 엉뚱한 결과 반환 | movie 타입으로 조회하던 버그 → `item.type !== 'movie'`면 'tv'로 분기 |
| 2026-05-12 | YIR 캐시 항상 만료 (ageHours: 9) | pg가 TIMESTAMP를 KST로 파싱 → JS Date.now()와 9h 차이 → EXTRACT(EPOCH FROM (NOW()-col)) 패턴 |
| 2026-05-12 | Wishlist /watched 500 오류 | UNIQUE 재설계 후 ON CONFLICT (user_id,title,year) 참조 잔존 → (user_id,title,year,rewatch_count)로 수정 |
| 2026-05-13 | baeksang-drama-winners 중복 표시 | kr-drama 필터가 awards까지 포함 → `&& l.category !== 'awards'` 추가 |
| 2026-05-13 | TMDB 미매칭 5개 (tmdb_id: 0 잔존) | fill-tmdb-ids.js가 못 찾은 항목 수동 TMDB 검색 후 DB UPDATE + JSON 동기화 |
| 2026-05-14 | 큐레이션 ID 60건 오류 (수동 입력 오류 + 배치 스크립트 버그) | 전수 검증 스크립트로 발견 → fix-curation-ids.js 2회 실행, MCU 순환 swap은 임시값(999999) 경유 |
| 2026-05-14 | seed-curation.js 재실행으로 오류 수정 불가 | ON CONFLICT DO NOTHING 제약 → 별도 UPDATE/DELETE 스크립트 필요 |
| 2026-05-14 | 가장 따뜻한 색, 블루 수정 오류 (152584→129575 → 재수정) | 칸 리스트의 129575가 오류였는데 world-cinema의 정상값 152584를 대신 수정 → 재역전 처리 |
| 2026-05-14 | BillingSuccessPage auth race condition | useEffect가 token=null에서 실행 → isLoading 의존성 추가로 auth 초기화 후 실행 |
| 2026-07-20 | ANDROID_HOME이 VSCode 재시작 후에도 세션에 미반영 | 레지스트리엔 정상 등록됐으나 세션 셸이 예전 환경 스냅샷 유지 → 명령마다 export로 우회 (근본 해결은 재부팅) |
| 2026-07-30 | Vercel 배포에서 /policy/privacy 직접 접근 시 404 | vercel.json 부재로 SPA fallback 미설정 → rewrites로 모든 경로를 index.html로 전달 |
| 2026-07-30 | "짱구는 못말려" 검색 시 극장판 10개 안팎만 표시 (실제 32편) | searchTmdb가 TMDB page=1만 조회 → 최대 3페이지(60개) 병합 + dedupe |
| 2026-07-30 | "다크나이트"(붙여쓰기) 검색 시 "다크 나이트" 결과 누락 | TMDB가 한글 쿼리를 공백 기준 토큰 매칭 → 결과 3개 미만일 때 공백 1개 삽입 변형(최대 12개) fallback 검색 |
| 2026-07-30 | 🪙 이모지가 구형 Android WebView에서 빈 네모(tofu) | Unicode 13.0(2020) 신규 이모지라 폰트 미지원 → stroke 기반 인라인 SVG(TokenIcon)로 교체 |
