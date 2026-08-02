# adb install 실패 — `INSTALL_FAILED_UPDATE_INCOMPATIBLE` (debug keystore 소실)

## 문제 상황

APK 빌드에 성공한 뒤 실기기에 설치하려는데 실패했다.

```
Performing Streamed Install
adb.exe: failed to install app-debug.apk:
  Failure [INSTALL_FAILED_UPDATE_INCOMPATIBLE: Existing package com.mediadiary.app
  signatures do not match newer version; ignoring!]
```

`-r`(reinstall) 플래그를 이미 준 상태였는데도 거부됐다. Android는 서명 키가 다른 APK로는
기존 앱을 덮어쓰지 못하게 막는다.

선행 이슈로 기기가 `unauthorized` 상태여서 폰에서 USB 디버깅을 허용받는 단계도 있었다
(허용 후 약 80초 만에 `device` 상태로 전환).

## 시도한 것들

1. **`adb kill-server` / `start-server` 재시작** — 인증 프롬프트를 다시 띄우는 데는 유효했지만
   서명 문제와는 무관했다.

2. **폰에 설치된 앱 정보 조회**

   ```
   adb shell dumpsys package com.mediadiary.app
   → versionName=1.0.0, versionCode=1
     firstInstallTime=2026-07-31 00:54:00
     installerPackageName=null      ← Play 스토어가 아닌 adb 사이드로드
   ```

3. **새 APK의 서명자 확인**

   ```
   apksigner verify --print-certs app-debug.apk
   → Signer #1 certificate DN: C=US, O=Android, CN=Android Debug
   ```

   표준 debug 인증서였다. 그렇다면 7/31 설치본도 debug keystore로 서명됐을 텐데 왜 다른가?

4. **로컬 debug keystore의 타임스탬프 확인** — 이것이 결정적이었다.

   ```
   -rw-r--r-- 2618 Aug  2 22:56 /c/Users/이성민/.android/debug.keystore
   ```

   mtime이 **오늘 빌드 시각과 정확히 일치**했다. Gradle은 `~/.android/debug.keystore`가 없으면
   자동으로 새로 만든다. 즉 7/31 설치본을 서명했던 원래 keystore는 이미 사라진 상태였고,
   오늘 빌드가 **새 keystore를 생성**하면서 서명이 달라진 것이다.

## 최종 해결법

**원인**: 7/31 설치본을 서명한 `~/.android/debug.keystore` 소실 → 오늘 빌드에서 Gradle이 새 keystore 자동 생성
→ 서명 불일치로 덮어쓰기 업데이트 거부.

원래 keystore가 없으므로 in-place 업데이트는 불가능하다. 유일한 방법은 기존 앱 제거 후 재설치다.
앱 삭제는 되돌릴 수 없는 작업이라 사용자 승인을 받고 진행했다.

```
adb uninstall com.mediadiary.app   → Success
adb install -r app-debug.apk       → Success

확인: com.mediadiary.app 1.0.0, lastUpdateTime 2026-08-02 23:01:57
```

**데이터 영향**: 로컬에 저장되는 것은 `localStorage`의 로그인 토큰과 화면모드 설정 정도이고,
감상 기록·별점·리뷰는 전부 Supabase에 있으므로 재로그인하면 그대로 복구된다.
사전에 이 범위를 명시하고 승인을 받았다.

## 재발 방지

- **debug keystore 백업** — 이 keystore가 또 사라지면 동일한 사고가 반복된다.
  파일 하나(2.6KB)이므로 백업 비용이 사실상 없다.
- **릴리스 keystore는 훨씬 중요** — Stage 11.4에서 생성 시 클라우드+로컬 이중 백업 예정.
  릴리스 keystore를 분실하면 Play Store에 올린 앱의 **업데이트가 영구히 불가능**해진다
  (Play App Signing 미사용 시). debug와 달리 "지우고 다시 깔면 되는" 복구 경로가 없다.

## 이력서 소재 한 줄

APK 설치 실패(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`)를 keystore 파일의 mtime이 빌드 시각과 일치한다는
단서로 "Gradle이 소실된 debug keystore를 자동 재생성했다"까지 특정하고, 데이터 소실 범위(서버 보존 vs 로컬 세션)를
사전 확인·승인 후 제거·재설치로 해결하면서 릴리스 keystore 이중 백업 정책을 수립함.
