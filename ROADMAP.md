# 미디어 다이어리 — 개발 로드맵

> 이 문서는 Claude Code가 자동으로 참고하며 작업하는 로드맵입니다.
> 진행 상황은 체크박스로 표시하고, 완료 시 ✅로 변경합니다.
> 마지막 업데이트: 2026-05-11

---

## 📌 작업 원칙

- Phase 단위로 순차 진행. 한 Phase가 끝나면 다음으로
- 각 작업 완료 시 체크박스 [x] 처리 및 ROADMAP.md 업데이트
- 큰 변경사항은 git commit 진행 (`feat:`, `fix:`, `refactor:` prefix 사용)
- 모든 코드에 한국어 주석 포함
- 막히는 부분 있으면 멈추고 사용자에게 물어보기
- 각 작업 후 동작 확인 (`npm run dev` + 실제 API 호출 테스트)
- UI 시각 확인이 필요한 항목은 사용자 확인 체크리스트로 별도 정리

---

## 🚫 제외 항목

다음은 이 로드맵에서 제외됨 (사용자가 직접 결정):

- Phase 1.4 배포 작업 (Vercel, Render)
- 도메인 구매·연결
- 결제·과금 관련 기능

---

## Phase 3 — AI 추천 시스템

> Claude API 연동으로 개인화 추천 구현
> 이 서비스의 차별점. 기록한 데이터를 발견 도구로 전환.

### 3.1 취향 프로필 시스템

- [x] **user_taste_profile 테이블 신설**
  - 컬럼: `user_id` (FK), `genres` (jsonb), `directors` (jsonb), `decades` (jsonb), `avg_rating`, `total_count`, `updated_at`
  - user_id로 1:1 관계
  - 마이그레이션 SQL 작성

- [x] **취향 프로필 계산 로직**
  - 백엔드 함수: `calculateTasteProfile(userId)`
  - 별점 4+ 작품의 장르/감독/연도 가중치 계산
  - 빈도 기반 가중치 (자주 본 장르일수록 높은 점수)
  - 정규화된 0-1 점수로 저장

- [x] **자동 갱신 트리거**
  - 사용자가 감상 기록 추가/수정/삭제 시 백그라운드로 재계산
  - `setImmediate`로 비동기 처리 — 응답 속도 영향 없음
  - POST/PUT/DELETE 라우트에 `triggerProfileUpdate` 연결

- [x] **취향 프로필 조회 API**
  - `GET /api/me/taste-profile`
  - 본인 취향만 조회 가능

### 3.2 "비슷한 작품" 추천

- [x] **백엔드 API: GET /api/recommend/similar/:mediaId**
  - 1단계: TMDB `/movie/{id}/recommendations` 호출
  - 2단계: 결과를 사용자 취향 프로필과 매칭해 재정렬
  - 3단계: 이미 본 작품 필터링
  - 결과 5-8개 반환

- [x] **프론트엔드 통합**
  - DetailModal 하단에 "이 작품을 좋아하셨다면" 섹션
  - 가로 스크롤 카드 리스트
  - 카드 클릭 시 해당 작품을 내 목록에 추가하는 빠른 버튼

- [x] **캐싱 전략**
  - 같은 mediaId에 대한 추천은 1일 캐시
  - recommendations 테이블에 저장 (`tmdb_id`, `tmdb_type`, `results` jsonb, `created_at`)

### 3.3 "오늘의 추천" 위젯

- [ ] **백엔드 API: GET /api/recommend/daily**
  - 사용자 취향 프로필 기반
  - 아직 안 본 작품 중 매칭 점수 높은 3개
  - 24시간 캐시 (사용자별 daily_recommendations 테이블)

- [ ] **프론트엔드 위젯**
  - 홈 상단에 "오늘의 추천" 카드 섹션 추가
  - 3개 카드 표시 + "다른 추천 보기" 새로고침 버튼
  - 추천된 작품 클릭 시 모달 오픈 → "내 목록에 추가" 버튼

