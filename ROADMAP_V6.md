# 미디어 다이어리 — Phase 10 로드맵 (UX 대수술 & AI 채팅화)

> Claude Code가 자동으로 참고하며 작업하는 로드맵입니다.
> Phase 9 (토큰 결제 시스템) 다음 단계 작업입니다.
> 작성일: 2026-05-14

---

## 📌 작업 원칙

- Stage 단위로 순차 진행 (10.1 → 10.2 → ...)
- 작업 완료 시 체크박스 [x] 처리 + 진행 로그 기록
- 큰 변경은 git commit (`feat:`, `fix:`, `refactor:` prefix)
- 모든 코드에 한국어 주석
- DB 마이그레이션은 SQL 보여주고 승인 받기
- 사용자 시각 확인이 필요한 항목은 체크리스트로 정리
- AI 비용 증가 작업(이미지 인식 Sonnet 업그레이드)은 사전 안내

---

## 🎯 이 Phase의 본질

**"실제로 써보니 어색했던 것들을 한 번에 정리"**

Phase 1~9로 기능은 충분히 쌓였지만, 일부 UX가 "있긴 한데 잘 안 써짐" 상태.
이번 Phase는 6가지 사용 마찰점을 일괄 정리하고, AI 활용 방식을 단발 검색 → 대화형으로 전환.

---

## 🗂 작업 순서

**1단계 — 빠른 개선 (약 5일)**
- 10.1 연말 결산 포스터 이미지 깨짐 수정
- 10.2 다크모드 토글 통합
- 10.3 이미지 인식 정확도 강화 (Sonnet 업그레이드)
- 10.4 (예약) AI 채팅형 추천은 Phase 10.6에서

**2단계 — 큰 변화 (약 7일)**
- 10.5 미디어 추천 페이지 분리 (`/discover`)
- 10.6 AI 채팅형 추천 (`/discover/chat`)
- 10.7 리포트 커스터마이징 (체크박스 + AI 채팅)

---

## Stage 10.1 — 연말 결산 포스터 깨짐 수정 (빠른 개선)

> 0.5~1일 작업 예상

### 10.1.1 원인 진단

- [x] **현재 동작 확인**
  - 원인 1: 브라우저 CORS 캐시 오염 — 앱 내 다른 컴포넌트가 crossOrigin 없이 같은 TMDB URL 캐싱
  - 원인 2: 이미지 로드 완료 전 html2canvas 호출 (타이밍 이슈)

- [x] **가능한 원인 점검** — 해결: 백엔드 프록시 + 이미지 사전 로딩

### 10.1.2 백엔드 이미지 프록시 추가

- [x] **`GET /api/proxy/poster`**
  - 쿼리: `?url=https://image.tmdb.org/t/p/w500/abc.jpg`
  - TMDB URL만 허용 (다른 도메인 차단 — SSRF 방지)
  - 응답: 이미지 바이너리 + 적절한 Cache-Control 헤더
  - 1주일 캐시 (Render는 영속 디스크 없으니 메모리 LRU 캐시 또는 그냥 매번 프록시)

```javascript
// 예시 코드
app.get('/api/proxy/poster', async (req, res) => {
  const { url } = req.query;
  if (!url.startsWith('https://image.tmdb.org/')) {
    return res.status(400).json({ error: 'Invalid URL' });
  }
  const response = await fetch(url);
  res.set('Cache-Control', 'public, max-age=604800');
  res.set('Content-Type', response.headers.get('content-type'));
  response.body.pipe(res);
});
```

### 10.1.3 프론트엔드 적용

- [x] **연말 결산 페이지에서만 프록시 URL 사용**
  - 일반 표시 시: 원본 TMDB URL (빠름)
  - 캡처 시: 프록시 URL로 교체 후 캡처
  - 또는 처음부터 모두 프록시 (캐싱되니까 거의 차이 없음)

- [x] **html2canvas 옵션 조정**
  ```javascript
  html2canvas(element, {
    useCORS: true,
    allowTaint: false,
    logging: false,
    scale: 2,  // 고해상도
  });
  ```

- [x] **이미지 사전 로딩 보장**
  ```javascript
  await Promise.all(
    Array.from(element.querySelectorAll('img')).map(img => 
      img.complete ? Promise.resolve() : new Promise((resolve) => {
        img.onload = resolve;
        img.onerror = resolve;  // 실패해도 진행
      })
    )
  );
  ```

