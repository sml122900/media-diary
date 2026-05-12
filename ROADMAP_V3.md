# 미디어 다이어리 — Phase 6 로드맵 (과거 기록 복원)

> 이 문서는 Claude Code가 자동으로 참고하며 작업하는 로드맵입니다.
> ROADMAP.md, ROADMAP_V2.md 다음 단계 (Phase 6) 작업에 사용합니다.
> 작성일: 2026-05-12

---

## 📌 작업 원칙

- Stage 단위로 순차 진행 (6.1 → 6.2 → 6.3 → ...)
- 각 작업 완료 시 체크박스 [x] 처리 및 이 문서 업데이트
- 한 Stage가 완전히 끝나야 다음 Stage로 진행
- 큰 변경사항은 git commit (`feat:`, `fix:`, `refactor:` prefix)
- 모든 코드에 한국어 주석 포함
- DB 마이그레이션은 Supabase SQL Editor에서 실행할 SQL을 사용자에게 안내 후 적용
- UI 시각 확인이 필요한 항목은 사용자 확인 체크리스트로 별도 정리
- **Claude API 비용 발생 작업은 사용자에게 사전 안내 (호출 빈도, 예상 비용 등)**

---

## 🎯 이 Phase의 본질

**"이미 본 작품 100편을 15분 안에 정리하게 해주는 도구"**

지금까지 미디어 다이어리는 "지금부터 기록하는" 도구였습니다.
Phase 6는 "과거를 끌어모으는" 도구를 추가합니다.

---

## 🚫 제외 항목

- 무료 한도 결제 시스템 (별도 Phase로 분리)
- 외부 서비스 자동 크롤링 (저작권/약관 위반 가능성)

---

## Stage 6.1 — 큐레이션 체크 (최우선, 가장 빠른 가치)

> 명작 리스트를 보여주고 본 것만 체크하게 함
> 5일 작업 예상

### 데이터베이스

