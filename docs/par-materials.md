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

## 키워드 뱅크 (기술 스택 & 성과 표현)

- React, Vite, Zustand, React Router
- Node.js, Express, PostgreSQL, Supabase
- JWT 인증, REST API 설계
- TMDB API 연동, 외부 API 클라이언트
- 배치 INSERT 최적화, UNIQUE 제약조건 upsert
- React StrictMode, useEffect 생명주기
- 디바운스, 실시간 검색 UX
- DB 데이터 복구, 무결성 관리