### 사용자 확인 체크리스트

- [ ] /year-in-review/2026 페이지에서 모든 포스터 정상 표시
- [ ] "이미지 저장" 클릭 시 PNG에 포스터 포함됨 (X박스 X)
- [ ] 모바일에서도 동일하게 동작
- [ ] 다운로드 속도가 너무 느리지 않은지

---

## Stage 10.2 — 다크모드 토글 통합

> 0.5~1일 작업 예상

### 10.2.1 모든 페이지의 토글 버튼 제거

- [x] **삭제 대상 페이지/컴포넌트**
  - HomePage, /stats, /reports, /settings, /lists, /feed, /compare, /watchlists, /wishlist, /restore 등
  - 각 페이지 우상단 "다크/라이트" 토글 버튼 제거
  - 단, `useTheme` 훅 호출은 유지 (테마 값을 받기 위해)

### 10.2.2 /settings 페이지에 단일 설정 추가

- [x] **설정 UI 추가**
  ```
  화면 모드
  ○ 시스템 설정 따르기 (자동)
  ○ 라이트 모드
  ● 다크 모드
  ```

- [x] **저장 방식**
  - 로컬: `localStorage.theme = 'auto' | 'light' | 'dark'`
  - 서버: `users.theme_preference` 컬럼 추가 (선택)

### 10.2.3 자동 모드 (시스템 따르기) 구현

- [x] **useTheme 훅 수정**
  ```javascript
  function useTheme() {
    const [theme, setTheme] = useState(() => {
      const saved = localStorage.getItem('theme') || 'auto';
      if (saved === 'auto') {
        return window.matchMedia('(prefers-color-scheme: dark)').matches 
          ? 'dark' : 'light';
      }
      return saved;
    });
    
    // 시스템 설정 변경 감지 (auto 모드일 때만)
    useEffect(() => {
      const saved = localStorage.getItem('theme');
      if (saved !== 'auto') return;
      
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = (e) => setTheme(e.matches ? 'dark' : 'light');
      mq.addEventListener('change', handler);
      return () => mq.removeEventListener('change', handler);
    }, []);
    
    return { theme, setTheme };
  }
  ```

### 사용자 확인 체크리스트

- [ ] 모든 페이지에서 다크/라이트 토글 버튼 사라짐
- [ ] /settings에서 3개 옵션 라디오 버튼 표시
- [ ] "시스템 설정 따르기" 선택 후 OS 모드 변경 시 자동 반영
- [ ] "라이트/다크" 명시 선택 시 OS와 무관하게 유지
- [ ] 새로고침 후에도 설정 유지
- [ ] 모바일에서 정상 동작

---

## Stage 10.3 — 이미지 인식 정확도 강화 (Sonnet 업그레이드)

> 1일 작업 예상

### 10.3.1 모델 변경

- [x] **현재 모델 확인**
  - 스크린샷 인식 API에서 사용 중인 모델 확인
  - 아마도 `claude-haiku-4-5-20251001` 또는 유사

- [x] **Sonnet으로 교체**
  - `claude-sonnet-4-6` 또는 최신 Sonnet 사용
  - 정확도 약 60% → 85% 향상 기대

### 10.3.2 토큰 비용 조정

- [x] **사용자 토큰 소모량 변경**
  - 현재: 스크린샷 1장 = 3토큰 (₩30)
  - 변경: 스크린샷 1장 = 5토큰 (₩50)
  - Sonnet 비용 증가분 반영

- [x] **변경 안내 UI**
  - 스크린샷 업로드 페이지에 비용 명시
  - "이미지당 5토큰 차감"

### 10.3.3 프롬프트 최적화 (Sonnet 활용)

- [x] **OTT별 프롬프트 강화**
  - Sonnet은 더 긴 문맥 처리 가능 → 각 OTT 특화 설명 추가
  - 예: 넷플릭스는 시청 기록 카드 그리드, 왓챠는 리스트 등

- [x] **출력 포맷 엄격화**
  ```
  반드시 다음 JSON 형식으로만 응답:
  {
    "extracted": [
      {
        "title": "정확한 작품명",
        "year": 2024,
        "type": "movie" | "tv",
        "confidence": 0.0~1.0
      }
    ]
  }
  ```

