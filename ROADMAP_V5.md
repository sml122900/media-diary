# 미디어 다이어리 — Phase 9 로드맵 (AI 토큰 결제 시스템)

> 이 문서는 Claude Code가 자동으로 참고하며 작업하는 로드맵입니다.
> Phase 8 다음 단계 작업입니다.
> 작성일: 2026-05-14

---

## 📌 작업 원칙

- Stage 단위로 순차 진행 (9.1 → 9.2 → 9.3 → ...)
- 각 작업 완료 시 체크박스 [x] 처리 및 이 문서 업데이트
- 한 Stage가 완전히 끝나야 다음 Stage로 진행
- 큰 변경사항은 git commit (`feat:`, `fix:`, `refactor:` prefix)
- 모든 코드에 한국어 주석 포함
- **결제 관련 작업은 신중하게**. 실제 돈이 오가므로 테스트 환경에서 충분히 검증 후 운영 전환
- DB 마이그레이션은 실행 전 SQL을 사용자에게 보여주고 승인받기

---

## 🎯 이 Phase의 본질

**"AI 비용 부담 없이 운영 가능한 구조 만들기"**

구독 모델 없이 단순 토큰 시스템:
- 신규 가입 시 무료 토큰 50개 지급
- AI 기능 사용 시 토큰 차감
- 토큰 소진 시 결제로 추가 충전
- 토스페이먼츠 단건 결제 (정기결제 X)

---

## 📋 가격 및 정책 결정사항

### 무료 지급
- 신규 가입 시 **50토큰** (1회성)
- 자동으로 users.token_balance = 50으로 시작

### 토큰 패키지
| 패키지 | 가격 | 토큰 | 비고 |
|--------|------|------|------|
| 소형 | ₩1,000 | 100토큰 | 기본 |
| 중형 | ₩3,000 | 350토큰 | +50 보너스 |
| 대형 | ₩10,000 | 1,300토큰 | +300 보너스 |

### AI 기능별 토큰 소모
| 기능 | 토큰 | 실제 Claude 비용 |
|------|------|---------------|
| AI 대화 (기억 복원) | 2토큰 | ~₩20 |
| 스크린샷 인식 | 3토큰 | ~₩30 |
| 자연어 검색 | 1토큰 | ~₩10 |
| 월간 리포트 | 5토큰 | ~₩50 |
| 비슷한 작품 추천 | 무료 (캐싱) | - |
| 오늘의 추천 | 무료 (1일 1회 캐싱) | - |

### 첫 충전 보너스
- 첫 결제 시 +20% 토큰 추가 (1회만, 모든 패키지 공통)

### 환불 정책
- 결제 후 7일 이내 미사용분 환불
- 일부 사용 시 → 사용한 토큰만큼 차감하고 환불
- 환불 처리는 수동 (관리자가 토스 환불 API 호출)

---

## Stage 9.1 — DB 마이그레이션

> 토큰 잔액, 결제 이력, 사용 로그 테이블 추가
> 1일 작업 예상

### 9.1.1 users 테이블 확장

- [x] **마이그레이션 SQL 작성**

```sql
-- 토큰 잔액 컬럼 추가
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS token_balance INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS has_used_first_charge_bonus BOOLEAN DEFAULT FALSE;

-- 기존 사용자에게 50토큰 지급
UPDATE users 
SET token_balance = 50 
WHERE token_balance IS NULL OR token_balance = 0;
```

### 9.1.2 신규 테이블 — payment_history

```sql
CREATE TABLE payment_history (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_krw INTEGER NOT NULL,           -- 결제 금액 (원)
  tokens_added INTEGER NOT NULL,         -- 충전된 토큰 (보너스 포함)
  base_tokens INTEGER NOT NULL,          -- 기본 토큰 (보너스 제외)
  bonus_tokens INTEGER DEFAULT 0,        -- 보너스 토큰
  package_type TEXT NOT NULL,            -- 'small' | 'medium' | 'large'
  payment_method TEXT,                   -- 'card', 'kakaopay', 'tosspay' 등
  toss_payment_key TEXT UNIQUE NOT NULL, -- 토스페이먼츠 결제 키
  toss_order_id TEXT UNIQUE NOT NULL,    -- 주문 ID
  status TEXT NOT NULL DEFAULT 'pending',-- 'pending' | 'success' | 'failed' | 'refunded'
  refunded_at TIMESTAMPTZ,
  refund_amount_krw INTEGER DEFAULT 0,
  refund_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_payment_history_user ON payment_history(user_id);
CREATE INDEX idx_payment_history_order ON payment_history(toss_order_id);
```

