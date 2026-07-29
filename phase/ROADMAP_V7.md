# 미디어 다이어리 — Phase 11 로드맵 (Play Store 출시)

> Claude Code가 자동으로 참고하며 작업하는 로드맵입니다.
> Phase 10 + 토큰 결제 시스템 완료 후의 출시 단계입니다.
> 작성일: 2026-07-16

---

## 📌 작업 원칙

- Stage 단위로 순차 진행 (11.1 → 11.2 → ...)
- 작업 완료 시 체크박스 [x] 처리 + 진행 로그 기록
- 큰 변경은 git commit (`feat:`, `fix:`, `build:` prefix)
- 모든 코드에 한국어 주석
- **결제 관련 작업은 특히 신중하게** — 영수증 검증은 반드시 서버 사이드
- Android 네이티브 설정 변경 시 어떤 파일을 왜 수정하는지 설명 추가
- 사용자가 직접 해야 하는 작업(콘솔 설정 등)은 [사용자 작업]으로 명시

---

## 🎯 이 Phase의 본질

**"완성된 웹 서비스를 Google Play 앱으로 출시한다"**

전략 확정 사항:
- 포장 방식: **Capacitor** (네이티브 래핑, WebView + Bridge)
- 웹 자산: **번들 모드** (APK/AAB에 포함, 오프라인 셸 가능)
- API 통신: 기존 Render 백엔드 그대로 사용
- 결제 분기:
  - **앱(Play Store)** → Google Play 인앱 결제 (소비성 상품, 수수료 15%)
  - **웹(Vercel)** → 토스페이먼츠 (심사 통과 후, 수수료 3.3%)
  - 플랫폼 감지로 자동 분기

---

## 사전 준비 상태 (완료됨)

- [x] 사업자 등록
- [x] Google Play 개발자 계정 승인
- [x] 토큰 시스템 (가입 50토큰, 잔액/차감/사용 로그)
- [x] 토스페이먼츠 웹 결제 (테스트 통과)
- [x] Cold Start 해결 (UptimeRobot)
- [x] 중복 판단 버그 + 데이터 정리

---

## Stage 11.1 — PWA 기본기 정비

> Capacitor 이전에 웹앱 기본기부터. 1일 예상

### 11.1.1 매니페스트 & 아이콘

- [x] **`frontend/public/manifest.json` 작성/보강** (2026-07-20)
  - name: "미디어 다이어리" / short_name: "미디어다이어리"
  - theme_color / background_color: `#863bff` (기존 favicon.svg 브랜드 퍼플)
  - display: "standalone", start_url: "/"
  - icons: 192x192, 512x512 + maskable 192/512

- [x] **앱 아이콘 제작** (2026-07-20)
  - 신규 디자인 대신 기존 `favicon.svg` 브랜드 마크(플래시 로고) 재사용 — 사용자 확인 완료
  - `@resvg/resvg-js`로 SVG → PNG 래스터화, `frontend/public/icons/`에 배치
    - icon-192.png, icon-512.png (투명 배경, 로고 85%)
    - icon-maskable-192.png, icon-maskable-512.png (흰 배경, 로고 60% — 세이프존 확보)

- [x] **index.html에 매니페스트 링크 + 메타 태그** (2026-07-20)
  - `<link rel="manifest">`, `<meta name="theme-color">`, `<link rel="apple-touch-icon">` 추가
  - `<title>`을 Vite 기본값("frontend")에서 "미디어 다이어리"로 수정

### 11.1.2 스플래시 & 모바일 최적화 점검

- [x] 세로 모드 고정 여부 결정 (기본: 세로 고정 권장) — 세로 고정으로 확정, Stage 11.2.1에서 AndroidManifest.xml에 반영 (2026-07-20)
- [ ] 모바일 뷰포트 메타 태그 확인
- [ ] 터치 영역 44px 이상 (기존 Phase 8 반응형 재확인)

### 사용자 확인 체크리스트