- [ ] **추천 이유 표시**
  - 각 추천 카드에 "당신이 좋아한 OOO과 비슷해요" 설명
  - 어떤 데이터를 기반으로 추천했는지 투명하게

### 3.4 Claude API 자연어 검색

- [ ] **Anthropic SDK 설치**
  - `npm install @anthropic-ai/sdk` (backend)
  - `.env`에 `ANTHROPIC_API_KEY` 추가
  - `CLAUDE.md`에 API 키 환경변수 명시

- [ ] **백엔드 API: POST /api/search/natural**
  - 요청: `{ query: "우주 배경의 잔잔한 SF 영화" }`
  - Claude API 호출 (tool use 활용)
  - Claude가 의도 파악 → TMDB 검색 키워드/장르 추출
  - TMDB 검색 후 결과 반환

- [ ] **프론트엔드 자연어 검색 UI**
  - 헤더 검색바를 "AI 검색" 모드와 일반 검색 모드로 토글
  - AI 검색 시 placeholder 변경: "어떤 작품을 찾으세요? 자연스럽게 입력해주세요"
  - 로딩 인디케이터 표시

- [ ] **사용량 제한**
  - 사용자당 일일 호출 횟수 제한 (예: 20회/일)
  - `users` 테이블에 `daily_ai_calls`, `last_ai_reset_at` 컬럼 추가
  - 한도 초과 시 안내 메시지

### 3.5 월간 취향 리포트

- [ ] **ai_reports 테이블 신설**
  - 컬럼: `id`, `user_id`, `period` (YYYY-MM), `content` (text), `created_at`
  - UNIQUE(user_id, period)

- [ ] **리포트 생성 로직**
  - 매월 1일 자동 생성 (전월 데이터 분석)
  - 또는 사용자가 "이번 달 리포트 생성" 버튼 클릭 시
  - Claude API에 감상 기록 전달 → 마크다운 리포트 생성

- [ ] **리포트 페이지**
  - `/reports` 라우트 신설
  - 월별 리포트 카드 목록
  - 카드 클릭 시 상세 페이지 (마크다운 렌더링)

### 3.6 OTT 시청 기록 이미지 인식

- [ ] **파일 업로드 인프라**
  - `multer` 패키지 설치
  - `POST /api/import/screenshot` 엔드포인트
  - 이미지 크기 제한 (5MB)
  - 임시 폴더에 저장 후 처리 완료 시 삭제

- [ ] **Claude Vision API 연동**
  - 업로드된 이미지를 Claude Vision API에 전달
  - 프롬프트: "이 이미지에서 영화/드라마/애니메이션 제목을 모두 추출해주세요. JSON 배열로 반환."
  - 추출 결과 파싱

- [ ] **추출 결과 검토 UI**
  - 추출된 작품들을 TMDB 검색하여 카드로 표시
  - 사용자가 체크박스로 선택 → 일괄 추가
  - 매칭 실패 항목은 별도 표시

---

## Phase 4 — 소셜 기능

> 혼자 쓰는 도구에서 함께 쓰는 도구로
> 사용자 유지율에 가장 큰 영향

### 4.1 공개 프로필

- [ ] **users 테이블 확장**
  - `username` 컬럼 추가 (UNIQUE, NOT NULL)
  - `bio` 텍스트 컬럼 (자기소개)
  - `avatar_url` 컬럼
  - 기존 사용자는 email 기반 자동 username 생성

- [ ] **공개 프로필 페이지**
  - `/u/:username` 라우트
  - 본 작품 수, 평균 별점, 가장 좋아하는 장르 표시
  - 공개 설정된 작품 목록만 노출
  - 비로그인 상태에서도 접근 가능

- [ ] **백엔드 API**
  - `GET /api/profile/:username` (공개 정보만)
  - `PATCH /api/me/profile` (본인 정보 수정)
  - `GET /api/profile/:username/media?public=true`

