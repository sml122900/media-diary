# React StrictMode에서 비동기 루프가 1건 후 중단되는 문제

## 문제 상황

`useEffect` 안에서 비동기 루프를 돌며 API를 순차 호출하는 코드를 작성했다.
개발 환경에서 실행하면 첫 항목 1건만 처리하고 루프가 멈췄다.

```javascript
useEffect(() => {
  let cancelled = false;
  (async () => {
    for (const item of toSync) {
      if (cancelled) break; // ← 여기서 멈춤
      await fetchAndUpdate(item);
    }
  })();
  return () => { cancelled = true; }; // ← 이게 범인
}, [items]);
```

## 시도한 것들

1. `toSync` 배열이 비어있는지 확인 → 178건 정상
2. API 호출 자체가 실패하는지 확인 → 첫 건은 성공
3. `items` 의존성이 변해서 재실행되는지 확인 → 아님

## 최종 해결법

**원인**: React StrictMode는 개발 환경에서 effect를 `mount → unmount → mount` 순서로 **두 번** 실행한다.
첫 번째 실행의 cleanup(`cancelled = true`)이 루프를 멈추고, 두 번째 실행은 ref 플래그에 막혀 시작도 못 한다.

**해결**: cleanup 함수를 제거하고, `useRef` 플래그로 재실행만 차단.

```javascript
const syncedRef = useRef(false);

useEffect(() => {
  if (syncedRef.current) return;
  syncedRef.current = true; // 동기적으로 즉시 설정 → 2차 실행 차단

  (async () => {
    for (const item of toSync) {
      await fetchAndUpdate(item); // cancelled 체크 없음
    }
  })();
  // cleanup 없음 — StrictMode의 cleanup이 루프를 중단시키는 것을 방지
}, [items]);
```

**주의**: cleanup 제거는 "이 effect는 한 번만 실행되어야 하고, 컴포넌트 언마운트 시 중단해도 되는 작업"에만 적용한다.

## 이력서 소재 한 줄

React StrictMode의 이중 effect 실행 원리를 파악하고 비동기 루프 중단 버그를 ref 플래그 패턴으로 해결함.