- [x] **잘못된 추출 패턴 명시**
  - "메뉴, 광고, 사용자 인터페이스 요소는 제외"
  - "시즌/회차 번호는 제거하고 작품명만"
  - "영문/한글 제목 모두 처리 가능하면 한글 우선"

### 10.3.4 이미지 전처리 (선택)

- [ ] **이미지 크기 최적화**
  - 너무 큰 이미지는 Sonnet에 보내기 전 압축 (Sharp 라이브러리)
  - 가로 1500px 정도로 리사이즈 (텍스트 가독성 유지)
  - 토큰 비용 절감

### 사용자 확인 체크리스트

- [ ] 넷플릭스 시청 기록 스크린샷 정확도 85%+ 매칭
- [ ] 왓챠/티빙/CGV/메가박스 등 다양한 OTT 정확도 향상 체감
- [ ] 토큰 소모 5토큰으로 정확히 차감
- [ ] 비용 안내 UI 표시
- [ ] 처리 시간이 너무 길어지지 않는지 (Sonnet은 Haiku보다 약간 느림)

---

## Stage 10.4 — 추천 페이지 분리

> 2일 작업 예상

### 10.4.1 홈 화면에서 "오늘의 추천" 위젯 제거

- [ ] **HomePage.jsx에서 DailyRecommendations 컴포넌트 제거**
- [ ] **대신 진입 버튼 추가**
  - "🎬 영화 추천받기" 버튼
  - 클릭 시 /discover로 이동

### 10.4.2 /discover 페이지 신설

- [ ] **새 라우트 추가** — `/discover`

- [ ] **페이지 구조**
  ```
  🎬 발견하기
  
  [AI에게 추천받기]  ← 큰 버튼, /discover/chat으로 이동
  
  ─── 또는 카테고리별로 ───
  
  📊 내 취향 기반 추천
  ← 기존 daily_recommendations 활용
  ← 추천 이유 명시: "당신이 좋아한 [작품]과 비슷해서"
  
  ✨ 안 본 명작
  ← IMDb TOP 250 중 미시청 작품
  ← 점차 추가 (지금은 큐레이션 활용)
  
  📺 OTT 신작 중 내 취향
  ← TMDB 신작 + 취향 매칭 (선택, 향후)
  ```

### 10.4.3 추천 카드 강화

- [ ] **추천 이유 명시**
  - 각 추천 작품 카드 하단에 "왜 추천?"
  - 예: "당신이 ★5 준 인터스텔라와 같은 SF 장르"

- [ ] **상호작용**
  - 작품 클릭 → 상세 모달
  - "관심 없음" 버튼 → 다시는 안 보임 (선택)
  - "위시리스트에 추가" 빠른 버튼

### 사용자 확인 체크리스트

- [ ] 홈에서 추천 위젯이 사라지고 "발견하기" 진입 버튼 표시
- [ ] /discover 페이지 정상 진입
- [ ] AI 채팅 버튼 (Stage 10.5에서 활성화)
- [ ] 카테고리별 추천 표시
- [ ] 각 추천 작품에 이유 명시
- [ ] 모바일 반응형

---

## Stage 10.5 — AI 채팅형 추천 (/discover/chat)

> 3-4일 작업 예상

### 10.5.1 데이터 모델

- [ ] **`discovery_chats` 테이블 신설**
  ```sql
  CREATE TABLE discovery_chats (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL,                  -- 'user' | 'assistant'
    content TEXT NOT NULL,
    suggested_works JSONB,               -- AI가 제안한 작품 목록
    session_id TEXT,                     -- 같은 대화 세션 묶기
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  
  CREATE INDEX idx_discovery_chats_user_session 
    ON discovery_chats(user_id, session_id, created_at);
  ```

- [ ] **memory_chats와 분리**
  - 기억 복원(/restore/chat)과 추천(/discover/chat)은 다른 의도
  - 별도 테이블로 분리해 분석 + 컨텍스트 관리 명확

### 10.5.2 백엔드 API