- [ ] **프로필 설정 페이지**
  - `/settings` 라우트
  - username, bio, avatar 수정
  - 프로필 공개/비공개 토글

### 4.2 리뷰 공개/비공개

- [ ] **user_media 테이블 확장**
  - `is_public` BOOLEAN DEFAULT false 컬럼 추가
  - 기존 데이터는 모두 false (사용자 동의 전까지 비공개)

- [ ] **리뷰 작성 UI 수정**
  - DetailModal에 공개/비공개 토글 스위치
  - 기본값: 비공개
  - 공개 시 "이 리뷰는 다른 사람에게 보입니다" 안내

- [ ] **공개 리뷰 노출**
  - 작품 상세 모달에 "다른 사람들의 리뷰" 섹션
  - 공개로 설정된 리뷰만 표시
  - 별점과 리뷰 작성자(username) 함께 노출

### 4.3 베스트 리스트

- [ ] **lists 테이블 신설**
  - 컬럼: `id`, `user_id`, `title`, `description`, `is_public`, `created_at`
  - 예: "내 인생 영화 10편", "2025년 베스트"

- [ ] **list_items 테이블 신설**
  - 컬럼: `id`, `list_id`, `media_id`, `position`, `comment`
  - 순서 유지를 위한 position

- [ ] **리스트 관리 페이지**
  - `/lists` 내 리스트 목록
  - `/lists/:id` 리스트 편집
  - 작품 추가/삭제/순서 변경 (드래그 앤 드롭)
  - 각 항목에 코멘트 추가 가능

- [ ] **공개 리스트 페이지**
  - `/lists/:id/view` (공개 보기)
  - 프로필에서 만든 리스트 표시

### 4.4 친구 시스템

- [ ] **follows 테이블 신설**
  - 컬럼: `follower_id`, `following_id`, `created_at`
  - PRIMARY KEY (follower_id, following_id)

- [ ] **팔로우 API**
  - `POST /api/follow/:userId`
  - `DELETE /api/follow/:userId`
  - `GET /api/me/following`
  - `GET /api/me/followers`

- [ ] **사용자 검색**
  - `/search/users?q=` API
  - username 또는 name으로 검색
  - 결과에 팔로우 버튼

- [ ] **활동 피드**
  - `/feed` 라우트
  - 팔로잉한 사용자들의 최근 감상 기록
  - 시간순 정렬
  - 인피니티 스크롤

### 4.5 공통 작품 비교

- [ ] **공통 작품 API**
  - `GET /api/compare/:userId`
  - 두 사용자 모두 본 작품 추출
  - 별점 차이 큰 순으로 정렬
  - 양쪽 별점, 양쪽 리뷰 (공개일 경우) 함께 반환

- [ ] **비교 페이지**
  - `/compare/:userId` 라우트
  - 친구 프로필에서 "비교하기" 버튼으로 진입
  - 별점 차이를 시각화 (양쪽 막대)
  - "당신이 더 좋아한 작품" / "친구가 더 좋아한 작품" 섹션

### 4.6 작품별 친구 활동

- [ ] **작품 모달에 친구 통계 표시**
  - "이 작품을 본 친구 N명" 표시
  - 친구들의 평균 별점
  - 친구 아바타 그리드

- [ ] **API: GET /api/media/:id/friends-activity**
  - 친구 범위에서 해당 작품 감상 기록 집계
  - 친구 username, 별점, 리뷰 (공개일 경우)

### 4.7 같이 볼 영화 리스트

- [ ] **shared_watchlists 테이블 신설**
  - 컬럼: `id`, `creator_id`, `created_at`, `title`
  - 멤버 관리는 별도 테이블

- [ ] **shared_watchlist_members**
  - `watchlist_id`, `user_id`, `role` (creator/member)

- [ ] **shared_watchlist_items**
  - `watchlist_id`, `media_id`, `added_by`, `watched_by_creator`, `watched_by_member`
  - 양쪽 모두 봤는지 추적

