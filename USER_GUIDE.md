# 미디어 다이어리 사용 설명서

> **대상:** 개발자 자신 및 기능 점검용 완전 가이드  
> **작성일:** 2026-05-13  
> **버전:** Phase 7 기준

---

## 0. 서비스 개요

### 한 줄 소개
내가 본 영화·애니메이션·드라마를 기록하고, 별점·감상 메모·통계·AI 추천까지 한 곳에서 관리하는 개인 미디어 기록장.

### 핵심 가치
- **기억 복원** — 과거에 본 작품을 AI 대화, 큐레이션 체크, 스크린샷으로 빠르게 불러오기
- **취향 분석** — 별점·연도·장르 통계와 월간 AI 리포트로 내 취향 파악
- **소셜 연결** — 공개 프로필, 팔로우, 친구와 같이 볼 영화 리스트 공유

### 주요 기능 요약
| 카테고리 | 기능 |
|----------|------|
| 기록 | 작품 추가/편집/삭제, 별점, 감상 메모, 시청 날짜 소급 입력 |
| 복원 | 큐레이션 50개, AI 대화, 스크린샷 OCR, Letterboxd CSV |
| 통계 | 연도별·장르별 차트, 활동 캘린더, 시청 시간 합산 |
| 연말 결산 | Spotify Wrapped 스타일 9슬라이드, PNG 저장 |
| AI | 자연어 검색, 오늘의 추천, 비슷한 작품, 월간 리포트 |
| 소셜 | 공개 프로필, 팔로우, 활동 피드, 취향 비교 |

---

## 1. 시작하기

### 1.1 회원가입

**경로:** `/register`  
**접근:** 로그인 화면 하단 "회원가입" 링크

회원가입 후 자동으로 로그인 처리되며, **온보딩 페이지(`/onboarding`)로 이동**한다.  
JWT 토큰이 `localStorage`에 저장되어 새로고침 후에도 로그인 상태가 유지된다.

**입력 항목**
- 이메일 (중복 불가)
- 비밀번호
- 이름 (표시명)

**연결된 API**
```
POST /api/auth/register
```

**✅ 점검 체크리스트**
- [ ] 이메일/비밀번호/이름 입력 후 가입 버튼 클릭
- [ ] 가입 성공 시 `/onboarding`으로 이동하는지
- [ ] 이미 사용 중인 이메일 입력 시 에러 메시지 표시
- [ ] 필드 빈 칸 제출 시 에러 처리

---

### 1.2 로그인

**경로:** `/login`  
**접근:** 앱 진입 시 미로그인 상태면 자동 리다이렉트

**연결된 API**
```
POST /api/auth/login → JWT 토큰 발급
```

**✅ 점검 체크리스트**
- [ ] 정상 이메일/비밀번호로 로그인 성공
- [ ] 잘못된 비밀번호 입력 시 에러 메시지 표시
- [ ] 로그인 후 `/`(홈)으로 이동
- [ ] 새로고침 후에도 로그인 상태 유지 (localStorage 토큰)
- [ ] 로그아웃 후 `/login`으로 리다이렉트

---

### 1.3 온보딩 (신규 가입자)

**경로:** `/onboarding`  
**접근:** 회원가입 직후 자동 진입 / 홈 메뉴 "온보딩 다시 하기" 링크

5단계 마법사로 과거 기록을 빠르게 채울 수 있도록 안내한다.  
각 단계를 건너뛰거나 중간에 완료할 수 있으며, 완료 시 `users.onboarding_completed = true` 저장.

| 단계 | 내용 |
|------|------|
| 1단계 | 환영 화면 + 3가지 핵심 기능 소개 |
| 2단계 | 큐레이션 체크 — 5개 추천 리스트(MCU, 봉준호, 박스오피스, 지브리, 한국드라마) 인라인 확인 |
| 3단계 | AI 대화 — 예시 프롬프트 4개 제시, 클릭 시 `/restore/chat`으로 이동 |
| 4단계 | 스크린샷 업로드 — ScreenshotImportModal 임베드 |
| 5단계 | 완료 화면 — 총 추가한 작품 수 표시 |

**연결된 API**
```
GET  /api/onboarding/status   → 완료 여부, 현재 단계, 보유 작품 수
POST /api/onboarding/step     → 단계 저장
POST /api/onboarding/complete → 완료 처리
```

**✅ 점검 체크리스트**
- [ ] 1단계 환영 화면 정상 표시
- [ ] 2단계 큐레이션 포스터 그리드 + 체크박스 작동
- [ ] 2단계에서 작품 추가 후 카운트 반영
- [ ] 3단계 AI 버튼 클릭 → `/restore/chat` 이동
- [ ] 4단계 스크린샷 업로드 UI 표시
- [ ] 5단계 완료 화면 + 총 추가 수 표시
- [ ] 각 단계 "건너뛰기" 버튼 작동
- [ ] 상단 프로그레스 바 단계별 업데이트
- [ ] 홈 메뉴 "온보딩 다시 하기" → 1단계부터 재시작

---

## 2. 메인 기능

### 2.1 홈 화면 (`/`)

**접근:** 로그인 후 기본 화면, 상단 로고 클릭

홈 화면은 위젯 영역 + 탭 그리드 영역으로 구성된다.

#### 상단 위젯
| 위젯 | 내용 |
|------|------|
| 이번 달 감상 수 | 현재 달 watched_at 기준 건수 + 시청 시간 |
| 올해 감상 수 | 당해 연도 watched_at 기준 건수 |
| 최근 감상 | 최근 10편 가로 스크롤 포스터 |
| 오늘의 추천 | AI 취향 기반 추천 3편 (DailyRecommendations 컴포넌트) |
| 연말 결산 배너 | 11월~3월 기간에 표시 (해당 기간 외 숨김) |