- [ ] **POST /api/discover/chat**
  - 요청: `{ message, sessionId? }`
  - 처리:
    1. 사용자 메시지 저장
    2. 같은 sessionId의 이전 대화 조회 (최근 10개)
    3. 사용자 취향 프로필 + 이미 본 작품 조회
    4. Claude API 호출 (tool use)
    5. AI 응답 + 추천 작품 저장
    6. 응답 반환

- [ ] **시스템 프롬프트 설계**
  ```
  당신은 사용자의 영화/드라마/애니메이션 취향을 파악해서
  완벽한 다음 작품을 추천하는 큐레이터입니다.
  
  단계적으로 좁혀나가세요:
  1. 사용자의 기분/상황 파악
  2. 좋아하는 장르/감독/배우 확인
  3. 길이/언어/시대 등 세부 조건
  4. 점진적으로 후보 좁히기
  
  반드시 다음 단계 질문을 제시하세요.
  사용자가 이미 본 작품은 추천하지 마세요.
  
  도구:
  - search_tmdb: 작품 검색
  - get_user_history: 사용자가 본 작품 확인
  ```

- [ ] **GET /api/discover/chat/sessions**
  - 사용자의 이전 대화 세션 목록

- [ ] **POST /api/discover/chat/sessions/new**
  - 새 대화 시작 (sessionId 발급)

- [ ] **GET /api/discover/chat/history?sessionId=**
  - 특정 세션 대화 이력

- [ ] **POST /api/discover/chat/add-to-watchlist**
  - AI가 추천한 작품을 위시리스트에 추가

### 10.5.3 프론트엔드

- [ ] **`/discover/chat` 라우트**

- [ ] **DiscoveryChat 컴포넌트**
  - 메신저 스타일 UI (기존 MemoryChat 참고)
  - 좌측: 이전 대화 세션 목록 (사이드바)
  - 중앙: 채팅 영역
  - 하단: 입력창

- [ ] **추천 카드 임베드**
  - AI 메시지 안에 작품 카드 그리드
  - 각 카드에 "위시리스트 추가" / "이미 봤어요" / "관심 없음" 버튼

- [ ] **예시 시작 질문 (빈 화면일 때)**
  ```
  "오랜만에 SF 영화 보고 싶어"
  "비 오는 날 어울리는 영화 추천해줘"
  "잔잔한 일본 영화 좋아해"
  "최근 본 [영화] 같은 거 더 없어?"
  ```

- [ ] **토큰 비용 안내**
  - AI 추천 채팅 1회 = 2토큰 (기억 복원 채팅과 동일)
  - 헤더 토큰 잔액 표시 연동

### 사용자 확인 체크리스트

- [ ] /discover/chat 접속 정상
- [ ] 빈 화면에 예시 질문 4개 표시
- [ ] 메시지 전송 → 로딩 → 응답
- [ ] AI 응답에 다음 단계 질문 포함
- [ ] 추천 작품 카드 표시
- [ ] "위시리스트 추가" 버튼 작동
- [ ] 같은 세션에서 대화 컨텍스트 유지
- [ ] 새 대화 시작 가능
- [ ] 이전 세션 목록 표시
- [ ] 토큰 정상 차감
- [ ] 모바일에서 자연스러운 UX

---

## Stage 10.6 — 리포트 커스터마이징

> 3-4일 작업 예상

### 10.6.1 데이터 모델

- [ ] **`report_templates` 테이블 신설**
  ```sql
  CREATE TABLE report_templates (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,                  -- '내 기본 리포트'
    components JSONB NOT NULL,           -- 선택된 항목 배열
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );
  ```