### 9.1.3 신규 테이블 — token_usage_log

```sql
CREATE TABLE token_usage_log (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,                 -- 'chat' | 'screenshot' | 'search' | 'report'
  tokens_used INTEGER NOT NULL,
  claude_input_tokens INTEGER,
  claude_output_tokens INTEGER,
  claude_cost_usd DECIMAL(10,4),         -- 실제 비용 추적용
  metadata JSONB,                        -- 추가 정보 (어떤 채팅이었는지 등)
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_token_usage_user_date ON token_usage_log(user_id, created_at);
CREATE INDEX idx_token_usage_feature ON token_usage_log(feature);
```

### 9.1.4 RLS 정책

```sql
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_log ENABLE ROW LEVEL SECURITY;
```

### 사용자 확인 체크리스트

- [x] Supabase에서 컬럼/테이블 추가 확인
- [x] 기존 사용자에게 50토큰 지급됐는지 확인
- [x] RLS 활성화 확인

---

## Stage 9.2 — 토큰 차감 미들웨어

> AI 기능 호출 전 자동 차감 + 사용 로그 기록
> 2일 작업 예상

### 9.2.1 미들웨어 작성

- [x] **`backend/src/middleware/tokenCheck.js`**

```javascript
/**
 * AI 기능 사용 전 토큰 잔액 확인 및 차감
 * @param {number} requiredTokens 필요한 토큰 수
 * @param {string} feature 기능 식별자 ('chat' | 'screenshot' | 'search' | 'report')
 */
function requireTokens(requiredTokens, feature) {
  return async (req, res, next) => {
    const userId = req.user.id;
    
    // 1. 토큰 잔액 조회
    const { rows } = await pool.query(
      'SELECT token_balance FROM users WHERE id = $1',
      [userId]
    );
    
    const balance = rows[0]?.token_balance || 0;
    
    // 2. 잔액 부족 시 차단
    if (balance < requiredTokens) {
      return res.status(402).json({
        success: false,
        error: 'INSUFFICIENT_TOKENS',
        message: '토큰이 부족합니다',
        required: requiredTokens,
        balance: balance,
        shortBy: requiredTokens - balance
      });
    }
    
    // 3. req에 정보 저장 (실제 차감은 AI 호출 성공 후)
    req.tokenInfo = {
      required: requiredTokens,
      feature: feature,
      balance: balance
    };
    
    next();
  };
}

/**
 * AI 호출 성공 후 토큰 차감 + 로그 기록
 */
async function deductTokens(userId, tokenInfo, claudeUsage = {}) {
  await pool.query('BEGIN');
  
  try {
    // 토큰 차감
    await pool.query(
      'UPDATE users SET token_balance = token_balance - $1 WHERE id = $2',
      [tokenInfo.required, userId]
    );
    
    // 사용 로그
    await pool.query(`
      INSERT INTO token_usage_log 
        (user_id, feature, tokens_used, claude_input_tokens, 
         claude_output_tokens, claude_cost_usd, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      userId,
      tokenInfo.feature,
      tokenInfo.required,
      claudeUsage.input_tokens || null,
      claudeUsage.output_tokens || null,
      claudeUsage.cost_usd || null,
      claudeUsage.metadata || {}
    ]);
    
    await pool.query('COMMIT');
  } catch (err) {
    await pool.query('ROLLBACK');
    throw err;
  }
}

