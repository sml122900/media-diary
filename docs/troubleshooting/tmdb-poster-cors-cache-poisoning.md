# 수식어 카드에서 TMDB 포스터가 전부 텍스트 타일로 폴백 — CORS 미지원이 아니라 브라우저 캐시 오염

## 문제 상황

Phase 13.2 카드 렌더러(`epithetCard.js`)와 선택 UI를 완성한 뒤 브라우저에서 실제로
3개/6개 카드를 생성해보니 포스터가 **하나도 뜨지 않고 전부 텍스트 타일**로 나왔다.
TMDB 포스터가 있는 항목(기생충·인터스텔라·위플래시·센과 치히로)까지 예외 없이 폴백된
게 이상했다 — 매칭 실패나 URL 오류라면 일부만 실패해야 한다.

스펙에는 "TMDB(image.tmdb.org)는 crossOrigin="anonymous"로 canvas 사용 가능"이라는
전제가 있었다. 이 전제 자체를 의심하는 데서 진단을 시작했다.

## 시도한 것들

### 1. crossOrigin 로드를 직접 재현

```js
const img = new Image();
img.crossOrigin = 'anonymous';
img.onload = () => resolve({ ok: true });
img.onerror = () => resolve({ ok: false, error: 'onerror fired' });
img.src = 'https://image.tmdb.org/t/p/w300/....jpg';
```

→ `onerror` 발생. "TMDB가 CORS를 지원하지 않는다"는 가설을 세웠다.

### 2. fetch로 더 구체적인 에러 확인

```js
await fetch(url, { mode: 'cors' })
```

→ `TypeError: Failed to fetch`. 브라우저 CORS 단계에서 막힌다는 것까지는 확인했지만
서버가 헤더를 안 주는지, 다른 문제인지는 아직 몰랐다.

### 3. 네트워크 자체가 막힌 건 아닌지 배제

```js
await fetch('https://media-diary-api.onrender.com/api/health', { mode: 'cors' })
```

→ 정상 200. 일반적인 외부 네트워크 접근은 문제없었다 — TMDB만의 문제였다.

### 4. no-cors 모드로 서버가 실제로 응답하는지 확인

```js
await fetch(url, { mode: 'no-cors' })
```

→ `{ ok: false, status: 0, type: 'opaque' }`. **opaque는 서버가 응답을 줬다는 뜻**이다.
CORS 헤더 유무와 무관하게 요청 자체는 도달하고 있었다.

### 5. crossOrigin 없이 같은 URL 로드

```js
const img = new Image(); // crossOrigin 미설정
img.src = url;
```

→ 성공. 실제로 그 순간 카드 그리드 화면에도 이 포스터가 정상적으로 떠 있었다.
**서버는 응답하고 있고(4), plain 로드는 성공하는데(5), crossOrigin만 실패한다(1,2)** —
모순이었다.

### 6. curl로 실제 응답 헤더 직접 확인

```bash
curl -sI "https://image.tmdb.org/t/p/w300/....jpg" -H "Origin: http://localhost:5173"
```

```
Access-Control-Allow-Origin: *
Access-Control-Expose-Headers: *
```

**TMDB는 CORS를 정상 지원한다.** 스펙의 전제는 맞았다 — 다만 브라우저 쪽에 다른 문제가
있다는 뜻이었다.

### 7. 캐시 오염 가설과 재현

이 프로젝트에는 선례가 있다 — 2026-05-14 Year in Review PNG 저장 때도 "같은 URL이 plain
`<img>`로 먼저 로드된 뒤 crossOrigin 요청이 그 캐시를 재사용해 실패하는" 증상이 있었고,
당시엔 백엔드 이미지 프록시로 우회했다(`docs/decisions/log-archive.md` 2026-05-14 항목).
같은 클래스의 버그라고 보고 재현 테스트를 설계했다.

```js
// 이 브라우저에서 한 번도 요청한 적 없는 URL + 캐시버스터
img.src = 'https://image.tmdb.org/t/p/w300/....jpg?cachebust=' + Date.now();
img.crossOrigin = 'anonymous';
```

→ **성공.** 그리고 캐시버스터 없이 **이미 plain 로드로 캐시된 동일 URL**을 다시
crossOrigin으로 요청하면 → **실패**, 100% 재현됐다. 원인이 확정됐다: 같은 URL을 먼저
crossOrigin 없이 로드하면, 브라우저가 이후의 crossOrigin 요청에도 그 캐시(오염된
상태로 기록된 리소스)를 재사용해 서버 재검증 없이 실패시킨다. 실사용에서는 사용자가
카드를 만들기 전 그리드에서 포스터를 먼저 보는 게 사실상 항상 일어나므로, 이 버그는
예외적 케이스가 아니라 **거의 매번 재현되는 기본 경로**였다.

## 최종 해결법

`crossOrigin="anonymous"`로 로드할 때만 URL에 캐시 키를 분리하는 더미 쿼리 파라미터를
붙였다.

```js
img.src = url + (url.includes('?') ? '&' : '?') + '_cors=1';
```

2026-05-14와 달리 백엔드 프록시는 다시 만들지 않았다 — 서버는 이미 CORS를 지원하므로
서버를 한 번 더 거칠 이유가 없었고, 클라이언트 한 줄로 충분했다(선택 배경은
[`docs/decisions/canvas-card-render-no-proxy.md`](../decisions/canvas-card-render-no-proxy.md) 참고).
수정 후 3개/6개 선택 카드 모두 실제 포스터가 정상 렌더링되는 것을 스크린샷으로 재확인했다.

## 이력서 소재 한 줄

> "외부 API가 CORS를 지원하지 않는다"는 표면적 증상 뒤에 실제로는 브라우저가 동일 URL의
> non-CORS 캐시를 CORS 요청에도 재사용하는 문제가 있음을 curl 헤더 검증과 캐시버스터
> 재현 테스트로 규명하고, 프로젝트에 이미 있던 동일 증상의 과거 해법(백엔드 프록시)을
> 그대로 재사용하는 대신 이번 기능 제약에 맞는 더 가벼운 클라이언트 측 캐시 키 분리로
> 해결했다.
