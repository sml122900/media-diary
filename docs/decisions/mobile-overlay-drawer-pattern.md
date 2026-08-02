# 기술 결정 — 모바일 메뉴를 오버레이 드로어로 분기 (데스크톱 드롭다운 유지)

## Problem (상황/문제)

> 실기기(갤럭시 세로) 스크린샷에서 헤더 `≡ 메뉴`를 열면 메뉴 항목의 첫 글자가 잘리고
> ("발견하기"→"견하기", "과거 기록 복원"→"록 복원") 메인 콘텐츠 위에 배경 처리 없이 겹쳐 보였다.
>
> 기존 구현은 데스크톱 기준의 `position: absolute` 드롭다운 하나로 전 해상도를 처리하고 있었다.
>
> ```css
> .menu-dropdown { position: absolute; top: calc(100% + 6px); right: 0; min-width: 180px; }
> ```
>
> 390px 뷰포트에서 실측한 값:
>
> ```
> .menu-dropdown → left: -6, right: 154, width: 160, height: 999
> .menu-item     → left: -5   (첫 글자가 뷰포트 밖)
> ```
>
> 원인은 두 가지였다. 첫째, `.mdb-controls`가 좁은 화면에서 flex-wrap되며 `≡ 메뉴` 버튼이
> 화면 왼쪽 근처로 내려가는데, 정렬 기준이 버튼의 **우측 끝**이라 드롭다운이 왼쪽으로 160px 뻗으며
> 뷰포트를 이탈했다. 둘째, 높이 999px가 뷰포트(844px)를 넘기는데 백드롭이 없어 메인 위에 그냥 얹혔다.

## Action (결정 및 근거)

> 최초 증상 보고는 "메뉴가 메인을 밀어내는(push) 방식이라 레이아웃이 깨진다"는 추정이었으나,
> 실측 결과 **메인은 밀리지 않았다** — `.mdb-title`의 left는 메뉴 열기 전후 모두 16px로 동일했다.
> 잘린 텍스트도 메인 콘텐츠가 아니라 **메뉴 항목 자신의 텍스트**였다. 즉 push 레이아웃 문제가 아니라
> **오른쪽 정렬 드롭다운의 뷰포트 이탈 + 백드롭 부재**였다. 추정을 그대로 받아 사이드바 구조를
> 새로 짜는 대신, 실측으로 원인을 좁힌 뒤 최소 변경으로 해결하는 방향을 택했다.
>
> 선택지는 두 가지였다:
>
> 1. **드롭다운 위치만 보정** — `right: 0`을 유지하되 뷰포트를 벗어나지 않도록 clamp
> 2. **모바일만 오버레이 드로어로 분기** — `@media (max-width: 600px)`에서 `position: fixed` 드로어 + 백드롭
>
> 1번은 잘림은 막지만 백드롭 부재(메인 위에 겹쳐 보이는 문제)는 그대로 남고, 버튼 위치가
> flex-wrap 결과에 따라 달라지므로 해상도마다 재발 가능성이 있었다. 2번을 택했다.
>
> ```css
> @media (max-width: 600px) {
>   .menu-backdrop {
>     display: block; position: fixed; inset: 0;
>     background: rgba(0,0,0,.45); z-index: 1400;
>   }
>   .menu-dropdown {
>     position: fixed; top: 0; right: 0; bottom: 0; left: auto;
>     width: min(78vw, 300px); border-radius: 0; z-index: 1500;
>     overflow-y: auto;
>     padding: calc(env(safe-area-inset-top, 0px) + 12px) 0
>              calc(env(safe-area-inset-bottom, 0px) + 16px);
>     animation: menu-drawer-in .18s ease;
>   }
> }
> ```
>
> 설계상 지킨 원칙:
> - **데스크톱 경로 무변경** — 모든 신규 규칙을 미디어쿼리 안에 넣어 601px 이상은 기존 CSS를 그대로 탄다.
>   `.menu-backdrop`은 기본값 `display: none`이라 데스크톱에서는 DOM에 있어도 렌더되지 않는다.
> - **`position: fixed`로 버튼 위치 의존성 제거** — 드로어가 뷰포트 기준으로 배치되므로
>   flex-wrap이 버튼을 어디로 보내든 위치가 흔들리지 않는다. 근본 원인을 제거한 셈이다.
> - **백드롭을 `.menu-wrap` 내부에 렌더** — 기존 `menuRef` 외부 클릭 감지 로직과 충돌하지 않게 하고,
>   백드롭 자체에 `onClick={closeMenu}`를 달아 탭하면 닫히도록 했다.
> - **safe-area 패딩** — 노치/제스처 바 영역에 항목이 가리지 않도록 `env(safe-area-inset-*)` 적용.
>
> JSX 변경은 한 줄이다:
>
> ```jsx
> {menuOpen && <div className="menu-backdrop" onClick={closeMenu} />}
> ```

## Result (결과)

> 390px / 360px(갤럭시) 양쪽에서 실측 검증했다.
>
> | 항목 | 수정 전 | 수정 후 |
> |---|---|---|
> | 드로어 위치 (390px) | left −6 / right 154 (이탈) | left 75 / right 375 |
> | 드로어 위치 (360px) | — | left 64 / right 345 |
> | 메뉴 항목 잘림 | 첫 글자 잘림 | 없음 |
> | 백드롭 | 없음 | 375×844 전체 덮음, 탭 시 닫힘 |
> | 메인 밀림 | 없음(오해) | 없음 (title left 16 유지) |
> | 데스크톱 1280px | absolute / w180 / 백드롭 none | **동일** |
>
> 실기기(갤럭시)에 APK를 설치해 사용자가 직접 동작을 확인했다.
>
> 부수 효과로 항목이 많아 999px까지 늘어난 메뉴가 드로어 내부 스크롤로 처리되어,
> 향후 메뉴 항목이 더 늘어도 화면을 넘치지 않는다.

**교훈**: 증상 보고에 담긴 원인 추정("메인을 밀어낸다")을 그대로 전제로 삼지 말고, 먼저 실측해서
무엇이 실제로 어긋났는지 좁혀야 한다. 이번 건은 실측 한 번으로 "레이아웃 구조 재작성"이
"미디어쿼리 한 블록 추가"로 줄었고, 데스크톱 회귀 위험도 함께 제거됐다.