**✅ 점검 체크리스트**
- [ ] 이번 달/올해 감상 수 숫자 정상 표시
- [ ] 이번 달 시청 시간(시간 단위) 표시
- [ ] 최근 감상 가로 스크롤 작동
- [ ] 오늘의 추천 3편 로드 (로딩 중 스켈레톤)
- [ ] 연말 배너 클릭 시 `/year-in-review/2026` 이동

---

### 2.2 작품 카드 그리드

홈 화면 하단의 메인 작품 목록.

#### 탭 전환
- **영화** / **애니메이션** / **드라마** 3개 탭
- 탭 클릭 시 해당 type 작품만 표시

#### 10년 단위 그룹핑
- 연도별 섹션 헤더 (2020년대, 2010년대, 2000년대…)
- 연도 0인 작품은 "연도 미상" 섹션

#### 검색 & 필터
- **검색창:** 제목 실시간 필터 (타이핑 즉시)
- **필터 패널:** 감독명, 최소 별점, 연도 범위 (슬라이더)
- **정렬:** 연도순 / 별점 높은순 / 최근 감상순 / 등록순

#### 카드 배지
- 🔁 N회 — 재시청 기록 있는 작품
- ★ N — 별점 표시

**✅ 점검 체크리스트**
- [ ] 영화/애니/드라마 탭 전환 정상
- [ ] 10년 섹션 그룹핑 표시
- [ ] 검색창 입력 시 실시간 필터
- [ ] 감독 필터 — 감독명 자동완성 + 필터링
- [ ] 별점 필터 — 1~5 최소 별점 설정
- [ ] 연도 범위 슬라이더 작동
- [ ] 정렬 변경 시 목록 재정렬
- [ ] 재시청 배지 🔁 표시
- [ ] 포스터 이미지 로드 (없으면 제목 텍스트)

---

### 2.3 작품 상세 모달

카드 클릭 시 표시되는 풀 정보 모달.

#### TMDB 정보 패널
- 제목, 원제, 연도, 런타임, 장르, 줄거리
- TMDB 평점
- OTT 정보 (TMDB 제공 / 네이버 영화 탭 전환)

#### 별점 & 감상 메모
- 별 1~5 클릭으로 별점 입력
- 텍스트 에어리어로 감상 메모
- 시청 날짜 입력 (date picker + "오늘 시청" 버튼)

#### 시청 컨텍스트
- **누구와:** 혼자 / 가족 / 친구 / 연인 / 자유 입력
- **어디서:** 집 / 영화관 / 카페 / 기타
- **무드:** 즐거운 / 감동적인 / 무서운 / 슬픈 / 생각하게 하는

#### 시청 시기 태그 (그 시절)
- 추천 칩: 초등학생 때 / 중학생 때 / 고등학생 때 / 대학생 때 / 직장인 때
- 자유 텍스트 입력 가능

#### 재시청 이력
- "재시청 추가" 버튼 → 새 rewatch 행 추가
- 회차별 날짜 + 별점 기록 목록

#### 친구 활동
- 이 작품을 본 팔로잉 친구 목록 (프로필 이미지 + 별점)

#### 공개 리뷰
- 리뷰 공개 여부 토글

#### 비슷한 작품 추천
- AI 기반 유사 작품 3~5편 (SimilarRecommendations 컴포넌트)

#### 포스터 변경
- "포스터 변경" 버튼 → PosterPicker 모달 (TMDB 검색)

#### 작품 편집
- 제목, 감독, 출연진, 연도, 분류(type) 변경

#### 작품 삭제
- 삭제 버튼 → 확인 후 user_media에서 제거

**연결된 API**
```
GET  /api/user-media/history/:tmdbId       → 재시청 이력
GET  /api/user-media/public/:tmdbId        → 공개 리뷰
POST /api/user-media/:id/rewatch           → 재시청 추가
PUT  /api/user-media/:id                   → 정보/별점/컨텍스트 수정
PATCH /api/user-media/:id/poster           → 포스터 변경
DELETE /api/user-media/:id                 → 삭제
GET  /api/recommend/similar/:mediaId       → 비슷한 작품
GET  /api/social/media/:tmdbId/friends-activity → 친구 활동
GET  /api/tmdb/movie/:id, /tv/:id          → TMDB 상세
GET  /api/tmdb/movie/:id/watch/providers   → OTT 정보
```

**✅ 점검 체크리스트**
- [ ] TMDB 제목/줄거리/장르 표시
- [ ] OTT 정보 탭 전환 (TMDB↔네이버)
- [ ] 별점 1~5 클릭 → 저장 버튼 누르면 반영
- [ ] 감상 메모 입력 및 저장
- [ ] 시청 날짜 수동 입력 저장
- [ ] 시청 컨텍스트 저장 (누구와/어디서/무드)
- [ ] 시청 시기 칩 선택 또는 자유 입력 저장
- [ ] 재시청 추가 → 이력 목록에 새 행 추가
- [ ] 공개 리뷰 토글 저장
- [ ] 비슷한 작품 로드
- [ ] 친구 활동 섹션 표시 (팔로잉 없으면 빈 상태)
- [ ] 포스터 변경 → 새 포스터 반영
- [ ] 작품 편집 저장
- [ ] 작품 삭제 → 목록에서 제거

---

## 3. 작품 추가

### 3.1 단일 검색 추가

**접근:** 홈 화면 상단 "+ 추가" 버튼 → AddModal

TMDB를 실시간 검색해 작품을 선택하면 `user_media`에 추가된다.

**연결된 API**
```
GET  /api/tmdb/search/movie?q=, /api/tmdb/search/tv?q=
POST /api/user-media
```

