# Google Play Data Safety / 콘텐츠 등급 답변 초안 (Stage 11.4.2)

> 아래 항목은 실제 코드(`backend/src/app.js` 테이블 정의, 각 라우트 파일)를
> 직접 확인해서 작성했다. 추측으로 채운 항목 없음 — 근거가 안 되는 항목은
> "확인 필요"로 표시했다.

---

## 1. 실제로 수집·저장하는 데이터 (코드/DB 기준)

### 1-1. 계정 (필수)
| 데이터 | 저장 위치 | 비고 |
|---|---|---|
| 이메일 | `users.email` | 로그인 ID, UNIQUE |
| 비밀번호 | `users.password` | bcrypt 해시로 저장 (평문 없음) |
| 이름 | `users.name` | 가입 시 입력 |

### 1-2. 프로필 (선택)
| 데이터 | 저장 위치 | 비고 |
|---|---|---|
| 유저네임/자기소개 | `users.username`, `users.bio` | 공개 프로필용 |
| 아바타 URL | `users.avatar_url` | **외부 이미지 URL 문자열**을 저장하는 것뿐, 파일 업로드 아님 (서버에 이미지 저장 안 함) |
| 프로필 공개 여부 | `users.is_profile_public` | |

### 1-3. 감상 기록 (핵심 기능)
`user_media` 테이블: type, title, year, director, cast_info, tmdb_id, poster_url,
rating, review_text(리뷰 본문), review_date, watched_at, runtime_minutes,
rewatch_count, **watched_with(누구와)**, **watched_at_place(어디서, 자유 텍스트 —
GPS 좌표 아님, `navigator.geolocation` 사용 코드 없음 확인)**, **mood(기분)**,
companion_names, is_public(공개 여부)

### 1-4. 위시리스트 / 리스트 / 소셜
- `wishlist`: 보고 싶은 작품, 우선순위, 시청 예정 플랫폼, 메모
- `follows`, `shared_watchlists(_members/_items)`, `lists`, `list_items`: 팔로우 관계,
  공유 워치리스트 멤버/아이템, 베스트 리스트 — 모두 user_id로 연결된 관계 데이터

### 1-5. AI 기능 관련
- `user_taste_profile`: 장르/감독/연대별 집계 수치 (원본 텍스트 아님, 통계값)
- `recommendations`, `daily_recommendations`, `year_in_review_cache`: AI/TMDB 응답 캐시
- `ai_reports.content`: 월간 AI 리포트 생성 결과 텍스트
- `discovery_chats`: AI 채팅 추천의 role/content(대화 내용)/session_id
- `report_templates.components`: 리포트 커스터마이징 설정값

### 1-6. 결제
- `payment_history`: amount_krw, tokens_added, package_type, status,
  toss_order_id/toss_payment_key(토스 결제 시) 또는
  google_purchase_token/google_order_id(Google Play 결제 시, Stage 11.3.4)
- **카드번호 등 결제수단 정보 자체는 우리 서버에 저장되지 않음** — 토스는 토스
  SDK가 띄우는 결제창에서 직접 처리, Google Play는 Google 결제 시트에서 직접 처리.
  우리 서버가 보관하는 건 주문 식별자와 금액/토큰 수뿐.
- `token_usage_log`: feature, tokens_used, claude_input/output_tokens,
  claude_cost_usd, metadata — AI 기능 사용량 로그 (비용 추적용)

### 1-7. 스크린샷 이미지 (일시적 — 영구 저장 안 함)
`backend/src/routes/importScreenshot.js` 확인 결과:
1. 업로드된 이미지를 `backend/uploads/`에 임시 저장 (multer)
2. 이미지를 base64로 인코딩해 Claude Vision API로 전송 (작품 제목 추출용)
3. **응답을 받은 직후 `finally` 블록에서 임시 파일을 즉시 삭제** (`fs.unlinkSync`)
→ 서버에 이미지가 영구 저장되지 않음. Data Safety의 "사진" 항목은
"수집됨" + "일시적 처리 후 삭제"로 답변 가능.

### 1-8. 인증 토큰
JWT를 프론트 `localStorage`에 저장 (서버 세션 테이블 없음, stateless).

### 수집하지 않는 것 (확인 완료)
- 위치정보(GPS): 코드에 `navigator.geolocation` 사용 없음
- 광고/분석 SDK: frontend·backend package.json에 Firebase/Sentry/Analytics/Ads
  계열 패키지 전혀 없음 (직접 검색 확인)
- 프로필 사진 실제 업로드: avatar_url은 URL 문자열 저장뿐, 업로드 API 없음

---

## 2. 데이터별 수집 목적

| 데이터 | 목적 |
|---|---|
| 이메일/비밀번호/이름 | 회원 인증, 서비스 제공 |
| 감상 기록 전반 | 핵심 기능(기록·통계·연말결산), AI 추천 개인화 |
| AI 채팅/리포트 내용 | 이용자가 요청한 AI 기능 결과 제공 |
| 결제 이력 | 토큰 충전 처리, 환불 처리, (세법상) 거래 기록 보관 |
| 팔로우/공개 프로필 | 이용자가 선택한 소셜 기능 제공 |
| 스크린샷 이미지 | 작품 자동 인식 기능 제공 목적, 처리 후 즉시 삭제 |

**서비스 개선 목적의 통계 분석은 현재 별도 집계 파이프라인이 없음** — 있다고
쓰면 안 됨. 기존 `/policy/privacy` 문구 중 "서비스 개선을 위한 통계 분석"은
실제로는 없는 기능이라 과장 표현일 수 있음 (아래 3번 참고).