- [ ] **공유 워치리스트 페이지**
  - `/watchlists` 내가 속한 워치리스트 목록
  - 친구 초대 → 작품 추가 → 양쪽 시청 후 비교

---

## 🔧 기술 부채 (Phase 진행 중 병행)

### 미디어 type 일관성

- [ ] 포스터 프리패치 시 anime → tv 검색하도록 수정
- [ ] media.type별 명확한 TMDB endpoint 분기

### 수상 정보 DB화

- [ ] `awards` 테이블 신설 (media_id, award_name, year)
- [ ] 기존 하드코딩된 AWARDS 객체 마이그레이션
- [ ] 모달에서 DB 조회로 표시

### 테스트 코드

- [ ] Jest + Supertest 세팅
- [ ] 인증 라우터 테스트 (`/api/auth/*`)
- [ ] 미디어 CRUD 테스트
- [ ] 추천 API 테스트

### 환경변수 일원화

- [ ] frontend `.env` 파일로 환경변수 통합
- [ ] 배포 시 환경별 분리 가능하도록 구조화

---

## 📝 진행 로그

작업할 때마다 아래에 기록:

### 2026-05-11
- ROADMAP.md 생성 — Phase 3, 4 정리

### 2026-05-11 (Phase 3.1 완료)
- `user_taste_profile` 테이블 신설 및 마이그레이션 (`app.js` initDB)
- `backend/src/services/tasteProfile.js` 작성
  - `calculateTasteProfile`: 별점 1-5 모두 반영, rating별 가중치, 0-1 정규화
  - 장르: 별점 4+ 항목 대상 TMDB API 실시간 fetch (배치 5개, 120ms 딜레이)
  - 감독/연대: user_media 기존 데이터 활용
  - `updateTasteProfile`: DB upsert (별점 없으면 프로필 삭제)
- `backend/src/routes/me.js` 신설 — `GET /api/me/taste-profile`
- `userMedia.js` — POST/PUT/DELETE 후 `setImmediate`로 백그라운드 갱신 트리거
- `CLAUDE.md` — ROADMAP 연동 섹션 추가

### 2026-05-11 (Phase 3.2 완료)
- `recommendations` 캐시 테이블 신설 (PRIMARY KEY: tmdb_id + tmdb_type, 24h TTL)
- `backend/src/routes/recommend.js` 신설 — `GET /api/recommend/similar/:mediaId`
  - TMDB 추천 → genre_id 매핑 → 취향 프로필 장르 가중치로 점수화 → 시청 이력 필터 → 상위 8개
  - 장르 매핑 테이블 프로세스 메모리 캐시 (genreMemo)
- `frontend/src/api/recommend.js` 신설
- `frontend/src/components/SimilarRecommendations.jsx` 신설
  - DetailModal 하단 "이 작품을 좋아하셨다면" 가로 스크롤 섹션
  - 카드당 "+ 추가" 버튼 (중복 시 "추가됨" 표시)
- DetailModal: `onAdd`, `existingItems` prop 추가, SimilarRecommendations 삽입
- CSS: `.similar-*` 클래스 추가 (라이트/다크 모두)

<!-- 새 작업은 이 아래에 추가 -->

---

## 🎯 다음 작업

**현재 시작점: Phase 3.1 — 취अ 프로필 시스템**

순서:
1. user_taste_profile 테이블 마이그레이션
2. 취향 프로필 계산 로직 작성
3. 자동 갱신 트리거 구현
4. 조회 API 작성
5. 동작 확인 후 git commit
6. Phase 3.2로 진행

---

## ❓ 사용자 확인이 필요한 사항

작업 중 다음과 같은 결정이 필요할 때는 멈추고 사용자에게 물어보기:

- API 응답 형식 변경 (기존 클라이언트 영향)
- 새로운 라이브러리 도입 (라이선스/번들 크기 영향)
- 비용 발생 가능성 (Claude API 호출 빈도 등)
- 사용자 데이터 마이그레이션 (기존 데이터에 영향)
- UI 디자인 방향성 (시각적 결정)
