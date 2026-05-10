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