---

## 3. 전송 암호화

- 프론트(Vercel 예정/배포) ↔ 백엔드(Render): 둘 다 HTTPS 기본 제공
- Capacitor 앱: `capacitor.config.json`의 `server.androidScheme: "https"` 확인
- TMDB/Anthropic/토스/Google API 호출: 전부 `https://` 엔드포인트만 사용 (코드 확인)
→ **"전송 중 암호화: 예"**로 답변 가능

---

## 4. 삭제 요청 가능 여부

- `DELETE /api/auth/me` (이번 세션에 비밀번호 확인 단계 추가로 강화) —
  `users` 삭제 시 관련 테이블 CASCADE 삭제 확인됨(사용자 테스트 완료: user_media 0건)
- 앱/웹 모두 로그인 후 설정(`/settings`) 화면에서 "계정 삭제" 가능
  → Play Console이 요구하는 "로그인 없이도 웹에서 삭제 요청 가능한 경로"까지는
  아니고, **로그인 후 앱 또는 웹에서 삭제 가능**한 형태. 대부분의 개인 개발자
  앱은 이 형태로 통과하지만, Data Safety 양식에서 "계정 삭제 방법"을 적을 때
  "앱 및 웹사이트 내 설정에서 삭제 가능"으로 명시할 것.
→ **"데이터 삭제 요청 가능: 예"**로 답변 가능

---

## 5. 제3자 공유 현황 (코드 기준)

| 제3자 | 전송되는 데이터 | 목적 |
|---|---|---|
| TMDB (The Movie Database) | 검색어(작품 제목), tmdb_id | 작품 메타데이터/포스터 조회 — 개인 식별 정보 없음 |
| Anthropic (Claude API) | 자연어 검색어, AI 채팅 메시지, 리포트용 감상 데이터 요약, **스크린샷 이미지(일시적)** | AI 기능(검색·채팅·리포트·스크린샷 인식) 처리 |
| 토스페이먼츠 | 주문 ID, 결제 금액 | 웹 결제 처리 (카드 정보는 토스가 직접 수집) |
| Google Play (Android Publisher API) | purchaseToken, productId | 앱 내 인앱결제 검증 (Stage 11.3.4) |
| Supabase (DB 호스팅), Render (서버 호스팅) | 위 모든 데이터 전체 | 인프라 제공 — 마케팅 등 별도 활용 없음 |

⚠️ **중요 — 기존 `/policy/privacy` 페이지와의 불일치 발견**

`frontend/src/pages/PolicyPage.jsx`의 `privacy` 섹션(최종 수정일 2026-05-14)을
실제로 읽어봤는데, "제3자 제공" 항목에 **토스페이먼츠만 명시**되어 있고
**TMDB, Anthropic(Claude API), Google Play는 빠져 있음**. Stage 11.3에서
Google Play 결제까지 추가된 지금 기준으로는 실제 데이터 흐름과 정책 문구가
어긋난 상태. Play 심사에서 Data Safety 양식과 개인정보처리방침 내용이 다르면
반려 사유가 될 수 있어 **PolicyPage.jsx의 privacy 섹션도 업데이트를 권장**함
(원하면 바로 반영해줄게 — 확인 후 알려줘).

---

## 6. 개인정보처리방침 URL 확인

- 라우트: `frontend/src/App.jsx`에 `<Route path="/policy/:type" element={<PolicyPage />} />`
  등록 확인 — `/policy/privacy`로 접근 시 실제 정책 본문이 렌더링됨(코드 확인 완료)
- ⚠️ **실제 배포 도메인은 이 대화에서 확인할 수 없음** — 존재 여부를 코드로는
  검증했지만, Play Console에 입력할 실제 URL(`https://<배포도메인>/policy/privacy`)은
  로그인해서 접속하는 배포 사이트에서 직접 열어 확인해줘. (URL을 추측해서 알려주지 않음)

---

## 7. 콘텐츠 등급 설문 예상 답변

- **서비스 유형**: 게임 아님, 미디어 정보·개인 기록 서비스
- **사용자 생성 콘텐츠(UGC) 있음 → 예**
  - 근거: `review_text`(리뷰), `is_public`/공개 프로필로 다른 이용자에게 노출 가능
    (`FeedPage`, `PublicProfilePage`, `ComparePage`)
- **UGC 신고/차단 기능 → 없음** (코드 확인: `social.js`에 report/block 관련
  엔드포인트 전혀 없음). 설문에서 "신고 기능이 있다"고 답하면 실제와 다르니
  주의. 필요하면 이 부분은 BACKLOG로 남기고 정직하게 "없음"으로 답변 권장.
- **폭력/성인 콘텐츠 직접 생성 없음**: 앱 자체는 영화 메타데이터와 이용자
  리뷰 텍스트만 다루고, 이용자가 직접 폭력적·선정적 콘텐츠를 작성할 가능성은
  이론상 있으나(자유 텍스트 리뷰) 필터링 시스템은 없음 — 이 역시 정직하게
  "사용자가 자유 텍스트를 게시할 수 있고 별도 필터링은 없음"으로 답변.

---

## 참고 — 이 문서가 다루지 않는 것

- 실제 Play Console Data Safety 양식의 정확한 문항/보기는 시기별로 바뀌므로,
  이 문서는 "무엇을 어떻게 답해야 하는지 근거"를 정리한 것이지 양식 캡처가 아님.
  입력 시 이 문서를 참고해서 실제 문항에 맞게 골라줘.
