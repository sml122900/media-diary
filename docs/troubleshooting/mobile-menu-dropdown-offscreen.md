# 모바일에서 메뉴 항목 첫 글자 잘림 + 메인 위에 백드롭 없이 겹침

## 문제 상황

실기기(갤럭시 세로) 스크린샷으로 다음 증상이 보고됐다.

- 헤더 `≡ 메뉴`로 여는 메뉴가 메인 화면과 겹쳐 보임
- 메뉴가 열려도 배경(메인 콘텐츠)이 가려지지 않음
- 텍스트 왼쪽이 잘림 — "발견하기"→"견하기", "과거 기록 복원"→"록 복원"
- 우하단에 정체불명 ⚡ 플로팅 아이콘

보고에 담긴 원인 추정은 "메뉴가 화면 안에 밀어넣어지면서 메인 레이아웃을 밀어버리는(push) 방식이라
좁은 화면에서 깨진다"였다.

## 시도한 것들

1. **`≡ 메뉴` 버튼과 메뉴 컴포넌트 위치 확인** — 별도 사이드바 컴포넌트는 존재하지 않았고,
   `HomePage.jsx` 헤더 안의 `.menu-wrap > .menu-dropdown` 드롭다운 하나가 전부였다.

2. **로컬 재현 환경 구성** — 프론트(5173)·백엔드(4000)를 띄우고 Chromium 뷰포트를 390×844로
   설정. `PrivateRoute` 때문에 인증이 필요해, 백엔드 `JWT_SECRET`으로 개발용 JWT를 발급해
   `localStorage`에 주입하고 홈 화면에 진입했다 (카드 222건 로드 확인).

3. **스크린샷 대신 `getBoundingClientRect()` 실측** — 스크린샷 렌더가 타일링되어 판독이 어려워
   DOM 측정으로 전환. 이것이 결정적이었다.

   ```
   .menu-dropdown → left: -6, right: 154, width: 160, height: 999  (뷰포트 390×844)
   .menu-item     → left: -5   ("발"이 화면 밖)
   .mdb-title     → left: 16   (메뉴 열기 전후 동일)
   ```

4. **추정 검증 → 반증** — `.mdb-title`의 left가 메뉴 열기 전후 모두 16px이었다.
   **메인은 밀리지 않았다.** 잘린 텍스트도 메인 콘텐츠가 아니라 메뉴 항목 자신의 텍스트였다.
   push 레이아웃 문제라는 최초 추정은 틀렸다.

5. **⚡ 아이콘 정체 확인** — `grep`으로 추적해 Phase 5.5의 빠른 입력 FAB(`.fab-btn`)임을 확인.
   768px 이하에서만 노출되고 탭하면 `QuickInputModal`이 열린다. 의도된 기능이라 유지.

## 최종 해결법

**원인 (두 가지 독립적)**

1. **좌측 잘림** — `.menu-dropdown { position: absolute; right: 0; min-width: 180px }`.
   좁은 화면에서 `.mdb-controls`가 flex-wrap되며 `≡ 메뉴` 버튼이 화면 왼쪽 근처로 내려가는데,
   정렬 기준이 버튼의 **우측 끝**이라 드롭다운이 왼쪽으로 160px 뻗으며 뷰포트를 −6px 이탈했다.
2. **겹침** — 높이 999px가 뷰포트(844px)를 넘기는데 백드롭이 없어 메인 위에 그대로 얹혔다.

**해결** — `@media (max-width: 600px)`에서만 오버레이 드로어로 전환. 데스크톱 경로는 무변경.

```css
@media (max-width: 600px) {
  .menu-backdrop {
    display: block; position: fixed; inset: 0;
    background: rgba(0,0,0,.45); z-index: 1400;
  }
  .menu-dropdown {
    position: fixed; top: 0; right: 0; bottom: 0; left: auto;
    width: min(78vw, 300px); border-radius: 0; z-index: 1500;
    overflow-y: auto;
    padding: calc(env(safe-area-inset-top, 0px) + 12px) 0
             calc(env(safe-area-inset-bottom, 0px) + 16px);
    animation: menu-drawer-in .18s ease;
  }
}
```

```jsx
{menuOpen && <div className="menu-backdrop" onClick={closeMenu} />}
```

`position: fixed`로 바꾸면서 드로어가 뷰포트 기준으로 배치되므로, flex-wrap이 버튼을 어디로 보내든
위치가 흔들리지 않는다 — 근본 원인 자체가 제거됐다. 백드롭은 `.menu-wrap` 내부에 렌더해
기존 `menuRef` 외부 클릭 감지와 충돌하지 않게 했고, 항목 선택 시 닫힘은 기존 `closeMenu`가 이미 처리 중이었다.

## 검증

| 항목 | 결과 |
|---|---|
| 390px 드로어 | left 75 / right 375 — 전부 화면 안 |
| 360px(갤럭시) 드로어 | left 64 / right 345, 내부 스크롤 동작 |
| 메뉴 항목 잘림 | 없음 (`📚 과거 기록 복원` 온전) |
| 메인 밀림 | 없음 (title left 16 유지) |
| 백드롭 | `display: block`, 375×844 전체 덮음, 탭 시 닫힘 |
| 데스크톱 1280px | `absolute`, w180, 버튼 우측 정렬, 백드롭 `display: none` — 기존과 동일 |

실기기(갤럭시)에 APK를 설치해 사용자가 직접 최종 확인했다.

## 이력서 소재 한 줄

모바일 메뉴 레이아웃 깨짐을 스크린샷 대신 `getBoundingClientRect()` 실측으로 진단해 최초 원인 추정
(메인을 밀어내는 push 레이아웃)을 반증하고, 실제 원인(오른쪽 정렬 드롭다운의 뷰포트 −6px 이탈 + 백드롭 부재)을
특정해 미디어쿼리 한 블록으로 해결하면서 데스크톱 레이아웃 회귀를 0으로 유지함.