- [ ] 아이콘 시안 확인
- [ ] Chrome 모바일에서 "홈 화면에 추가" 시 아이콘/이름 정상

---

## Stage 11.2 — Capacitor 프로젝트 셋업

> 2일 예상

### 11.2.1 Capacitor 설치 및 초기화

- [x] **패키지 설치** (2026-07-20)
  ```bash
  cd frontend
  npm install @capacitor/core @capacitor/cli @capacitor/android
  ```

- [x] **초기화** (2026-07-20)
  ```bash
  npx cap init "미디어 다이어리" "com.mediadiary.app" --web-dir=dist
  ```
  - appId: `com.mediadiary.app` (변경 불가하니 신중히 — 사용자 확인)
  - webDir: Vite 빌드 산출물 `dist`

- [x] **capacitor.config.json 설정** (2026-07-20)
  - 프론트엔드가 순수 JS 프로젝트라 `cap init`이 `.ts` 대신 `capacitor.config.json` 생성 (동작 동일)
  ```json
  {
    "appId": "com.mediadiary.app",
    "appName": "미디어 다이어리",
    "webDir": "dist",
    "server": {
      "androidScheme": "https"
    }
  }
  ```

- [x] **Android 플랫폼 추가** (2026-07-20)
  ```bash
  npm run build
  npx cap add android
  npx cap sync
  ```
  - 세로 모드 고정: `android/app/src/main/AndroidManifest.xml`의 `<activity>`에 `android:screenOrientation="portrait"` 추가
  - `./gradlew assembleDebug` 빌드 성공 확인 (`android/app/build/outputs/apk/debug/app-debug.apk`, 약 4.5MB)

### 11.2.2 [사용자 작업] Android Studio 설치