**✅ 점검 체크리스트**
- [ ] 제목 입력 시 TMDB 검색 결과 표시
- [ ] 영화/드라마/애니메이션 탭 전환 검색
- [ ] 작품 선택 → 카드 그리드에 추가 확인
- [ ] 이미 추가된 작품 재추가 시 경고 또는 중복 처리

---

### 3.2 일괄 추가 (텍스트 입력)

**접근:** AddModal 내 "일괄 입력" 탭

줄바꿈으로 구분된 제목 목록을 붙여넣으면 TMDB 자동 매칭 후 일괄 삽입.

**연결된 API**
```
POST /api/user-media/bulk
```

**✅ 점검 체크리스트**
- [ ] 여러 줄 제목 입력 후 추가 클릭
- [ ] 각 제목별 TMDB 매칭 결과 미리보기
- [ ] 매칭 실패 항목 수동 선택 가능 여부
- [ ] 일괄 삽입 완료 후 그리드에 반영

---

### 3.3 빠른 입력 모드

**접근:**
- 키보드 단축키: `Cmd + K` (Mac) / `Ctrl + K` (Windows)
- 화면 우하단 FAB(+) 버튼 클릭

간소화된 입력 폼으로 제목 입력만으로 빠르게 추가.

**✅ 점검 체크리스트**
- [ ] Ctrl+K → QuickInputModal 열림
- [ ] FAB 버튼 클릭 → QuickInputModal 열림
- [ ] 작품 검색 및 빠른 추가 동작
- [ ] 모달 닫기 후 그리드에 반영

---

### 3.4 위시리스트에 추가

**접근:** 작품 상세 모달 내 "나중에 보기" 버튼 (또는 `/wishlist` 페이지 검색)

```
POST /api/me/watchlist
```

---

### 3.5 스크린샷으로 추가

**접근:** 홈 메뉴 → "스크린샷 가져오기" 또는 온보딩 4단계

