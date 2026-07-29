# 미디어 다이어리 — 확장 로드맵 (Phase 5)

> 이 문서는 Claude Code가 자동으로 참고하며 작업하는 확장 기능 로드맵입니다.
> ROADMAP.md의 후속 문서입니다. Phase 5 작업 시 이 파일을 사용합니다.
> 진행 상황은 체크박스로 표시하고, 완료 시 ✅로 변경합니다.
> 작성일: 2026-05-11

---

## 📌 작업 원칙

- 우선순위 순서대로 진행 (5.1 → 5.2 → 5.3 → ...)
- 각 작업 완료 시 체크박스 [x] 처리 및 이 문서 업데이트
- 한 기능이 완전히 끝나야 다음 기능으로
- 큰 변경사항은 git commit (`feat:`, `fix:`, `refactor:` prefix)
- 모든 코드에 한국어 주석 포함
- DB 마이그레이션은 Supabase SQL Editor에서 실행할 SQL을 사용자에게 안내 후 적용
- UI 시각 확인이 필요한 항목은 사용자 확인 체크리스트로 별도 정리
- 비용 발생 가능한 작업(Claude API)은 사용자에게 사전 안내

---

## Phase 5 — 사용자 가치 확장

> 발견·기록 도구를 넘어 "되돌아보는 도구"로
> 장기 사용자 가치와 재방문 동기 강화

---

### ✅ 5.1 연말 결산 (Year in Review) — 완료 (2026-05-12)

> Spotify Wrapped 스타일 연말 회고 페이지

#### 백엔드

- [x] **연말 데이터 집계 API** — `GET /api/year-in-review/:year`
  - 총 감상 수, 총 시청 시간, 장르 분포, 감독 TOP 3, 연대 TOP 3
  - 별점 ★5 목록, 월별 추이, 작년 대비 비교, 최장/최단 작품
  - `runtime_minutes` 없을 때 타입별 추정값 사용 (movie: 110, drama: 60, anime: 24)

- [x] **캐싱 전략** — `year_in_review_cache` 테이블
  - 완료 연도: 영구 캐시 / 진행 중 연도: 1시간 TTL

#### 프론트엔드

- [x] **`/year-in-review/:year` 라우트 신설** — `YearInReviewPage.jsx`
  - 9슬라이드: 인트로 → 감상 수 → 시청 시간 → 장르 → ★5 → 월별 → 감독 → 작년 비교 → 아웃트로
  - CSS transition 방식 슬라이드 (Swiper 미사용)
  - 키보드 방향키 + ESC 지원

- [x] **공유 기능** — html2canvas로 PNG 저장, 워터마크 포함

- [x] **진입 동선**
  - 홈 위젯 아래 배너 (11월~3월 노출)
  - 통계 페이지 상단 배너

#### 사용자 확인 체크리스트

- [ ] 슬라이드 전환이 부드럽게 동작하는지
- [ ] 이미지 저장이 모바일에서도 동작하는지
- [ ] 데이터가 없는 사용자(가입 후 작품 0개)는 빈 상태 메시지가 보이는지

---

### ✅ 5.2 위시리스트 (Watchlist) — 완료 (2026-05-12)

- [x] `wishlist` 테이블 신설 (user_id, type, title, year, tmdb_id, poster_url, priority, note)
- [x] CRUD API — `GET/POST /api/me/watchlist`, `PATCH/DELETE /api/me/watchlist/:id`
- [x] `POST /api/me/watchlist/:id/watched` — user_media로 이동 후 위시리스트 삭제
- [x] WishlistPage.jsx — TMDB 검색, 우선순위 별 (★1-3), 봤어요! 미니 폼
- [x] `/wishlist` PrivateRoute 등록, 드롭다운 메뉴 "나중에 보기" 링크 추가
- [x] API 경로 `/api/wishlist` → `/api/me/watchlist` 통일 (2026-05-12 감사 수정)

---

### ✅ 5.3 시청 시간 합산 — 완료 (2026-05-12)

- [x] `GET /api/me/watch-stats?period=year|month|all` — 총 시간, 타입별, 편당 평균, TOP 3
- [x] 통계 페이지 상단 시청 시간 카드 (기간 탭 전환, 위트 있는 비교 문구)
- [x] 홈 위젯 "이번 달 N편 / N시간", "올해 N편 / N시간" 형식으로 확장 (2026-05-12 감사 수정)