- [ ] Android Studio 설치 (https://developer.android.com/studio)
- [ ] SDK 및 에뮬레이터 설정
- [ ] `npx cap open android` 로 프로젝트 열기 확인

### 11.2.3 API 통신 확인

- [x] **환경변수 점검** (2026-07-20)
  - 발견: 이전 Capacitor 빌드가 로컬 `frontend/.env`(`VITE_API_URL=http://localhost:4000`)를 그대로 사용해 APK에 잘못된 URL이 박혀 있었음
  - `frontend/.env.production` 신설 (`VITE_API_URL=https://media-diary-api.onrender.com`, git-ignore 처리) → `vite build` 기본 모드가 production이라 자동 적용
  - `npm run build` 후 번들에서 `media-diary-api.onrender.com` 포함 / `localhost:4000` 미포함 확인

- [x] **CORS 확인** (2026-07-20)
  - 확인 결과: `backend/src/app.js`가 `app.use(cors())`를 옵션 없이 호출해 **현재 모든 origin을 허용 중** (CORS_ORIGINS env는 코드에서 읽히지 않음, 2026-05-12 세션 미결 항목이 방치된 것으로 확인)
  - 사용자 결정: 지금은 그대로 두고 진행 (Capacitor 앱은 이미 정상 동작). 화이트리스트 적용은 "기술 부채 & 후속 과제" 섹션에 기록해 출시 전 처리
  - Render 측 조치 불필요 (코드가 CORS_ORIGINS를 안 읽으므로 값 추가해도 효과 없음)

- [ ] **에뮬레이터/실기기에서 전체 흐름 테스트**
  - 로그인 → 작품 추가 → AI 기능 → 통계

### 11.2.4 딥링크 & 뒤로가기 처리

- [x] Android 하드웨어 뒤로가기 버튼 → react-router 히스토리 연동 (2026-07-20)
  - `@capacitor/app` 설치, `frontend/src/hooks/useAndroidBackButton.js` 신설
  - 홈(`/`)이 아니면 `navigate(-1)`, 홈이면 `window.confirm` 종료 확인 후 `App.exitApp()`
  - `App.jsx`에 `AndroidBackButtonListener` 컴포넌트로 BrowserRouter 내부에 연결 (useNavigate/useLocation 컨텍스트 필요)
  - `cap sync` + `gradlew assembleDebug` 재검증 — BUILD SUCCESSFUL

### 사용자 확인 체크리스트

- [ ] 에뮬레이터에서 앱 구동, 로그인/기능 정상
- [ ] 뒤로가기 버튼 자연스러움
- [ ] 실기기(USB 디버깅)에서도 확인

---

## Stage 11.3 — Google Play 인앱 결제

> 이 Phase의 핵심. 4~5일 예상

### 11.3.1 [사용자 작업] Play Console 상품 등록

- [ ] Play Console → 앱 생성 (내부 테스트용 최초 등록 필요)
- [ ] 수익 창출 → 인앱 상품 → **소비성 상품** 3종 등록:
  | 상품 ID | 이름 | 가격 | 토큰 |
  |---------|------|------|------|
  | `token_small` | 토큰 100개 | ₩1,000 | 100 |
  | `token_medium` | 토큰 350개 | ₩3,000 | 350 |
  | `token_large` | 토큰 1300개 | ₩10,000 | 1,300 |
- [ ] 참고: 첫 충전 +20% 보너스는 우리 서버에서 처리 (상품 자체는 고정)

### 11.3.2 플랫폼 감지 & 결제 분기

- [x] **플랫폼 감지 유틸** `frontend/src/utils/platform.js` (2026-07-30)
  ```javascript
  import { Capacitor } from '@capacitor/core';
  export const isNativeApp = () => Capacitor.isNativePlatform();
  ```

- [x] **BillingChargePage 분기** (2026-07-30)
  - 네이티브 앱 → Google Play 결제 UI
  - 웹 → 기존 토스페이먼츠 UI
  - 패키지 카드 UI는 공유, 결제 버튼 핸들러만 분기

### 11.3.3 인앱 결제 플러그인 연동

- [x] **플러그인 선택 및 설치** (2026-07-30)
  - `@capacitor-community/in-app-purchases`는 실존하지 않는 패키지로 확인됨(2026-07-20)
  - 실제 설치: **`capacitor-plugin-cdv-purchase`** v13.18.0 (cordova-plugin-purchase의
    Capacitor 전용 배포판, iOS StoreKit2 + Android Billing 8.3 네이티브 브릿지,
    최근 업데이트 2026-07-16 확인 후 설치)

- [x] **구매 흐름 구현** (2026-07-30, 코드 레벨 — 실기기 테스트는 대기)
  1. 상품 목록 조회 (`store.register` + `store.get(productId).getOffer()`)
  2. 구매 요청 → `store.order(offer)`로 Google 결제 시트 표시
  3. 구매 완료 → `store.when().approved()`에서 `transaction.parentReceipt.purchaseToken` 획득
  4. 백엔드로 purchaseToken 전송 (`POST /api/billing/google/verify`)
  5. 서버 검증 성공 응답 → **`transaction.finish()`(consume)** 호출
  6. 토큰 잔액 UI 갱신 (`useTokenStore.setBalance`)

- [x] **중요: consume 처리** (2026-07-30)
  - 서버 검증 성공 "후"에만 finish/consume 호출 (순서 엄수, 코드로 확인됨)
  - consume 실패 시 재시도: 자체 재시도 루프 대신, 검증은 이미 성공한 것으로 처리하고
    (잔액 갱신 정상 진행) finish 실패는 로그만 남김 — 미완료 트랜잭션은 플러그인이
    다음 `store.initialize()` 때 로컬 영수증에서 다시 `approved`로 전달하는 방식에 의존
  - 중복 구매(서버가 409 반환) 시에는 토큰 재지급 없이 finish()만 호출해 기기에
    남은 미완료 구매가 재구매를 막는 상황을 방지

### 11.3.4 백엔드 영수증 검증 (보안 핵심)

- [ ] **[사용자 작업] Google Cloud 서비스 계정 생성**
  - Play Console → API 액세스 → 서비스 계정 연결
  - JSON 키 발급 → Render 환경변수 `GOOGLE_SERVICE_ACCOUNT_JSON` 등록
  - 권한: 인앱 상품 조회

- [x] **POST /api/billing/google/verify** (2026-07-30)
  - 요청: `{ productId, purchaseToken }`
  - 처리:
    1. Google Play Developer API로 purchaseToken 검증
       (`purchases.products.get`, google-auth-library JWT 인증)
    2. purchaseState === 0 (구매 완료) 확인
    3. **중복 검증**: payment_history에 동일 purchaseToken 존재 시 거부 (사전 조회 +
       UNIQUE 제약 이중 방어, DB 레벨 충돌은 23505로 캐치해 409 응답)
    4. 트랜잭션으로:
       - payment_history 기록 (provider: 'google', google_purchase_token)
       - users.token_balance 증가
       - 첫 충전 보너스 +20% 적용 (has_used_first_charge_bonus 체크)
    5. 응답: `{ success, addedTokens, newBalance }`
  - GOOGLE_SERVICE_ACCOUNT_JSON 미설정 시 명확한 에러로 실패 (서비스 계정 등록 전까지는
    코드만 완성된 상태 — 실제 검증 호출은 사용자 작업 완료 후 가능)

- [x] **payment_history 테이블 확장 마이그레이션** (2026-07-30, 사용자가 Supabase에서 직접 실행)
  - 컬럼 추가 + NOT NULL 완화 블록, CHECK 제약 블록을 분리해 순서대로 실행
    (한 배치로 실행 시 "column provider does not exist" 오류 발생 → 2블록으로 분리해 해결)
  ```sql
  -- 블록 1
  ALTER TABLE payment_history
    ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'toss',
    ADD COLUMN IF NOT EXISTS google_purchase_token TEXT UNIQUE,
    ADD COLUMN IF NOT EXISTS google_order_id TEXT;
  ALTER TABLE payment_history ALTER COLUMN toss_order_id DROP NOT NULL;
  ALTER TABLE payment_history ALTER COLUMN toss_payment_key DROP NOT NULL;

  -- 블록 2 (블록 1 확인 후 별도 실행)
  ALTER TABLE payment_history
    ADD CONSTRAINT chk_provider CHECK (provider IN ('toss', 'google'));
  ```

- [x] **보안 체크리스트** (2026-07-30, 코드 레벨 확인)
  - 클라이언트가 보낸 금액/토큰 수는 절대 신뢰하지 않음
    → productId 기준으로 서버에서 토큰 수 결정
  - purchaseToken 중복 사용 차단 (사전 조회 + UNIQUE 제약)
  - 검증 실패 시 토큰 미지급 + 로그 기록

### 11.3.5 환불 처리 방침

- [ ] Google Play 환불은 Google이 처리 → 우리는 감지만
- [ ] (선택) Voided Purchases API 주기 조회로 환불 감지 → 토큰 회수
  - 초기에는 수동 모니터링으로 시작, 자동화는 추후

### 사용자 확인 체크리스트

- [ ] 내부 테스트 트랙에서 실제 구매 흐름 (테스트 카드)
- [ ] 구매 → 토큰 충전 → 재구매 가능(consume) 확인
- [ ] 같은 purchaseToken 재전송 시 거부되는지
- [ ] 웹에서는 여전히 토스 결제창 뜨는지 (분기 확인)

---

## Stage 11.4 — 스토어 등록 준비

> 2~3일 예상

### 11.4.1 [사용자 작업 + Claude Code 보조] 스토어 자산

- [ ] **그래픽 자산**
  - 앱 아이콘 512x512
  - 피처 그래픽 1024x500
  - 스크린샷 최소 2장 (권장 4~8장: 홈/복원/AI채팅/통계/연말결산)
  - Claude Code: 스크린샷 촬영용 데모 데이터 세팅 스크립트 지원

- [ ] **텍스트**
  - 앱 이름 (30자): 미디어 다이어리 — 영화·드라마·애니 기록
  - 짧은 설명 (80자)
  - 자세한 설명 (4000자): 핵심 기능 + 차별점 (과거 기록 복원 강조)
  - Claude Code: 초안 작성

### 11.4.2 정책 필수 항목

- [ ] **개인정보처리방침 URL** — 기존 /policy/privacy 사용 (Phase 9에서 작성)
- [ ] **데이터 안전(Data Safety) 섹션 작성 가이드**
  - 수집 데이터: 이메일, 이름, 감상 기록, 결제 정보
  - 전송 암호화: HTTPS ✓
  - 삭제 요청 방법 명시
  - Claude Code: 답변 초안 작성 → 사용자가 콘솔에 입력
- [ ] **콘텐츠 등급 설문** — 미디어 정보 서비스, 사용자 생성 콘텐츠(리뷰) 있음 주의
- [ ] **계정 삭제 기능 확인** (Google 정책 필수!)
  - 앱 내 계정 삭제 기능이 없다면 이번에 추가:
    - DELETE /api/me/account (모든 데이터 CASCADE 삭제)
    - /settings에 "계정 삭제" 버튼 + 2단계 확인
  - 웹 삭제 URL도 Data Safety에 기재 가능

### 11.4.3 빌드 & 서명

- [ ] **릴리즈 키스토어 생성** [사용자 작업, Claude Code 가이드]
  ```bash
  keytool -genkey -v -keystore media-diary-release.keystore \
    -alias media-diary -keyalg RSA -keysize 2048 -validity 10000
  ```
  - ⚠️ 키스토어 파일 + 비밀번호 분실 시 앱 업데이트 영구 불가
  - 안전한 곳에 백업 (클라우드 + 로컬)
  - git에 절대 커밋 금지 (.gitignore 확인)

- [ ] **AAB 빌드**
  - build.gradle 서명 설정
  - `./gradlew bundleRelease` → app-release.aab
  - versionCode / versionName 관리 규칙 정립 (1 / "1.0.0")

### 사용자 확인 체크리스트

- [ ] 스크린샷 시안 확인
- [ ] 설명문 검토
- [ ] 키스토어 백업 완료
- [ ] 계정 삭제 기능 동작 확인

---

## Stage 11.5 — 테스트 트랙 → 프로덕션

> 1~2주 (심사 대기 포함)

### 11.5.1 내부 테스트

- [ ] AAB 업로드 → 내부 테스트 트랙
- [ ] 본인 계정을 테스터로 등록
- [ ] 실기기 설치 → 전체 기능 회귀 테스트:
  - 로그인/온보딩/작품 추가/복원/AI 채팅/통계/연말 결산
  - **인앱 결제 (테스트 결제)**
  - 뒤로가기, 딥링크, 화면 회전

### 11.5.2 프로덕션 심사 제출

- [ ] 비공개 테스트 생략 여부 결정 (개인 개발자는 비공개 테스트 요건 확인 필요 — 2023년 이후 신규 개인 계정은 20명 테스터 14일 요건이 있을 수 있음. Play Console에서 확인 후 보고)
- [ ] 프로덕션 트랙 제출
- [ ] 심사 기간: 통상 1~7일

### 11.5.3 출시 후 모니터링

- [ ] Play Console 크래시 리포트 확인 루틴
- [ ] 인앱 결제 성공률 모니터링 (token_usage_log + payment_history)
- [ ] 첫 사용자 피드백 수집 채널 (스토어 리뷰 + 인앱 문의 이메일)

---

## 🔧 기술 부채 & 후속 과제

- [ ] 토스 심사 통과 시: 웹 결제 운영 키 전환 + 실결제 1회 테스트
- [ ] 푸시 알림 (Capacitor 이점 활용, 추후 Phase)
- [ ] iOS 빌드 검토 (Capacitor 코드 재사용, Apple 개발자 계정 $99/년 필요)
- [ ] Voided Purchases 자동 환불 감지
- [ ] **CORS_ORIGINS 미적용** — `backend/.env`에 값은 있지만 `app.js`가 `cors()`를 옵션 없이 호출해 실제로는 모든 origin 허용 중 (2026-05-12 세션에 "미결"로 남았던 항목, 그 후 방치됨). Play Store 정식 출시 전 `cors({ origin: process.env.CORS_ORIGINS.split(',') })`로 화이트리스트 적용 필요 (2026-07-20 확인)

---

## 📱 실기기 점검 대기 목록

> 실기기가 없어 코드만 완성해둔 항목들. 실기기 확보 시 한 번에 몰아서 확인.
> 완료된 항목은 체크만 하고 지우지 말 것 (다음 릴리즈 때도 회귀 확인용으로 누적).

- [ ] Google Play 인앱결제 실제 구매 흐름 (내부 테스트 트랙, 테스트 카드)
- [ ] 결제 후 토큰 충전이 잔액 UI에 정확히 반영되는지
- [ ] consume(finish) 후 동일 상품 재구매 가능한지
- [ ] 같은 purchaseToken 재전송 시 서버가 거부(409)하고, 기기에 남은 미완료 구매가
      정리되는지 (finish 재시도 경로)
- [ ] transaction.finish() 실패 후 앱 재시작 시 미완료 트랜잭션이 approved로
      다시 전달되는지 (자체 재시도 로직 대신 이 동작에 의존하고 있음)
- [ ] 에뮬레이터/실기기 전체 흐름 (로그인 → 작품 추가 → AI 기능 → 통계) — Stage 11.2.3 잔여
- [ ] 뒤로가기 버튼 자연스러움, 실기기(USB 디버깅) 확인 — Stage 11.2.4 잔여

---

## 📝 진행 로그

<!-- 새 작업은 이 아래에 추가 -->

### 2026-07-30

- Stage 11.3.2~11.3.4 완료 (코드 레벨, 실기기 테스트는 위 목록으로 이관)
  - 계정 삭제 기능 보안 강화 먼저 커밋: SettingsPage로 이동 + 비밀번호/문구 2단계 확인
  - 관심사별 정리 커밋: 토스 키 누락 방어 fix, 임시 로그/스크립트 gitignore 처리,
    ROADMAP phase/ 이동 + 미사용 문서 삭제, package-lock.json 동기화
  - payment_history 마이그레이션을 컬럼 추가/NOT NULL 완화 블록과 CHECK 제약 블록으로
    분리 실행 (한 배치 실행 시 컬럼 미인식 오류 발생했던 것 수정) — 사용자가 Supabase에서 실행 완료
  - 11.3.2: `frontend/src/utils/platform.js` 신규, BillingChargePage handleCharge를
    네이티브/웹 분기 진입점으로 리팩터 (기존 로직은 handleTossCharge로 이동)
  - 11.3.3: 인앱결제 플러그인은 `capacitor-plugin-cdv-purchase`(cordova-plugin-purchase의
    Capacitor 전용 배포판)로 확정 — README/타입 정의 직접 확인 후 진행. 구매 승인
    이벤트에서 purchaseToken 추출 → 서버 검증 → 성공 시에만 finish(consume)
  - 11.3.4: `POST /api/billing/google/verify` 구현 (google-auth-library JWT로
    Android Publisher API 인증, purchaseState 확인, 중복 차단, 트랜잭션 처리)
  - 리뷰 중 발견해 수정: 서버 검증 성공 후 finish()가 실패하면 이미 충전된 토큰인데도
    에러로 표시되던 버그 → 검증 성공 시점에 바로 잔액/성공 반영, finish 실패는 로그만
- 남은 [사용자 작업]: Play Console 상품 3종 등록(11.3.1), Google 서비스 계정 JSON
  발급 후 `GOOGLE_SERVICE_ACCOUNT_JSON` 등록(11.3.4) — 둘 다 없으면 구매 흐름이
  실제로 동작하지 않음 (코드는 완성, 설정만 남음)

### 2026-07-20

- 사전 조사 3건 완료 및 보고:
  - A) 계정 삭제 기능은 이미 존재 (`DELETE /api/auth/me`, HomePage "회원 탈퇴" 메뉴) → Stage 11.4.2 신규 구현 불필요, Data Safety에 기존 기능 기재만 하면 됨
  - B) `@capacitor-community/in-app-purchases`는 실존하지 않는 패키지(GitHub 404, 공식 문서 미언급) 확인. RevenueCat(`@revenuecat/purchases-capacitor`, 활발히 유지보수)과 `cordova-plugin-purchase`(공식 문서 유일 대안) 중 택1 필요 — **설치 전 사용자 승인 대기 중**
  - C) `BrowserRouter` + Capacitor Android `WebViewAssetLoader` 조합에서 중첩 경로 딥링크/프로세스 복원 시 404 위험 확인(공식 Android 문서 근거) → Stage 11.2.4에서 폴백 처리 필요