module.exports = { requireTokens, deductTokens };
```

### 9.2.2 기존 AI 라우트에 미들웨어 적용

- [x] **POST /api/restore/chat** — `requireTokens(2, 'chat')`
- [x] **POST /api/import/screenshot** — `requireTokens(3, 'screenshot')`
- [x] **POST /api/search/natural** — `requireTokens(1, 'search')`
- [x] **POST /api/me/reports/generate** — `requireTokens(5, 'report')`

각 라우트에서:
1. 미들웨어 통과 → AI 호출
2. AI 호출 성공 → `deductTokens()` 호출
3. AI 호출 실패 → 차감 안 함 (사용자 보호)

### 9.2.3 사용자 잔액 조회 API

- [x] **GET /api/me/tokens**
  ```json
  {
    "balance": 48,
    "has_used_first_charge_bonus": false,
    "today_usage": {
      "chat": 1,
      "screenshot": 0,
      "search": 0,
      "report": 0
    },
    "month_usage": {
      "total_tokens": 24,
      "total_cost_estimate": 480
    }
  }
  ```

### 9.2.4 기존 Phase 6/7의 한도 시스템 제거

- [x] **메모리 채팅의 일일 30회 한도 제거**
  - 토큰 시스템으로 대체
  - users.daily_chat_count 컬럼은 유지 (통계용) 또는 제거

- [x] **스크린샷 일일 20장 한도 제거**
  - 토큰 시스템으로 대체

### 사용자 확인 체크리스트

- [ ] 미들웨어 통합 후 채팅/스크린샷/검색/리포트 정상 동작
- [ ] 토큰 부족 시 402 응답 정상
- [ ] 토큰 차감이 정확한지
- [ ] AI 호출 실패 시 토큰 차감 안 되는지 (중요!)
- [ ] 잔액 조회 API 정상

---

## Stage 9.3 — 토스페이먼츠 백엔드 통합

> 결제 요청, 승인, Webhook 처리
> 2-3일 작업 예상

### 사전 준비

- [ ] **환경변수 추가**
  - `TOSS_CLIENT_KEY` (프론트엔드용, 결제창 호출)
  - `TOSS_SECRET_KEY` (백엔드용, 결제 승인)
  - `TOSS_WEBHOOK_SECRET` (Webhook 검증용)

- [ ] **토스페이먼츠 SDK 설치 (Node.js)**
  - 공식 SDK가 없으므로 axios로 직접 REST API 호출
  - 또는 `@tosspayments/payment-sdk` (프론트엔드용)

### 9.3.1 결제 요청 API

- [ ] **POST /api/billing/checkout**
  - 요청: `{ packageType: 'small' | 'medium' | 'large' }`
  - 동작:
    1. 패키지별 가격/토큰 계산
    2. 첫 충전 보너스 여부 확인
    3. order_id 생성 (UUID + 사용자 ID 조합)
    4. payment_history에 pending 상태로 저장
    5. 응답: `{ orderId, orderName, amount, customerKey }`

```javascript
// 패키지 정의
const PACKAGES = {
  small:  { amount: 1000,  base_tokens: 100,  bonus: 0   },
  medium: { amount: 3000,  base_tokens: 350,  bonus: 50  },
  large:  { amount: 10000, base_tokens: 1300, bonus: 300 }
};

// 첫 충전 시 추가 20% 보너스
if (!user.has_used_first_charge_bonus) {
  bonus_tokens += Math.floor(base_tokens * 0.2);
}
```

### 9.3.2 결제 승인 API

- [ ] **POST /api/billing/confirm**
  - 요청: `{ paymentKey, orderId, amount }` (프론트에서 결제창 통과 후 호출)
  - 동작:
    1. payment_history에서 order_id 조회 (pending 상태 확인)
    2. 토스페이먼츠 결제 승인 API 호출
       - `POST https://api.tosspayments.com/v1/payments/confirm`
       - Authorization: Basic base64(secret_key:)
    3. 응답 검증 (amount 일치 확인)
    4. payment_history 상태 'success'로 업데이트
    5. users.token_balance 증가
    6. 첫 충전 보너스 사용했으면 has_used_first_charge_bonus = true
    7. 응답: `{ success: true, addedTokens, newBalance }`

### 9.3.3 Webhook 처리