---

### ✅ 5.4 재시청 추적 (Re-watch) — 완료 (2026-05-12)

- [x] `rewatch_count INTEGER DEFAULT 1` 컬럼 추가, UNIQUE(user_id,title,year) → UNIQUE(user_id,title,year,rewatch_count)
- [x] `POST /api/user-media/:id/rewatch` — 새 시청 기록 생성 (max rewatch_count + 1)
- [x] `GET /api/user-media/history/:tmdbId` — 시청 이력 조회
- [x] DetailModal에 재시청 이력 목록 + "다시 봤어요" 폼 추가

---

### ✅ 5.5 빠른 입력 모드 — 완료 (2026-05-12)

- [x] QuickInputModal.jsx — TMDB 검색 → 선택 → 별점(숫자키 1-5) → 저장
- [x] 모바일 FAB 버튼 (하단 고정, 모바일에서만 노출)
- [x] Cmd/Ctrl+K 단축키
- [x] 저장 후 토스트 알림

---

### ✅ 5.6 시청 컨텍스트 기록 — 완료 (2026-05-12)

- [x] `watched_with`, `watched_at_place`, `mood`, `companion_names` 컬럼 추가 (모두 NULL 허용)
- [x] PUT /api/user-media/:id에 필드 통합 (COALESCE로 선택적 업데이트)
- [x] DetailModal에 컨텍스트 섹션 추가 (접힘/펼침, 칩 선택 UI)

---

## 🔧 기술 부채 (Phase 5 진행 중 병행)

### 모달 컴포넌트 정리

- [ ] DetailModal이 컨텍스트, 시청 이력 등으로 비대해질 가능성
- [ ] 탭 또는 섹션 폴딩으로 정리

### 통계 API 통합

- [ ] 여러 통계 API들이 분산될 가능성
- [ ] `GET /api/me/stats` 단일 엔드포인트로 통합 검토

### 마이그레이션 안전성

- [ ] 5.4 user_media UNIQUE 제거는 위험도 높음
- [ ] 실행 전 백업 필수
- [ ] 마이그레이션 SQL을 사용자에게 먼저 보여주고 승인받기

---

## 📝 진행 로그

작업할 때마다 아래에 기록:

<!-- 새 작업은 이 아래에 추가 -->

---

## 🎯 다음 작업

**현재 시작점: Phase 5.1 — 연말 결산 (Year in Review)**

순서:
1. year_in_review_cache 테이블 마이그레이션 SQL 작성 → 사용자 승인 → 적용
2. 백엔드 데이터 집계 API 작성
3. 프론트엔드 슬라이드 페이지 구현
4. 공유 기능 (html2canvas) 통합
5. 진입 동선 (배너) 추가
6. 동작 확인 + git commit
7. Phase 5.2로 진행

---

## ❓ 사용자 확인이 필요한 사항

작업 중 다음과 같은 결정이 필요할 때는 멈추고 사용자에게 물어보기:

- DB 마이그레이션 실행 (특히 5.4 UNIQUE 제거)
- 새 라이브러리 도입 (html2canvas, swiper 등)
- 외부 API 호출 빈도 변경
- 기존 사용자 데이터에 영향을 주는 변경
- UI 디자인 방향성 (시각적 결정이 필요할 때)

---

## 📐 디자인 가이드

기존 디자인 시스템 준수:
- 카드 그리드 레이아웃 일관성
- 모달 패턴 (DetailModal과 유사한 구조)
- 모바일 우선 반응형
- 한국어 UI 우선

새로운 패턴이 필요한 경우:
- Year in Review 슬라이드: 풀스크린 스토리 UX (별도 패턴)
- 빠른 입력 FAB: 모바일 하단 고정
- 위시리스트: 기존 카드 그리드 재사용

---

## 🚨 비용 주의

이번 Phase에서는 외부 API 호출이 거의 없음:
- TMDB API: 캐싱된 데이터 활용 (추가 비용 없음)
- Claude API 미사용

단, 향후 Phase 6 등에서 Claude API 사용 시 비용 발생 가능성 있음.