- [ ] **리포트 항목 정의 (코드 상수)**
  ```javascript
  const REPORT_COMPONENTS = {
    'basic_count': {
      name: '이번 달 본 작품 수',
      description: '총 감상 작품과 카테고리별 분류',
    },
    'avg_rating': {
      name: '평균 별점',
      description: '이번 달 평균 별점과 전월 대비 변화',
    },
    'top_genres': {
      name: '가장 자주 본 장르 TOP 3',
      description: '장르별 시청 비율',
    },
    'top_directors': {
      name: '가장 자주 본 감독',
      description: '감독별 시청 작품 수',
    },
    'best_of_month': {
      name: '이번 달의 인생작 후보',
      description: '★5 작품 중 인상 깊은 한 편',
    },
    'yoy_change': {
      name: '작년 같은 달 대비 변화',
      description: '시청 패턴 변화 분석',
    },
    'avg_year': {
      name: '본 작품의 평균 연도',
      description: '클래식 vs 최신작 선호도',
    },
    'longest_watch': {
      name: '가장 긴 시청 시간 작품',
      description: '런타임 기준 TOP 3',
    },
    'memorable_review': {
      name: '가장 인상 깊은 한 줄 평',
      description: '이번 달 가장 길게 쓴 리뷰',
    },
    'new_genre': {
      name: '새로 시도한 장르',
      description: '이전엔 안 봤던 장르 발견',
    },
    'watch_patterns': {
      name: '시청 패턴 분석',
      description: '요일별, 시간대별 분포',
    },
    'mood_stats': {
      name: '무드 통계',
      description: '시청 시 무드 분포 (즐거운/슬픈/감동적 등)',
    },
    'context_stats': {
      name: '시청 컨텍스트 분석',
      description: '혼자/누구와 시청 비율',
    },
    'rewatch_stats': {
      name: '재시청 통계',
      description: '이번 달 다시 본 작품들'
    },
    'rating_distribution': {
      name: '별점 분포',
      description: '★1~5 분포와 평균'
    },
  };
  ```

### 10.6.2 백엔드 API

- [ ] **GET /api/reports/components**
  - 사용 가능한 리포트 항목 목록 + 설명

- [ ] **GET /api/reports/templates**
  - 사용자의 저장된 템플릿 목록

- [ ] **POST /api/reports/templates**
  - 새 템플릿 저장
  - 요청: `{ name, components: ['basic_count', 'top_genres', ...] }`

- [ ] **PUT /api/reports/templates/:id**
  - 템플릿 수정

- [ ] **DELETE /api/reports/templates/:id**
  - 템플릿 삭제

- [ ] **POST /api/me/reports/generate** (기존 API 개선)
  - 요청에 templateId 옵션 추가
  - templateId 있으면 해당 템플릿 항목으로 리포트 생성
  - 없으면 기본 항목

- [ ] **POST /api/reports/customize-chat** (AI 채팅)
  - 사용자 자연어 입력으로 항목 추천
  - 예: "장르 변화에 집중한 리포트" → ['new_genre', 'top_genres', 'yoy_change']
  - Claude API로 항목 매핑

### 10.6.3 프론트엔드

- [ ] **/reports 페이지 개선**
  - 상단: "내 템플릿 선택" 드롭다운 + "새 템플릿 만들기" 버튼
  - 중앙: 선택된 템플릿으로 리포트 생성/조회
  - 하단: 월별 저장된 리포트 목록

- [ ] **/reports/customize 페이지 신설**
  - 16개+ 리포트 항목 체크박스 그리드
  - 각 항목에 설명 표시
  - "미리보기" 버튼 → 선택한 항목으로 임시 리포트 생성
  - "템플릿 저장" 버튼

- [ ] **AI 채팅 옵션**
  - /reports/customize 페이지에 "AI와 채팅으로 만들기" 버튼
  - 모달 또는 별도 페이지에서 AI 대화
  - 예: "장르 변화에 집중한 리포트로"
  - AI가 항목 추천 → 사용자 확인 → 템플릿 저장

### 사용자 확인 체크리스트

- [ ] /reports/components API에서 16개+ 항목 반환
- [ ] /reports/customize 페이지에서 체크박스로 항목 선택
- [ ] 선택 후 리포트 미리보기 정상
- [ ] 템플릿 저장 / 수정 / 삭제 작동
- [ ] AI 채팅으로 항목 자동 선택 기능
- [ ] /reports 페이지에서 템플릿 선택 후 생성
- [ ] 모바일 반응형

---

## 🔧 기술 부채

### Phase 9 연계 사항

- [ ] **AI 추천 채팅도 토큰 차감**
  - 채팅 1회 = 2토큰 (기억 복원과 동일)
  - 미들웨어 `requireTokens(2, 'discover_chat')` 적용

- [ ] **리포트 커스터마이징 채팅도 토큰 차감**
  - 채팅 1회 = 2토큰

- [ ] **이미지 인식 토큰 5토큰으로 조정**
  - 기존 미들웨어 설정값 변경
  - 사용자에게 안내