- [ ] **POST /api/billing/webhook**
  - 토스페이먼츠에서 결제 상태 변경 시 자동 호출
  - 검증: 토스가 보낸 서명 확인
  - 처리: 결제 상태 동기화 (이중 안전장치)

### 9.3.4 결제 이력 API

- [ ] **GET /api/billing/history**
  - 내 결제 이력 (최근 50건)
  - 응답: 배열 of `{ id, package_type, amount, tokens, status, created_at }`

- [ ] **GET /api/billing/history/:id**
  - 특정 결제 상세

### 9.3.5 환불 API (관리자용)

- [ ] **POST /api/billing/refund/:paymentId** (관리자 전용)
  - 동작:
    1. payment_history 조회
    2. 사용한 토큰 계산 (충전 후 차감된 토큰)
    3. 환불 가능 금액 계산
    4. 토스페이먼츠 환불 API 호출
    5. users.token_balance 차감 (환불된 만큼)
    6. payment_history 상태 'refunded'로 업데이트

### 사용자 확인 체크리스트

- [ ] 결제 요청 → orderId 생성 정상
- [ ] 결제 승인 후 토큰 정상 충전
- [ ] 첫 충전 시 +20% 보너스 적용
- [ ] 두 번째 충전부터 보너스 없음
- [ ] Webhook 수신 정상
- [ ] 결제 이력 조회 정상

---

## Stage 9.4 — 프론트엔드 결제 UI

> 토스페이먼츠 SDK 연동 + 결제 흐름
> 2일 작업 예상

### 9.4.1 토스페이먼츠 SDK 설치

```bash
npm install @tosspayments/payment-sdk
```

### 9.4.2 결제 페이지 (/billing/charge)

- [ ] **3개 패키지 카드 UI**
  - 소형 (₩1,000 / 100토큰)
  - 중형 (₩3,000 / 350토큰) — "+50 보너스" 배지
  - 대형 (₩10,000 / 1,300토큰) — "+300 보너스 / 가장 인기" 배지

- [ ] **첫 충전 시 +20% 보너스 안내**
  - 첫 충전 사용자에게는 각 패키지 위에 "+20% 보너스" 표시
  - 예상 받을 토큰 계산해서 표시

- [ ] **결제 흐름**
  - 패키지 선택 → 결제 정보 확인 모달
  - "결제하기" 클릭 → 백엔드 POST /api/billing/checkout → orderId 받음
  - 토스 결제창 호출:
    ```javascript
    const tossPayments = await loadTossPayments(CLIENT_KEY);
    tossPayments.requestPayment('카드', {
      amount: 1000,
      orderId: orderId,
      orderName: '미디어 다이어리 100토큰',
      successUrl: `${window.location.origin}/billing/success`,
      failUrl: `${window.location.origin}/billing/fail`,
    });
    ```

### 9.4.3 결제 성공/실패 페이지

- [ ] **/billing/success**
  - URL query에서 paymentKey, orderId, amount 추출
  - 백엔드 POST /api/billing/confirm 호출
  - 성공 시: "충전 완료! XX 토큰이 추가됐어요" + 잔액 표시
  - 실패 시: 안내 메시지

- [ ] **/billing/fail**
  - 결제 실패 안내
  - "다시 시도" 버튼

### 9.4.4 결제 이력 페이지 (/billing/history)

- [ ] 결제 이력 목록 표시
- [ ] 각 항목: 날짜, 패키지, 금액, 충전된 토큰, 상태
- [ ] 환불 신청 버튼 (이메일로 문의 안내 — 자동 환불은 안 함)

### 9.4.5 토큰 잔액 표시

- [ ] **헤더에 토큰 잔액 표시**
  - 우상단 "🪙 48토큰" 같은 형식
  - 클릭 시 /billing/charge로 이동

- [ ] **AI 기능 호출 후 잔액 자동 업데이트**

### 9.4.6 토큰 부족 모달

- [ ] AI 기능 호출 시 402 응답 받으면 모달 노출
- [ ] "토큰이 부족해요" 메시지
- [ ] 현재 잔액 / 필요 토큰 표시
- [ ] [충전하기] [취소] 버튼

