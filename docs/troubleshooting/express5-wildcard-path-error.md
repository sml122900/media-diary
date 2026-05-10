# Express 5 에서 `router.get('*', ...)` 사용 시 서버 시작 실패

## 문제 상황

TMDB API 프록시 라우터를 신설하면서 `router.get('*', handler)` 패턴을 사용했다.
서버 시작 시 아래 에러 발생 후 즉시 크래시.

```
PathError [TypeError]: Missing parameter name at index 1: *;
    at Object.<anonymous> (backend/src/routes/tmdb.js:17:8)
```

## 시도한 것들

1. `router.get('/*', ...)` — 동일 에러
2. `router.get('/tmdb/*', ...)` — 동일 에러

## 최종 해결법

**원인**: Express 5는 내부적으로 `path-to-regexp` v8을 사용하는데, 이 버전은 unnamed wildcard `*`를 허용하지 않는다. Express 4에서는 동작하던 패턴이 5에서 Breaking Change됨.

**해결**: 정규식을 직접 사용.

```js
// Express 5에서 모든 경로 매칭
router.get(/(.*)/, async (req, res) => {
  const path = req.path;  // 여전히 마운트 기준 상대 경로 반환
  ...
});
```

**대안**: named wildcard 사용도 가능.
```js
router.get('/:path(*)', ...);  // Express 5 지원 형태
```

## 이력서 소재 한 줄

Express 4 → 5 마이그레이션 과정에서 path-to-regexp Breaking Change로 인한 와일드카드 라우트 크래시를 정규식 패턴으로 대응함.