- ROADMAP_V7.md 실제 위치가 프로젝트 루트가 아닌 `phase/` 폴더인 것을 확인, CLAUDE.md의 ROADMAP 연동 섹션에 Phase 11 항목 추가
- Stage 11.1.1 완료 (매니페스트, 아이콘, index.html 메타 태그) — 상세는 위 체크박스 참고
- Stage 11.1.2 세로 모드 고정 결정 완료 (세로 고정)
- Stage 11.2.1 완료: Capacitor core/cli/android 설치 → `cap init` (appId `com.mediadiary.app` 확정) →
  `capacitor.config.json`에 `server.androidScheme: https` 추가 → `npm run build` → `npx cap add android` →
  `AndroidManifest.xml`에 `screenOrientation="portrait"` 추가 → `npx cap sync` → `./gradlew assembleDebug` 성공
  - 환경 참고: `ANDROID_HOME`은 사용자 환경변수로 정상 등록되어 있었으나(`%LOCALAPPDATA%\Android\Sdk`),
    이번 세션의 셸 프로세스가 VSCode 재시작 이전에 뜬 상태라 `$env:ANDROID_HOME`이 비어 있어 명령마다 직접 export 함.
    새 터미널을 열면 정상 인식될 것으로 예상 — 이후 세션에서 재확인 필요.
  - JAVA_HOME은 Android Studio 번들 JBR(OpenJDK 21, `C:\Program Files\Android\Android Studio\jbr`) 사용