### 사용자 확인 체크리스트

- [ ] /billing/charge 페이지 디자인
- [ ] 패키지 선택 후 토스 결제창 정상 호출
- [ ] 결제 후 success 페이지로 리다이렉트
- [ ] 토큰 정상 충전 확인
- [ ] 헤더 잔액 실시간 업데이트
- [ ] 토큰 부족 시 모달 노출
- [ ] 모바일에서 결제 흐름 정상

---

## Stage 9.5 — 환불 정책 페이지 + 약관

> 법적 요구사항
> 0.5일 작업 예상

### 9.5.1 환불 정책 페이지

- [ ] **/policy/refund**
  - 환불 가능 조건
  - 환불 요청 방법 (이메일)
  - 처리 기간

### 9.5.2 이용약관

- [ ] **/policy/terms**
  - 서비스 이용 약관
  - 결제 관련 조항
  - 사용자 책임

### 9.5.3 개인정보처리방침

- [ ] **/policy/privacy**
  - 수집 정보
  - 이용 목적
  - 보관 기간

### 9.5.4 결제 페이지에 약관 동의 체크박스

- [ ] 결제 진행 전 동의 필수
  - [ ] 이용약관 동의
  - [ ] 환불 정책 동의

### 사용자 확인 체크리스트

- [ ] 3개 정책 페이지 접근 가능
- [ ] 결제 전 약관 동의 흐름
- [ ] 헤더/푸터에 정책 링크

---

## Stage 9.6 — 사용량 통계 대시보드

> 비용 모니터링용
> 1일 작업 예상

### 9.6.1 사용량 통계 API

- [ ] **GET /api/me/usage-stats**
  - 응답:
    ```json
    {
      "current_balance": 48,
      "total_charged": 100,
      "total_used": 52,
      "by_feature": {
        "chat": 30,
        "screenshot": 15,
        "search": 5,
        "report": 2
      },
      "monthly_breakdown": [
        { "month": "2026-05", "tokens_used": 52, "cost_estimate_krw": 520 }
      ]
    }
    ```

### 9.6.2 사용량 페이지 (/billing/usage)

- [ ] **시각화**
  - 잔액 큰 숫자
  - 누적 충전 / 사용 비교
  - 기능별 사용량 도넛 차트
  - 월별 사용 추이 바 차트

- [ ] **결제 이력 링크**

### 9.6.3 관리자 대시보드 (선택)

- [ ] **/admin/billing** (개발자만)
  - 전체 매출
  - 전체 Claude API 비용
  - 마진 표시
  - 가장 활발한 사용자 TOP 10

### 사용자 확인 체크리스트

- [ ] 사용량 페이지 표시 정상
- [ ] 차트 데이터 정확
- [ ] 모바일 반응형

---

## Stage 9.7 — 테스트 및 검증

> 실제 결제 전 충분히 검증
> 2-3일 작업 예상

### 9.7.1 테스트 환경 검증

토스페이먼츠 테스트 환경에서:
- [ ] 모든 패키지 결제 성공 시나리오
- [ ] 결제 실패 시나리오 (카드 거부 등)
- [ ] 결제 도중 취소
- [ ] 동일 orderId 중복 결제 방지
- [ ] Webhook 수신 + 처리
- [ ] 첫 충전 보너스 1회만 적용 확인
- [ ] 결제 후 토큰 정확히 충전
- [ ] AI 기능 호출 → 토큰 차감 정확성
- [ ] 토큰 부족 시 차단 + 모달
- [ ] 결제 실패 시 토큰 미충전

### 9.7.2 보안 검증

- [ ] 결제 금액 위변조 방지 (서버 사이드 검증)
- [ ] 다른 사용자 토큰으로 결제 불가
- [ ] Webhook 서명 검증
- [ ] 결제 키 노출 방지 (프론트는 client_key만)

### 9.7.3 운영 환경 전환

- [ ] 테스트 키 → 운영 키 교체
- [ ] Render/Vercel 환경변수 업데이트
- [ ] 실제 결제 1회 테스트 (자기 카드)
- [ ] 환불 처리 1회 테스트