### HomePage 슬림화

- [ ] **위젯 정리 결과 점검**
  - 추천 위젯 제거 후 홈 화면 균형 확인
  - 빈 공간이 어색하면 다른 위젯 강조 (이번 달 통계 등)

---

## 📝 진행 로그

작업할 때마다 아래에 기록:

<!-- 새 작업은 이 아래에 추가 -->

### 2026-05-14 — Stage 10.1 + 10.2 + 10.3 완료

**Stage 10.1 (연말 결산 포스터 X박스 수정)**
- 원인: 브라우저 CORS 캐시 오염 (앱 전역 img가 crossOrigin 없이 TMDB URL 캐싱)
- GET /api/proxy/poster?url= 프록시 추가 (TMDB URL만 허용, SSRF 방지, 1주일 캐시)
- YearInReviewPage: proxyPoster() 헬퍼로 이미지 URL 변환
- handleSaveImage: Promise.all로 이미지 로드 완료 대기 후 html2canvas 호출
- html2canvas 옵션: allowTaint:false, logging:false 추가

**Stage 10.2 (다크모드 토글 통합)**
- useTheme 훅: auto/light/dark 3옵션 지원, 시스템 변경 감지 추가
- 8개 페이지에서 다크/라이트 토글 버튼 제거 (Stats/Reports/Lists/Feed/Compare/Watchlists/Wishlist/Settings)
- HomePage 메뉴: 토글 버튼 → "⚙ 화면 모드 설정" 링크로 교체
- SettingsPage: 라디오 버튼 3개 (시스템 따르기 / 라이트 / 다크) UI 추가

**Stage 10.3 (Sonnet 업그레이드)**
- importScreenshot.js: claude-haiku-4-5-20251001 → claude-sonnet-4-6
- 토큰 소모: 3 → 5토큰 (requireTokens 업데이트)
- screenshotPrompts.js: 전문가형 프롬프트로 강화 (제외 항목 명시, 제목 정제 규칙 추가)
- ScreenshotImportModal: 5토큰 비용 안내 UI 추가

---

## 🎯 다음 작업

**현재 시작점: Stage 10.1 — 연말 결산 포스터 깨짐 수정**

순서:
1. 10.1 연말 결산 이미지 수정 (0.5~1일)
2. 10.2 다크모드 통합 (0.5~1일)
3. 10.3 이미지 인식 Sonnet 업그레이드 (1일)
4. 10.4 추천 페이지 분리 (2일)
5. 10.5 AI 채팅 추천 (3-4일)
6. 10.6 리포트 커스터마이징 (3-4일)

총 약 2주.

---

## ❓ 사용자 확인이 필요한 사항

다음 경우 멈추고 사용자에게 물어보기:

- DB 마이그레이션 실행
- Sonnet 모델 업그레이드 시 비용 안내
- 토큰 가격 조정 (스크린샷 3 → 5)
- 새 라이브러리 도입 (Sharp 등)
- UI 디자인 방향성 (시각적 결정)

---

## 💰 비용 영향

### 10.3 Sonnet 업그레이드
- Claude API 비용 약 3배 증가 (스크린샷 1장당)
- 사용자 토큰 가격 3 → 5로 조정해 마진 유지

### 10.5 AI 채팅 추천 추가
- 새 기능 추가 → AI 호출 빈도 증가 예상
- 채팅 1회 = 2토큰 차감으로 비용 회수

### 10.6 리포트 커스터마이징
- 항목 많을수록 Claude API 입력 토큰 증가
- 기본 리포트는 기존과 동일 가격 유지

### 종합
- 전체 마진율 유지 가능
- 사용자에게 명시적 안내 필요 (스크린샷 가격 변경)

---

## 📐 디자인 가이드

기존 디자인 시스템 준수.

### 새로운 패턴

- **/discover 페이지** — 큰 진입 버튼 + 카테고리 그리드
- **/discover/chat** — 좌측 세션 사이드바 + 채팅 영역
- **/reports/customize** — 체크박스 그리드 + AI 채팅 옵션
- **/settings 다크모드** — 라디오 버튼 3개 (auto/light/dark)

### 이미지 프록시

- 사용자에게는 보이지 않음 (백그라운드 처리)
- 캐싱 헤더로 성능 보장