→ [4.4 스크린샷 업로드](#44-스크린샷-업로드) 참조

---

## 4. 과거 기록 복원 (`/restore`)

**접근:** 홈 메뉴 → "기록 복원" 또는 직접 `/restore` 진입

복원 허브 페이지. 4가지 방식으로 과거에 본 작품을 불러올 수 있다.

---

### 4.1 큐레이션 체크

**경로:** `/restore` (복원 메인 페이지 내 아코디언)

50개 큐레이션 리스트를 2단계 계층으로 탐색하며, 이미 추가한 작품은 체크 표시된다.

#### 최상위 카테고리
| 아이콘 | 카테고리 | 서브그룹 수 |
|--------|----------|-------------|
| 🎬 | 영화 | 시리즈/프랜차이즈, 한국 감독, 해외 감독, 박스오피스, 시상식 수상작, 장르별 |
| 📺 | 드라마 | 한국 드라마, 해외 드라마, 드라마 시상식 |
| 🎌 | 애니메이션 | 애니메이션 전체 |

#### 주요 리스트 예시
- MCU 전체 / DC 확장 유니버스 / 해리 포터 / 반지의 제왕
- 봉준호 / 박찬욱 / 홍상수 / 이창동 / 류승완 전 작품
- 스탠리 큐브릭 / 크리스토퍼 놀란 / 웨스 앤더슨 전 작품
- 아카데미 작품상 / 칸 황금종려상 / 백상 TV부문 대상
- 한국 박스오피스 TOP 10 / 넷플릭스 글로벌 히트
- 지브리 전 작품 / 마이애니리스트 TOP 20

#### 사용 방법
1. 최상위 카테고리(영화/드라마/애니) 클릭해 펼치기
2. 서브그룹 클릭해 리스트 목록 확인
3. 원하는 리스트 제목 클릭 → 포스터 그리드 열림 (`/restore/:slug`)
4. 이미 추가된 작품은 체크 표시 + "추가됨" 배지
5. 체크박스로 원하는 작품 선택 → 하단 "추가" 버튼

**연결된 API**
```
GET  /api/curation/lists              → 전체 리스트 목록
GET  /api/curation/lists/:slug/items  → 리스트 내 작품 (already_added 포함)
POST /api/curation/bulk-add           → 선택 작품 일괄 추가
```

**✅ 점검 체크리스트**
- [ ] 🎬영화 / 📺드라마 / 🎌애니 3개 최상위 아코디언 표시
- [ ] 서브그룹 펼침/접힘 동작
- [ ] 필터 검색바로 리스트 이름 검색
- [ ] 리스트 클릭 → 포스터 그리드 페이지 이동
- [ ] 이미 추가한 작품 "추가됨" 배지 표시
- [ ] 체크박스 선택 후 일괄 추가 → 홈 목록 반영
- [ ] 전체 선택 / 전체 해제 기능

---

### 4.2 감독/배우 자유 검색

**경로:** `/restore` 내 "인물 검색" 섹션

TMDB 인물 검색으로 특정 감독/배우의 전 작품을 탐색한다.

#### 사용 방법
1. 인물 이름 입력 (300ms 디바운스로 실시간 검색)
2. 드롭다운에서 인물 선택 (프로필 사진 + 대표작)
3. "감독" / "배우" 탭 전환
4. 작품 그리드에서 체크박스 선택
5. "일괄 추가" 버튼 클릭

**연결된 API**
```
GET /api/curation/person/search?q=이름
GET /api/curation/person/:tmdbId/works?type=director|actor
```

**알려진 제한사항**
- 인물 검색은 로그인 필요 (already_added 마킹용)
- 출연 크레딧이 많은 배우는 로드 시간이 길 수 있음

**✅ 점검 체크리스트**
- [ ] 감독 이름 검색 → 드롭다운 목록 표시
- [ ] 인물 선택 → 감독 작품 그리드 로드
- [ ] "배우" 탭 → 출연작 목록 표시
- [ ] 이미 추가된 작품 "추가됨" 배지
- [ ] 선택 후 일괄 추가 동작

---

### 4.3 AI 대화형 복원 (`/restore/chat`)

**경로:** `/restore/chat`  
**접근:** 복원 메인 페이지 파란 배너 "AI와 대화로 기억 복원" 클릭

Claude Haiku와 자유 대화로 과거에 본 작품을 추천받는다.

#### 사용 방법
1. 메시지 입력 (예: "90년대 SF 영화 좋아했어요", "홍상수 영화 다 봤는데 비슷한 거 뭐가 있어?")
2. AI가 작품 제안 카드 그리드 표시
3. 원하는 작품 체크박스 선택
4. "추가" 버튼으로 기록에 저장

**제한사항**
- 일일 30회 한도 (자정 기준 자동 리셋)
- 헤더에 남은 사용 횟수 표시

**연결된 API**
```
POST   /api/restore/chat         → Claude 호출 + TMDB 보강
GET    /api/restore/chat/history → 대화 이력
POST   /api/restore/chat/accept  → 작품 추가
DELETE /api/restore/chat/history → 대화 이력 삭제
```

**✅ 점검 체크리스트**
- [ ] 빈 화면에 예시 프롬프트 6개 표시
- [ ] 메시지 전송 → 로딩 인디케이터 후 응답
- [ ] AI 응답에 포스터 카드 그리드 표시
- [ ] 작품 선택 → "추가" 버튼 → 기록에 저장
- [ ] 대화 이력 스크롤 (이전 대화 유지)
- [ ] 헤더 남은 횟수 표시 (예: 28/30)
- [ ] 30회 초과 시 차단 메시지

---

### 4.4 스크린샷 업로드

**경로:** 홈 메뉴 → "스크린샷 가져오기" 또는 온보딩 4단계

OTT 앱이나 영화관 앱의 시청 기록 화면을 스크린샷으로 업로드하면 Claude Vision이 작품을 추출한다.

#### 사용 방법
1. OTT/극장 종류 선택 (넷플릭스, 왓챠, 웨이브, CGV, 롯데시네마, 메가박스, 디즈니+, 애플TV+, 시즌)
2. 이미지 선택 (최대 10장, 드래그앤드롭 가능)
3. "분석 시작" 클릭 → Claude Vision 처리
4. 추출된 작품 목록 확인
   - **높음** 신뢰도: 초록 배지 (자동 선택)
   - **보통** 신뢰도: 노란 배지 (확인 권장)
   - **낮음** 신뢰도: 빨간 배지 → InlineSearch로 수동 재검색
5. 체크박스로 추가할 작품 선택 → 저장

**제한사항**
- 일일 업로드 최대 20장
- 1회 업로드 최대 10장

**연결된 API**
```
POST /api/import/screenshot        → 이미지 업로드 + Claude Vision
GET  /api/import/screenshot/search → 수동 TMDB 재검색
```

**✅ 점검 체크리스트**
- [ ] OTT 드롭다운 9종 선택 가능
- [ ] 파일 선택 버튼 + 드래그앤드롭 동작
- [ ] 여러 장 동시 업로드 (최대 10장)
- [ ] 썸네일 미리보기 + 개별 삭제
- [ ] 분석 후 신뢰도 배지 표시
- [ ] 낮음 신뢰도 항목 수동 재검색 (InlineSearch)
- [ ] 재검색 결과 클릭으로 교체
- [ ] 선택 후 저장 → 기록에 반영

---

### 4.5 Letterboxd CSV 가져오기

**경로:** `/restore` 하단 "Letterboxd 가져오기" 카드

Letterboxd에서 내보낸 `watched.csv` 파일을 업로드하면 자동 파싱 및 TMDB 매칭 후 기록에 추가된다.

#### Letterboxd에서 CSV 내보내기
1. letterboxd.com 로그인 → 프로필 → Settings → Import & Export
2. "Export Your Data" → `watched.csv` 다운로드

#### 파싱 규칙
- Rating: 0.5~5.0 → 앱 내 1~5로 Math.round 변환
- Watched Date: watched_at 컬럼에 저장
- 중복: tmdb_id 기준으로 이미 추가된 작품 제외

**연결된 API**
```
POST /api/restore/letterboxd-csv
```

**✅ 점검 체크리스트**
- [ ] `watched.csv` 파일 선택 후 업로드
- [ ] "N편 추가 / M편 중복 / K편 실패" 결과 표시
- [ ] 추가된 작품이 홈 그리드에 반영
- [ ] 중복 작품 미추가 확인
- [ ] 별점 변환 확인 (Letterboxd 4.5 → 앱 내 5)

---

## 5. 위시리스트 (`/wishlist`)

**접근:** 홈 메뉴 → "위시리스트"

"나중에 보기" 목록. 봤으면 좋겠다고 생각한 작품을 저장하고, 시청 후 기록으로 이동.

#### 기능
- TMDB 검색으로 작품 추가
- 우선순위 ★1~3 설정 (보통 / 보고 싶음 / 꼭 봐야 함)
- 메모 입력
- 플랫폼 태그 (넷플릭스, 왓챠, 웨이브 등)
- 시청 완료 처리 → 별점 입력 후 `user_media`로 이동 + 위시리스트에서 제거

**연결된 API**
```
GET    /api/me/watchlist         → 목록 조회
POST   /api/me/watchlist         → 추가
PATCH  /api/me/watchlist/:id     → 우선순위/메모 수정
DELETE /api/me/watchlist/:id     → 삭제
POST   /api/me/watchlist/:id/watched → 시청 완료 처리
```

**✅ 점검 체크리스트**
- [ ] TMDB 검색 → 작품 위시리스트 추가
- [ ] 우선순위 ★ 1~3 설정 및 변경
- [ ] 메모 입력 및 저장
- [ ] 플랫폼 태그 선택
- [ ] 시청 완료 버튼 → 별점 선택 → "기록 저장"
- [ ] 완료 처리 후 홈 목록에 작품 추가 확인
- [ ] 완료 작품 위시리스트에서 제거 확인
- [ ] 삭제 버튼 작동

---

## 6. 통계 (`/stats`)

**접근:** 홈 메뉴 → "통계"

내 감상 데이터를 여러 차트로 시각화.

#### 구성 섹션
| 섹션 | 설명 |
|------|------|
| 분류별 파이차트 | 영화 / 애니메이션 / 드라마 비율 (도넛형) |
| 연대별 바 차트 | 10년 단위 감상 분포 |
| 별점 분포 | 1~5 별점별 작품 수 |
| 감상 활동 캘린더 | GitHub 잔디 스타일 (최근 52주) |
| 시청 시간 카드 | 총 시청 시간 (시간 단위) |
| 그 시절 🕰️ | life_period 태그별 가로 포스터 스크롤 |

**연결된 API**
```
GET /api/user-media        → 전체 작품 목록 (차트 계산용)
GET /api/me/watch-stats    → 시청 시간 합산
GET /api/me/life-periods   → 시청 시기 그룹
```

**✅ 점검 체크리스트**
- [ ] 분류별 파이차트 % 표시
- [ ] 연대별 바 차트 (막대 높이)
- [ ] 별점 분포 차트
- [ ] 캘린더 잔디 색상 (0편=회색, 1편=연초록, 4편+=진초록)
- [ ] 시청 시간 숫자 표시
- [ ] 그 시절 섹션 — life_period 태그별 그룹 표시
- [ ] 그 시절 포스터 가로 스크롤

---

## 7. 연말 결산 (`/year-in-review/:year`)

**접근:** 홈 화면 상단 배너 (11월~3월 기간) 클릭 또는 직접 URL 입력

Spotify Wrapped 스타일로 한 해의 감상 기록을 9장의 슬라이드로 회고.

#### 슬라이드 구성
| 슬라이드 | 내용 | 배경색 |
|----------|------|--------|
| 1 | 인트로 — "나의 [연도] 감상 결산" | 다크 블루 |
| 2 | 총 감상 수 + 분류별 | 골드 |
| 3 | 총 시청 시간 | 그린 |
| 4 | 장르 분포 파이차트 | 퍼플 |
| 5 | ★5 명단 (최고 평점 작품 목록) | 레드 |
| 6 | 월별 감상 추이 바 차트 | 그린 |
| 7 | 최다 감상 감독 TOP 3 | 옐로우 |
| 8 | 작년 대비 비교 | 라이트 블루 |
| 9 | 아웃트로 | 핑크 |

#### 조작 방법
- ← → 방향키 또는 화살표 버튼으로 슬라이드 이동
- ESC → 홈으로 복귀
- "이미지 저장" 버튼 → 현재 슬라이드를 PNG로 다운로드

**알려진 제한사항**
- 결산 데이터는 1시간 캐시 (변경 즉시 반영 안 될 수 있음)

**연결된 API**
```
GET /api/year-in-review/:year
```

**✅ 점검 체크리스트**
- [ ] URL `/year-in-review/2026` 직접 입력 접근
- [ ] 9개 슬라이드 모두 표시
- [ ] 방향키로 슬라이드 전환
- [ ] ESC 키로 홈 복귀
- [ ] "이미지 저장" → PNG 다운로드
- [ ] 월별 바 차트 데이터 정확
- [ ] ★5 작품 목록 표시

---

## 8. AI 기능

### 8.1 자연어 검색

**접근:** 홈 화면 검색창 우측 "AI 검색" 버튼 → AiSearchModal

자연어로 원하는 작품 특성을 입력하면 내 목록에서 조건에 맞는 작품을 찾아준다.

예시: "90년대 프랑스 감독이 만든 슬픈 영화", "별점 4 이상이고 SF 장르인 것"

**연결된 API**
```
POST /api/search/natural
```

**✅ 점검 체크리스트**
- [ ] AI 검색 모달 열림
- [ ] 자연어 쿼리 입력 → 검색 결과 표시
- [ ] 결과 작품 클릭 → 상세 모달 열림
- [ ] 내 목록에 없는 작품도 제안하는지 확인

---

### 8.2 오늘의 추천

**접근:** 홈 화면 위젯 영역 (자동 로드)

내 취향 프로필(별점 패턴)을 분석해 아직 보지 않은 작품 3편을 추천.

**연결된 API**
```
GET /api/recommend/daily
GET /api/me/taste-profile  → 취향 프로필 (배경에서 사용)
```

**✅ 점검 체크리스트**
- [ ] 홈에서 추천 3편 카드 표시
- [ ] 각 카드에 추천 이유 텍스트
- [ ] 카드 클릭 → 작품 상세 모달 열림

---

### 8.3 비슷한 작품 추천

**접근:** 작품 상세 모달 하단 "비슷한 작품" 섹션

현재 보고 있는 작품과 장르/분위기가 유사한 작품 3~5편 추천.

**연결된 API**
```
GET /api/recommend/similar/:mediaId
```

**✅ 점검 체크리스트**
- [ ] 상세 모달 하단 비슷한 작품 섹션 표시
- [ ] 추천 작품 포스터 + 이유 표시
- [ ] 추천 작품 클릭 → 해당 상세 모달 열림

---

### 8.4 월간 취향 리포트 (`/reports`)

**접근:** 홈 메뉴 → "취향 리포트"

Claude AI가 한 달 감상 기록을 분석해 마크다운 형식 리포트를 생성. 생성된 리포트는 DB에 저장.

**연결된 API**
```
GET  /api/me/reports           → 저장된 리포트 목록
GET  /api/me/reports/:period   → 특정 달 리포트 (YYYY-MM)
POST /api/me/reports/generate  → AI 리포트 생성
```

**✅ 점검 체크리스트**
- [ ] 리포트 목록 페이지 로드
- [ ] "리포트 생성" 버튼 클릭 → 로딩 후 마크다운 표시
- [ ] 이전 달 리포트 목록에서 조회
- [ ] 리포트 내용 마크다운 렌더링

---

## 9. 소셜 기능

### 9.1 공개 프로필 (`/u/:username`)

비로그인도 접근 가능한 공개 프로필 페이지.

**표시 내용**
- 아바타, 이름, 자기소개(bio)
- 공개 설정된 감상 기록 목록
- 팔로우/언팔로우 버튼 (로그인 시)

**연결된 API**
```
GET /api/profile/:username        → 프로필 정보
GET /api/profile/:username/media  → 공개 감상 목록
```

**✅ 점검 체크리스트**
- [ ] `/u/내username` 접근 시 프로필 표시
- [ ] 비로그인 상태에서도 접근 가능
- [ ] 공개 설정된 작품만 표시 (비공개 작품 숨김)
- [ ] 팔로우 버튼 작동

---

### 9.2 설정 (`/settings`)

**접근:** 홈 메뉴 → "설정"

#### 수정 가능 항목
- 사용자명(username) — 공개 프로필 URL에 사용
- 자기소개(bio)
- 아바타 URL
- 프로필 공개/비공개 토글

**연결된 API**
```
GET   /api/me/info      → 현재 프로필 조회
PATCH /api/me/profile   → 프로필 수정
```

**✅ 점검 체크리스트**
- [ ] 현재 프로필 정보 불러오기
- [ ] username 변경 후 저장
- [ ] bio 입력 후 저장
- [ ] 프로필 공개 토글
- [ ] 저장 성공/실패 메시지 표시

---

### 9.3 활동 피드 (`/feed`)

**접근:** 홈 메뉴 → "피드"

팔로잉한 사용자들의 최근 감상 기록 + 사용자 검색 + 팔로우 관리.

#### 탭 구성
- **피드:** 팔로잉 사용자 최근 활동 타임라인 (무한 스크롤)
- **검색:** 사용자 이름 검색 + 팔로우 버튼
- **팔로잉:** 현재 팔로잉 목록 + 언팔로우

**연결된 API**
```
GET  /api/feed              → 피드 (page 파라미터)
GET  /api/search/users?q=   → 사용자 검색
POST /api/follow/:userId    → 팔로우
DELETE /api/follow/:userId  → 언팔로우
GET  /api/me/following      → 팔로잉 목록
```

**✅ 점검 체크리스트**
- [ ] 피드 탭 — 팔로잉 활동 표시
- [ ] 피드 스크롤 시 추가 로드 (무한 스크롤)
- [ ] 검색 탭 — 사용자 이름 검색
- [ ] 팔로우 버튼 → 팔로잉 목록에 추가
- [ ] 언팔로우 후 목록에서 제거

---

### 9.4 친구 취향 비교 (`/compare/:userId`)

**접근:** 팔로잉 사용자 프로필 → "취향 비교" 버튼

두 사용자가 공통으로 본 작품의 별점 차이를 시각화.

**표시 내용**
- 내가 더 좋아한 작품 / 상대가 더 좋아한 작품 / 동의한 작품
- 별점 차이 바 차트

**연결된 API**
```
GET /api/compare/:userId
```

**✅ 점검 체크리스트**
- [ ] 비교 페이지 로드
- [ ] 공통 작품 목록 + 별점 차이 표시
- [ ] "내가 더 좋아함 / 상대가 더 좋아함 / 동의" 구분

---

### 9.5 베스트 리스트 (`/lists`)

**접근:** 홈 메뉴 → "내 리스트"

"내가 꼽은 최고의 SF" 같은 주제별 큐레이션 리스트를 직접 만들고 공개 공유.

#### 기능
- 리스트 생성/삭제
- 내 작품에서 항목 추가/제거
- 항목별 코멘트 입력
- 공개/비공개 설정
- 공개 리스트는 `/lists/public/:username`으로 공유

**연결된 API**
```
GET    /api/lists               → 내 리스트 목록
POST   /api/lists               → 리스트 생성
GET    /api/lists/:id           → 리스트 상세 (항목 포함)
PATCH  /api/lists/:id           → 리스트 수정
DELETE /api/lists/:id           → 리스트 삭제
POST   /api/lists/:id/items     → 항목 추가
DELETE /api/lists/:id/items/:itemId → 항목 삭제
PATCH  /api/lists/:id/items/:itemId → 코멘트/순서 수정
GET    /api/lists/public/:username  → 공개 리스트 조회
```

**✅ 점검 체크리스트**
- [ ] 리스트 생성 (제목, 설명, 공개여부)
- [ ] 내 작품에서 항목 추가
- [ ] 항목 코멘트 입력
- [ ] 리스트 삭제
- [ ] 공개 리스트 URL로 외부 접근

---

### 9.6 공유 워치리스트 (`/watchlists`)

**접근:** 홈 메뉴 → "같이 볼 영화"

친구와 함께 볼 영화 목록을 공유하고, 각자 시청 여부를 체크.

#### 기능
- 워치리스트 생성 (제목)
- username으로 친구 초대
- 작품 추가 (내 목록에서 검색)
- 친구별 시청 완료 체크
- 리스트 탈퇴/삭제

**연결된 API**
```
GET    /api/watchlists                          → 내 워치리스트 목록
POST   /api/watchlists                          → 생성
GET    /api/watchlists/:id                      → 상세
DELETE /api/watchlists/:id                      → 삭제
POST   /api/watchlists/:id/invite               → 친구 초대
DELETE /api/watchlists/:id/leave                → 탈퇴
POST   /api/watchlists/:id/items                → 작품 추가
DELETE /api/watchlists/:id/items/:itemId        → 작품 제거
PATCH  /api/watchlists/:id/items/:itemId/watched → 시청 완료 토글
```

**✅ 점검 체크리스트**
- [ ] 워치리스트 생성
- [ ] 친구 초대 (username 입력)
- [ ] 작품 추가
- [ ] 시청 완료 체크
- [ ] 탈퇴 기능

---

## 10. 부가 기능

### 10.1 다크 모드

**접근:** 각 페이지 우상단 "다크" / "라이트" 버튼

모든 페이지에서 즉시 전환 가능. `localStorage`에 테마 설정 저장으로 새로고침 후에도 유지.

**✅ 점검 체크리스트**
- [ ] 다크 모드 전환 → 배경/텍스트 색상 변경
- [ ] 라이트 모드 전환
- [ ] 새로고침 후 설정 유지

---

### 10.2 모바일 반응형

모바일(768px 이하) 환경에서 자동 레이아웃 조정.

| PC | 모바일 |
|----|--------|
| 카드 그리드 5열 | 2열 |
| 상단 헤더 메뉴 | 햄버거 메뉴 |
| 모달 중앙 팝업 | 하단 시트 |

**✅ 점검 체크리스트**
- [ ] 브라우저 폭 768px 이하 → 2열 그리드
- [ ] 메뉴 버튼 → 모바일 메뉴 표시
- [ ] 상세 모달 → 하단 슬라이드업 시트
- [ ] 터치 스크롤 정상

---

### 10.3 데이터 내보내기

**접근:** 홈 메뉴 → "CSV 내보내기"

전체 감상 기록을 CSV 파일로 다운로드.

**✅ 점검 체크리스트**
- [ ] CSV 내보내기 버튼 클릭 → 파일 다운로드
- [ ] CSV 내용 확인 (제목, 연도, 별점, 날짜 등)

---

### 10.4 데이터 가져오기 (CSV)

**접근:** 홈 메뉴 → "CSV 가져오기" → CsvImportModal

일반 CSV 형식 또는 이전에 내보낸 CSV를 다시 가져오기. 중복 처리 옵션 포함.

**✅ 점검 체크리스트**
- [ ] CSV 파일 업로드 → 미리보기 표시
- [ ] 중복 작품 처리 방식 선택 (덮어쓰기/건너뛰기)
- [ ] 가져오기 완료 후 목록 반영

---

## 11. 문제 해결

### 로그인이 안 될 때
1. 이메일/비밀번호 오타 확인
2. 브라우저 localStorage 확인 (`F12 → Application → Local Storage`)
3. 백엔드 서버 실행 여부 확인 (포트 4000)
4. `.env` 파일의 DB 연결 정보 확인

### 포스터가 안 나올 때
- TMDB API 응답 지연 — 새로고침 시 재시도
- TMDB API 키 만료 — `backend/.env`의 `TMDB_API_KEY` 확인
- 해당 작품의 tmdb_id가 0인 경우 — 포스터 없음 (정상)

### AI 기능이 응답하지 않을 때
- `ANTHROPIC_API_KEY` 환경변수 확인
- 일일 사용 한도(채팅 30회, 스크린샷 20장) 초과 여부 확인
- Claude API 서비스 상태 확인

### 배포 환경에서 API 응답이 느릴 때 (Cold Start)
Render 무료 플랜은 15분 비활성 후 서버가 슬립 상태에 진입.  
첫 요청에서 30~60초 지연이 발생할 수 있음. 이후 정상 속도로 복귀.

### CSV 가져오기가 실패할 때
- 파일 인코딩 확인 (UTF-8 권장)
- Letterboxd CSV는 `/restore` → "Letterboxd 가져오기" 전용 기능 사용

### 큐레이션 작품 추가가 안 될 때
- 로그인 상태 확인 (bulk-add는 인증 필수)
- 이미 추가된 작품은 "추가됨" 배지 → 중복 추가 불가

---

## 부록 A. 라우트 전체 목록

| 경로 | 페이지 | 인증 필요 |
|------|--------|-----------|
| `/` | 홈 (카드 그리드 + 위젯) | ✓ |
| `/stats` | 통계 차트 | ✓ |
| `/reports` | 월간 AI 리포트 | ✓ |
| `/settings` | 프로필 설정 | ✓ |
| `/lists` | 베스트 리스트 관리 | ✓ |
| `/feed` | 활동 피드 + 사용자 검색 | ✓ |
| `/compare/:userId` | 친구 취향 비교 | ✓ |
| `/watchlists` | 공유 워치리스트 | ✓ |
| `/wishlist` | 개인 위시리스트 | ✓ |
| `/year-in-review/:year` | 연말 결산 슬라이드 | ✓ |
| `/onboarding` | 온보딩 마법사 | ✓ |
| `/restore` | 기록 복원 허브 | ✓ |
| `/restore/chat` | AI 대화형 복원 | ✓ |
| `/restore/:slug` | 큐레이션 리스트 상세 | ✓ |
| `/u/:username` | 공개 프로필 | — |
| `/login` | 로그인 | — |
| `/register` | 회원가입 | — |

---

## 부록 B. 백엔드 API 전체 목록

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/auth/register` | 회원가입 |
| POST | `/api/auth/login` | 로그인 |
| GET | `/api/auth/me` | 내 정보 |
| GET | `/api/user-media` | 작품 목록 |
| POST | `/api/user-media/bulk` | 작품 일괄 추가 |
| POST | `/api/user-media` | 작품 단건 추가 |
| PUT | `/api/user-media/:id` | 작품 수정 |
| POST | `/api/user-media/:id/rewatch` | 재시청 추가 |
| GET | `/api/user-media/history/:tmdbId` | 재시청 이력 |
| PATCH | `/api/user-media/:id/poster` | 포스터 변경 |
| GET | `/api/user-media/public/:tmdbId` | 공개 리뷰 조회 |
| DELETE | `/api/user-media/:id` | 작품 삭제 |
| GET | `/api/me/taste-profile` | 취향 프로필 |
| PATCH | `/api/me/profile` | 프로필 수정 |
| GET | `/api/me/info` | 내 정보 조회 |
| GET | `/api/me/watch-stats` | 시청 시간 통계 |
| GET | `/api/me/life-periods` | 시청 시기 그룹 |
| GET | `/api/curation/lists` | 큐레이션 목록 |
| GET | `/api/curation/lists/:slug/items` | 큐레이션 작품 |
| POST | `/api/curation/bulk-add` | 큐레이션 일괄 추가 |
| GET | `/api/curation/person/search` | 인물 검색 |
| GET | `/api/curation/person/:tmdbId/works` | 인물 작품 목록 |
| POST | `/api/restore/chat` | AI 대화 |
| GET | `/api/restore/chat/history` | 대화 이력 |
| POST | `/api/restore/chat/accept` | 작품 추가 |
| DELETE | `/api/restore/chat/history` | 이력 삭제 |
| POST | `/api/restore/letterboxd-csv` | Letterboxd CSV |
| GET | `/api/onboarding/status` | 온보딩 상태 |
| POST | `/api/onboarding/step` | 단계 저장 |
| POST | `/api/onboarding/complete` | 완료 처리 |
| GET | `/api/me/watchlist` | 위시리스트 목록 |
| POST | `/api/me/watchlist` | 위시리스트 추가 |
| PATCH | `/api/me/watchlist/:id` | 위시리스트 수정 |
| DELETE | `/api/me/watchlist/:id` | 위시리스트 삭제 |
| POST | `/api/me/watchlist/:id/watched` | 시청 완료 처리 |
| GET | `/api/recommend/similar/:mediaId` | 비슷한 작품 |
| GET | `/api/recommend/daily` | 오늘의 추천 |
| POST | `/api/search/natural` | 자연어 검색 |
| GET | `/api/year-in-review/:year` | 연말 결산 데이터 |
| GET | `/api/me/reports` | 리포트 목록 |
| GET | `/api/me/reports/:period` | 리포트 상세 |
| POST | `/api/me/reports/generate` | 리포트 생성 |
| POST | `/api/follow/:userId` | 팔로우 |
| DELETE | `/api/follow/:userId` | 언팔로우 |
| GET | `/api/me/following` | 팔로잉 목록 |
| GET | `/api/me/followers` | 팔로워 목록 |
| GET | `/api/search/users` | 사용자 검색 |
| GET | `/api/feed` | 활동 피드 |
| GET | `/api/compare/:userId` | 취향 비교 |
| GET | `/api/social/media/:tmdbId/friends-activity` | 친구 활동 |
| GET | `/api/profile/:username` | 공개 프로필 |
| GET | `/api/profile/:username/media` | 공개 감상 목록 |
| GET | `/api/lists` | 내 리스트 목록 |
| POST | `/api/lists` | 리스트 생성 |
| GET | `/api/lists/:id` | 리스트 상세 |
| PATCH | `/api/lists/:id` | 리스트 수정 |
| DELETE | `/api/lists/:id` | 리스트 삭제 |
| POST | `/api/lists/:id/items` | 항목 추가 |
| DELETE | `/api/lists/:id/items/:itemId` | 항목 삭제 |
| PATCH | `/api/lists/:id/items/:itemId` | 항목 수정 |
| GET | `/api/lists/public/:username` | 공개 리스트 |
| GET | `/api/watchlists` | 공유 워치리스트 목록 |
| POST | `/api/watchlists` | 워치리스트 생성 |
| GET | `/api/watchlists/:id` | 상세 |
| DELETE | `/api/watchlists/:id` | 삭제 |
| POST | `/api/watchlists/:id/invite` | 초대 |
| DELETE | `/api/watchlists/:id/leave` | 탈퇴 |
| POST | `/api/watchlists/:id/items` | 항목 추가 |
| DELETE | `/api/watchlists/:id/items/:itemId` | 항목 삭제 |
| PATCH | `/api/watchlists/:id/items/:itemId/watched` | 시청 완료 |
| POST | `/api/import/screenshot` | 스크린샷 분석 |
| GET | `/api/import/screenshot/search` | 수동 재검색 |

---

## 부록 C. DB 테이블 구조

| 테이블 | 주요 컬럼 |
|--------|-----------|
| `users` | id, email, password, name, username, bio, avatar_url, is_profile_public, onboarding_completed, onboarding_step, daily_chat_count, last_chat_reset_at |
| `user_media` | id, user_id, type, title, year, director, cast_info, tmdb_id, poster_url, rating, review_text, watched_at, rewatch_count, is_public, watched_with, watched_at_place, mood, life_period |
| `curation_lists` | id, slug, title, category, description, region, media_type, display_order |
| `curation_items` | id, list_id, tmdb_id, tmdb_type, title, year, poster_path, display_order |
| `memory_chats` | id, user_id, role, content, works_json, created_at |
| `user_watchlist` | id, user_id, tmdb_id, type, title, year, poster_url, priority, note, added_at |
| `user_lists` | id, user_id, title, description, is_public |
| `user_list_items` | id, list_id, user_id, media_id, comment, display_order |
| `shared_watchlists` | id, title, creator_id |
| `shared_watchlist_members` | id, watchlist_id, user_id |
| `shared_watchlist_items` | id, watchlist_id, media_id, watched_by (JSONB) |
| `social_follows` | id, follower_id, following_id |
| `year_in_review_cache` | id, user_id, year, data_json, generated_at |