- 다음 확인 필요: 인앱 결제 플러그인 선택(B), Stage 11.2.2(Android Studio에서 `npx cap open android` 확인)/11.2.3(CORS)/11.2.4(뒤로가기)

---

## ❓ 사용자 확인이 필요한 사항

- appId (`com.mediadiary.app`) 확정 — 변경 불가
- ~~인앱 결제 플러그인 선택~~ — `capacitor-plugin-cdv-purchase`로 확정, 설치 완료 (2026-07-30)
- ~~DB 마이그레이션 (payment_history 확장)~~ — 완료 (2026-07-30)
- Render CORS_ORIGINS 업데이트
- Google 서비스 계정 JSON 등록 (여전히 대기 — 11.3.1 Play Console 상품 등록과 함께 필요)
- [사용자 작업] Play Console 상품 3종 등록 (11.3.1)
- 앱 아이콘/스크린샷/설명문 시안
- 키스토어 생성 및 백업
- Play Console의 개인 계정 테스트 요건 확인 결과

---

## 💰 비용 참고

- Google Play 등록비: $25 (완료)
- 인앱 결제 수수료: 15% (연 매출 $1M 이하)
- 웹 토스 결제: 3.3% (심사 후)
- → 앱 내에서 웹 결제 유도 문구는 정책 위반이므로 금지