### 9.7.4 모니터링 설정

- [ ] 일일 매출 + Claude API 비용 추적
- [ ] 결제 실패 알림
- [ ] 이상 패턴 감지 (다량 결제 등)

---

## 🔧 기술 부채

### 사업자 등록 필요

- [ ] **홈택스 사업자 등록**
  - 개인사업자 / 통신판매업
  - 부가세 면세사업자로 시작 (연 매출 8천만원 이하)
  - 약 5-10분 소요, 무료

- [ ] **통신판매업 신고**
  - 구청 또는 인터넷 신고
  - 결제 받으려면 필수

### 토스페이먼츠 정식 계약

- [ ] **상점 정보 등록**
  - 사업자 등록증 업로드
  - 정산 계좌 등록

- [ ] **상점 심사 완료 후 운영 키 발급**

---

## 📝 진행 로그

작업할 때마다 아래에 기록:

<!-- 새 작업은 이 아래에 추가 -->

### 2026-05-14 — Stage 9.1 + 9.2 완료

**Stage 9.1 (DB 마이그레이션)**
- users 테이블: token_balance (DEFAULT 50), has_used_first_charge_bonus 컬럼 추가
- payment_history, token_usage_log 테이블 신규 생성
- RLS 활성화
- 수정 사항: user_id UUID → INTEGER (users.id가 SERIAL), toss_payment_key NOT NULL 제거 (pending 상태 허용)

**Stage 9.2 (토큰 차감 미들웨어)**
- backend/src/middleware/tokenCheck.js 신규 (requireTokens, deductTokens)
- restore.js: 일일 30회 한도 제거 → requireTokens(2, 'chat') 적용
- importScreenshot.js: 일일 20회 한도 제거 → requireTokens(3, 'screenshot') 적용
- search.js: 일일 20회 한도 제거 → requireTokens(1, 'search') 적용
- reports.js: requireTokens(5, 'report') 적용
- GET /api/me/tokens 신규 (잔액 + 오늘/이달 사용량)

---

## 🎯 다음 작업

**현재 시작점: Stage 9.1 — DB 마이그레이션**

순서:
1. Stage 9.1 — DB 컬럼/테이블 추가
2. Stage 9.2 — 토큰 차감 미들웨어
3. Stage 9.3 — 토스페이먼츠 백엔드
4. Stage 9.4 — 프론트엔드 결제 UI
5. Stage 9.5 — 약관/정책
6. Stage 9.6 — 사용량 대시보드
7. Stage 9.7 — 테스트 + 검증

---

## ❓ 사용자 확인이 필요한 사항

다음 경우 멈추고 사용자에게 물어보기:

- DB 마이그레이션 실행
- 토스페이먼츠 API 키 입력
- 약관 텍스트 작성 (법적 자문 필요 가능)
- 운영 환경 전환 (실제 결제 시작)
- 환불 처리 (수동 처리 필요)

---

## 💰 비용 영향

### 운영 비용 예상 (월 100명 활성 사용자 기준)
- Claude API: ~₩50,000
- 토스페이먼츠 수수료: 3.3% × 매출
- Render/Vercel: ₩0 (무료 플랜)
- Supabase: ₩0 (무료 플랜)

### 예상 매출 (월 100명 중 20% 결제 시)
- 평균 결제: ₩3,000 × 20명 = ₩60,000
- 결제 수수료 제외: ~₩58,000
- 순이익: ~₩8,000 (적자 → 흑자 전환점)

### 손익 분기점
- 약 50명 정도가 월 ₩3,000 충전하면 손익분기

---

## 📐 디자인 가이드

기존 디자인 시스템 준수:
- 토큰 잔액 표시: 🪙 이모지 + 숫자
- 결제 페이지: 카드 그리드 (3개 패키지)
- 보너스 강조: 노란색 배지
- 결제 성공: 초록 아이콘
- 결제 실패: 빨강 아이콘

새로운 패턴:
- **토스페이먼츠 결제창** — 외부 스크립트로 호출
- **토큰 부족 모달** — 차단 + 충전 유도
