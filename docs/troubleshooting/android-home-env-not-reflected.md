# ANDROID_HOME 환경변수가 VSCode 재시작 후에도 세션에 반영되지 않음

## 문제 상황

Capacitor Android 셋업(Stage 11.2.1)을 진행하려면 `ANDROID_HOME`(SDK 경로)과 `java`(Gradle 실행용 JDK)가 필요했다.
사용자가 Windows 사용자 환경변수에 `ANDROID_HOME`을 등록하고 VSCode를 재시작했다고 알려왔지만,
Claude Code 세션에서 새로 띄운 셸 프로세스는 여전히 `$env:ANDROID_HOME`이 빈 값이었고 `java` 명령도 인식하지 못했다.

## 시도한 것들

1. PowerShell에서 `$env:ANDROID_HOME` 직접 확인 → 빈 값
2. Git Bash에서 `$ANDROID_HOME` 확인 → 빈 값
3. `[Environment]::GetEnvironmentVariable("ANDROID_HOME","User")`로 레지스트리 값 직접 조회 → **정상 값 반환** (`C:\Users\sm553\AppData\Local\Android\Sdk`)
4. 같은 방식으로 Machine 레벨도 확인 → 미등록 (User 레벨에만 있음, 정상)
5. 새 PowerShell 프로세스의 `StartTime`을 확인 → 방금 새로 시작된 프로세스인데도 값이 없음

## 최종 해결법 (임시 우회)

**원인**: 레지스트리 값은 정상이지만, VSCode 창 재시작만으로는 Claude Code 세션을 구동하는 상위 프로세스(터미널 호스트)의 환경변수 스냅샷이 갱신되지 않았다. Windows는 새 프로세스를 만들 때 보통 부모 프로세스의 환경 블록을 상속하는데, 그 부모 프로세스 자체가 레지스트리 값이 갱신되기 이전에 떠 있었던 것으로 보인다.

**우회책**: 셸 명령마다 명시적으로 export.
```bash
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"  # Android Studio 번들 JDK 21
```

이 방식으로 `npx cap add android`, `./gradlew assembleDebug` 모두 정상 동작을 확인했다.

## 남은 이슈

- 근본 원인(상위 프로세스가 갱신 전 환경을 물고 있는 문제)은 해결되지 않음 — Windows 재부팅 또는 세션을 완전히 새로 시작해야 확인 가능
- 이후 세션에서 `$env:ANDROID_HOME`이 정상적으로 뜨는지 재확인 필요

## 이력서 소재 한 줄

Windows 환경에서 사용자 환경변수 갱신이 실행 중인 프로세스에 반영되지 않는 문제를 레지스트리 직접 조회로 원인 분리하고, 빌드 명령마다 명시적 export로 우회해 Capacitor Android 빌드 파이프라인을 막힘 없이 진행함.