- [x] **`curation_lists` 테이블 신설**
  ```sql
  CREATE TABLE curation_lists (
    id BIGSERIAL PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,      -- 'marvel-mcu', 'bong-joon-ho' 등
    title TEXT NOT NULL,            -- '마블 시네마틱 유니버스'
    category TEXT NOT NULL,         -- 'franchise', 'director', 'awards', 'boxoffice'
    description TEXT,
    region TEXT,                    -- 'kr' | 'global'
    media_type TEXT,                -- 'movie' | 'drama' | 'anime'
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [x] **`curation_items` 테이블 신설**
  ```sql
  CREATE TABLE curation_items (
    id BIGSERIAL PRIMARY KEY,
    list_id BIGINT NOT NULL REFERENCES curation_lists(id) ON DELETE CASCADE,
    tmdb_id INTEGER NOT NULL,
    tmdb_type TEXT NOT NULL,        -- 'movie' | 'tv'
    title TEXT NOT NULL,
    year INTEGER,
    poster_path TEXT,
    display_order INTEGER DEFAULT 0,
    UNIQUE(list_id, tmdb_id)
  );
  ```

### 큐레이션 데이터 준비

- [x] **JSON 시드 데이터 작성**
  - `backend/seed/curation/franchises.json` (MCU 35편)
  - `backend/seed/curation/korean-directors.json` (봉준호 8편, 박찬욱 11편)
  - `backend/seed/curation/foreign-directors.json` (놀란 12편)
  - `backend/seed/curation/awards.json` (아카데미 20편, 칸 19편)
  - `backend/seed/curation/boxoffice-korean.json` (한국 박스오피스 TOP 30)
  - `backend/seed/curation/korean-dramas.json` (시청률 TOP 25 + 백상수상작 11편)
  - `backend/seed/curation/ghibli.json` (지브리 24편, 픽사 28편)
  - `backend/seed/curation/anime-classics.json` (성인 애니 24편)

- [x] **시드 스크립트 작성**
  - `backend/scripts/seed-curation.js` — DB 삽입 (12개 리스트, 247개 아이템)
  - `backend/scripts/fill-tmdb-ids.js` — TMDB ID 자동 매칭 (64개 채움)
  - `backend/scripts/fetch-curation-posters.js` — 포스터 경로 수집 (233개)

- [x] **Claude Code 작업: 큐레이션 JSON 생성 도움**
  - 각 카테고리별 작품 목록 작성 완료
  - fill-tmdb-ids.js 스크립트로 TMDB ID 자동 매칭 완료

### 백엔드 API

- [x] **GET /api/curation/lists**
  - 모든 큐레이션 리스트 카테고리별 그룹핑
  - 응답: `{ franchise: [...], director: [...], awards: [...], ... }`

- [x] **GET /api/curation/lists/:slug/items**
  - 특정 리스트의 작품 목록
  - 로그인 사용자: `already_added: true` 마킹

- [x] **POST /api/curation/bulk-add**
  - 요청: `{ items: [{ tmdb_id, tmdb_type, title, year }] }`
  - TMDB에서 상세 정보 가져와서 user_media에 일괄 저장
  - 이미 있는 작품은 스킵
  - 응답: `{ added: N, skipped: M }`

### 프론트엔드

- [x] **`/restore` 라우트 신설**
  - 복원 모드 진입 페이지 (RestorePage.jsx)
  - 카테고리별 큐레이션 카드 표시

- [x] **CurationListPage 컴포넌트**
  - 리스트 클릭 시 작품 그리드 표시 (CurationListPage.jsx)
  - 각 작품에 체크박스 (선택 시 강조)
  - "선택한 N개 추가" 버튼 (하단 고정)
  - 이미 추가한 작품은 회색 + "추가됨" 표시

- [x] **모바일 최적화**
  - auto-fill 그리드 (모바일 100px 최소 폭)
  - 큰 터치 영역 (포스터 전체 클릭)
  - 하단 고정 "N개 내 목록에 추가" 버튼

### 사용자 확인 체크리스트

- [ ] /restore 페이지가 카테고리별로 잘 표시되는지
- [ ] 큐레이션 리스트 클릭 시 작품들이 자연스럽게 로드되는지
- [ ] 체크박스 선택이 모바일에서 잘 동작하는지
- [ ] "선택한 N개 추가" 버튼이 정상 작동하는지
- [ ] 이미 추가한 작품이 올바르게 회색 처리되는지

---

## Stage 6.2 — AI 대화형 기억 복원 (차별화 핵심)

> Claude와 자유 대화하면서 "내가 봤을 만한 작품" 찾기
> 7일 작업 예상

### 사전 준비

- [ ] **Claude API 비용 안내**
  - 사용자에게 예상 비용 안내 (대화 1회당 약 1-3센트)
  - 일일 사용량 제한 설정 (사용자별 30회/일)
  - `users` 테이블에 `daily_chat_count`, `last_chat_reset_at` 컬럼 추가

### 데이터베이스

- [ ] **`memory_chats` 테이블 신설**
  ```sql
  CREATE TABLE memory_chats (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,             -- 'user' | 'assistant'
    content TEXT NOT NULL,
    suggested_works JSONB,          -- AI가 제안한 작품 배열
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

### 백엔드 API

- [ ] **POST /api/restore/chat**
  - 요청: `{ message: "90년대 SF 영화 좋아했어요" }`
  - Claude API 호출 (tool use 활용)
  - Claude가 TMDB 검색 → 후보 작품 추출
  - 응답: `{ message: "이런 작품들 어때요?", suggestions: [...] }`

- [ ] **Claude 시스템 프롬프트 설계**
  ```
  당신은 사용자가 평생 본 영화/드라마/애니메이션을 기억해내도록 돕는 도우미입니다.
  
  사용자의 막연한 기억을 구체적인 작품 후보로 변환하세요.
  
  도구 사용:
  - search_tmdb: 작품 검색
  - get_user_existing: 사용자가 이미 추가한 작품 목록 (중복 방지)
  
  응답 시 항상 5-10개 정도의 구체적인 작품 후보를 제시하세요.
  ```

- [ ] **GET /api/restore/chat/history**
  - 사용자의 대화 히스토리 (최근 50개)

- [ ] **POST /api/restore/chat/accept**
  - 요청: `{ tmdb_ids: [...] }`
  - 선택한 작품들 일괄 추가
  - bulk-add API 재사용

### 프론트엔드

- [ ] **`/restore/chat` 라우트**
  - 채팅 UI (메신저 스타일)
  - 사용자 메시지 우측, AI 메시지 좌측
  - AI 메시지 안에 작품 카드 그리드 임베드
  - 각 작품 카드에 체크박스

- [ ] **MemoryChat 컴포넌트**
  - 메시지 입력창 (하단 고정)
  - 스트리밍 응답 표시 (선택)
  - "이 작품들 추가하기" 버튼

- [ ] **추천 시작 질문**
  - 빈 화면일 때 예시 질문 노출:
    - "고등학생 때 봤던 영화들이 기억 안 나요"
    - "마블 영화 다 봤어요"
    - "픽사 작품 좋아해요"
    - "90년대 한국 영화 보고 싶어요"

### 사용자 확인 체크리스트

- [ ] 채팅 UI가 모바일에서 자연스러운지
- [ ] AI 응답 안의 작품 카드가 잘 보이는지
- [ ] 체크박스 선택 후 일괄 추가가 정상 동작하는지
- [ ] 대화 히스토리가 새로고침 후에도 유지되는지
- [ ] 일일 한도 초과 시 메시지가 적절한지

---

## Stage 6.3 — 스크린샷 인식 강화

> Phase 3에서 일부 구현된 기능을 본격적으로 강화
> 5일 작업 예상

### 사전 준비

- [ ] **기존 ScreenshotImportModal 컴포넌트 분석**
  - 현재 어떤 OTT를 지원하는지 확인
  - 정확도 이슈 파악

### 백엔드

- [ ] **POST /api/restore/screenshot 강화**
  - 멀티 이미지 업로드 지원 (최대 10장)
  - Claude Vision에 OTT/영화관 앱 종류 힌트 전달
  - 시스템 프롬프트:
    ```
    이 이미지는 한국 사용자의 OTT 또는 영화관 앱의 시청 기록입니다.
    추출 대상:
    - 영화/드라마 제목
    - (가능하면) 연도
    
    한국 작품과 해외 작품 구분.
    제목이 한글이면 한글 그대로 추출.
    JSON 배열로 반환: [{"title": "...", "year": ..., "type": "movie"|"tv"}]
    ```

- [ ] **OTT/영화관 종류 선택 UI 지원**
  - 사용자가 어떤 앱 캡처인지 선택하면 정확도 향상 힌트로 사용
  - 지원 옵션: 넷플릭스, 왓챠, 티빙, 디즈니+, 쿠팡플레이, 웨이브, CGV, 메가박스, 롯데시네마, 기타

- [ ] **추출 결과 검토 UI 강화**
  - 추출된 작품들을 TMDB로 자동 매칭
  - 매칭 신뢰도 표시 (정확도 색상)
  - 사용자가 매칭 결과 수정 가능 (TMDB 재검색)
  - 매칭 실패 항목은 별도 표시

### 프론트엔드

- [ ] **ScreenshotImportModal 강화**
  - 드래그 앤 드롭 멀티 업로드
  - 업로드 진행률 표시
  - OTT/영화관 종류 선택 드롭다운

- [ ] **추출 결과 검토 화면**
  - 각 항목에 체크박스
  - TMDB 매칭 결과 미리보기 (포스터 + 제목)
  - 매칭 안 된 항목 수동 검색 가능
  - "선택한 항목 추가" 버튼

### 사용자 확인 체크리스트

- [ ] 멀티 업로드가 모바일에서도 가능한지
- [ ] 다양한 OTT 캡처에서 정확도가 충분한지
- [ ] 영화관 앱 캡처 (CGV, 메가박스, 롯데시네마)에서 동작하는지
- [ ] 매칭 실패 항목 수동 처리가 자연스러운지

---

## Stage 6.4 — 복원 모드 통합 (온보딩)

> 6.1-6.3 기능을 신규 가입자에게 단일 흐름으로 제공
> 4일 작업 예상

### 데이터베이스

- [ ] **`users` 테이블 확장**
  - `onboarding_completed BOOLEAN DEFAULT false` 컬럼 추가
  - `onboarding_step INTEGER DEFAULT 0` (어디까지 진행했는지)

### 백엔드 API

- [ ] **POST /api/onboarding/skip**
  - 온보딩 건너뛰기
  - onboarding_completed = true

- [ ] **POST /api/onboarding/complete**
  - 온보딩 완료 처리

- [ ] **GET /api/onboarding/status**
  - 현재 단계 조회

### 프론트엔드

- [ ] **OnboardingFlow 컴포넌트**
  - 5단계 마법사:
    1. 환영 — "이미 본 작품 100편을 15분 안에 정리해드릴게요"
    2. 큐레이션 체크 — 인기 카테고리 5개만 (마블, 봉준호, 박스오피스, 지브리, 한국드라마)
    3. AI 대화 (선택) — "더 추가할 게 있나요?"
    4. 스크린샷 업로드 (선택) — "OTT 기록 있으시면 올려주세요"
    5. 완료 — "X편 추가됐어요. 환영합니다"

- [ ] **각 단계 건너뛰기 가능**
  - 모든 단계에 "건너뛰기" 버튼
  - 강제하지 않음

- [ ] **신규 가입 후 자동 진입**
  - 회원가입 성공 시 /onboarding으로 리다이렉트
  - `onboarding_completed = false`인 경우 자동 진입

- [ ] **기존 사용자도 진입 가능**
  - 메뉴에 "복원 모드 시작" 추가
  - 처음부터 다시 진행

### 사용자 확인 체크리스트

- [ ] 회원가입 후 온보딩이 자동 진입되는지
- [ ] 각 단계 건너뛰기가 동작하는지
- [ ] 완료 후 메인 화면으로 자연스럽게 이동하는지
- [ ] 기존 사용자도 메뉴에서 진입 가능한지
- [ ] 모바일에서 마법사 UI가 자연스러운지

---

## Stage 6.5 — 부가 기능

> 우선순위 낮은 보강 기능들
> 3일 작업 예상

### 6.5.1 시청 시기 태그

- [ ] **`user_media.life_period` 컬럼 추가**
  - 자유 텍스트 (예: "고등학생 때", "군대에서", "2010년대 초")
  - 옵셔널

- [ ] **DetailModal에 입력 필드 추가**
  - 시청 시기 자유 입력
  - 추천 칩 (어린 시절, 학창 시절, 군대, 직장 등)

- [ ] **통계 페이지에 "그 시절" 그룹핑**
  - life_period별 작품 그룹 표시

### 6.5.2 Letterboxd CSV 가져오기 (선택)

- [ ] **POST /api/restore/letterboxd-csv**
  - CSV 파일 업로드
  - Letterboxd 포맷 파싱
  - TMDB 매칭 후 일괄 추가

- [ ] **파일 업로드 UI**
  - /restore 페이지에 "Letterboxd CSV 가져오기" 옵션

### 사용자 확인 체크리스트

- [ ] 시청 시기 태그 입력이 자연스러운지
- [ ] 통계 페이지의 시기별 그룹이 의미 있는지
- [ ] Letterboxd CSV가 정상 파싱되는지 (테스트 파일 필요)

---

## 🔧 기술 부채

### Claude API 사용량 모니터링

- [ ] **API 호출 로깅 시스템**
  - `api_usage_logs` 테이블 (user_id, endpoint, tokens_used, cost, created_at)
  - 사용자별 일일/월별 사용량 집계
  - 관리자 대시보드 (선택)

### 큐레이션 데이터 관리

- [ ] **데이터 업데이트 프로세스**
  - 월 1회 큐레이션 JSON 업데이트 가이드 문서화
  - 새 박스오피스, 새 수상작 등 정기 추가

### 이미지 업로드 최적화

- [ ] **Sharp 라이브러리 도입 (선택)**
  - 업로드 이미지 압축
  - Claude Vision 비용 절감

---

## 📝 진행 로그

작업할 때마다 아래에 기록:

### 2026-05-13 — Stage 6.1 큐레이션 체크 완료

**완료 항목:**
- DB: `curation_lists`, `curation_items` 테이블 Supabase에 생성
- JSON 시드 데이터 8개 파일, 12개 리스트, 247개 아이템 작성
  - franchises (MCU 35), korean-directors (봉준호+박찬욱 19), foreign-directors (놀란 12)
  - awards (아카데미+칸 39), boxoffice-korean (30), ghibli (지브리+픽사 52), anime-classics (24), korean-dramas (36)
- `fill-tmdb-ids.js` 실행 → TMDB API로 64개 ID 자동 매칭 (1개 미매칭: 가구야 공주 수동 입력)
- `fetch-curation-posters.js` 실행 → 233개 포스터 경로 DB 저장
- 백엔드 API: `GET /api/curation/lists`, `GET /api/curation/lists/:slug/items`, `POST /api/curation/bulk-add`
- 프론트엔드: `RestorePage.jsx` (`/restore`), `CurationListPage.jsx` (`/restore/:slug`)
- HomePage 메뉴에 "📚 과거 기록 복원" 링크 추가

<!-- 새 작업은 이 아래에 추가 -->

---

## 🎯 다음 작업

**현재 시작점: Stage 6.1 — 큐레이션 체크**

순서:
1. curation_lists, curation_items 테이블 마이그레이션 SQL 작성 → 사용자 승인 → 적용
2. 큐레이션 JSON 시드 데이터 준비 (Claude Code가 작성)
3. 시드 스크립트 실행
4. 백엔드 API 작성
5. 프론트엔드 /restore 페이지 구현
6. 동작 확인 + git commit
7. Stage 6.2로 진행

---

## ❓ 사용자 확인이 필요한 사항

다음 경우에는 멈추고 사용자에게 물어보기:

- DB 마이그레이션 실행 (각 Stage 시작 전)
- Claude API 새 호출 도입 (예상 비용 안내)
- 새 라이브러리 도입
- 큐레이션 JSON에 어떤 작품을 넣을지 (선정 기준 모호한 경우)
- 온보딩 UX 디자인 방향 (시각적 결정)
- 기존 사용자 데이터에 영향을 주는 변경

---

## 💰 비용 주의

이 Phase는 **Claude API 사용량이 가장 많은 Phase**입니다.

| 기능 | 호출 빈도 | 단가 (예상) | 일일 한도 권장 |
|------|----------|-----------|--------------|
| AI 대화 (6.2) | 대화 1회 | ~$0.02 | 30회/사용자 |
| 스크린샷 인식 (6.3) | 이미지 1장 | ~$0.01 | 20장/사용자 |
| 큐레이션 (6.1) | 무료 (Claude 미사용) | - | - |

사용자 모집 후 비용 폭증 가능성:
- 100명 활성 사용자 × 일 50회 호출 × $0.02 = $100/일
- 월 $3,000 가능

**대응 방안:**
1. 무료 한도 명시 (일일 30회 등)
2. 한도 초과 시 안내 ("내일 다시")
3. 향후 Pro 플랜에서 무제한 (별도 Phase)

---

## 📐 디자인 가이드

기존 디자인 시스템 준수:
- 카드 그리드 일관성
- 모달 패턴 유지
- 모바일 우선

새로운 패턴:
- **AI 채팅 UI** — 메신저 스타일 (좌우 정렬, 말풍선)
- **온보딩 마법사** — 풀스크린 5단계 (기존 페이지와 분리)
- **체크박스 그리드** — 큐레이션용 (포스터 + 체크 토글)
