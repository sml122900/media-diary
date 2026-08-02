# gradlew assembleDebug 실패 — `invalid source release: 21`

## 문제 상황

모바일 메뉴 수정을 실기기에 반영하려고 APK를 빌드하는데 컴파일 단계에서 실패했다.

```
> Task :capacitor-android:compileDebugJavaWithJavac FAILED

FAILURE: Build failed with an exception.
* What went wrong:
Execution failed for task ':capacitor-android:compileDebugJavaWithJavac'.
> Java compilation initialization error
    error: invalid source release: 21

BUILD FAILED in 1m 19s
```

혼란스러웠던 점은 **2026-07-20 Stage 11.2.1에서 같은 명령이 성공했다**는 기록이 CLAUDE.md에 있다는 것이었다.
그 사이 Android 관련 코드는 건드리지 않았고, 이번 변경은 CSS·JSX뿐이었다.

## 시도한 것들

1. **`JAVA_HOME`과 실제 java 버전 확인**

   ```
   JAVA_HOME=C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot\
   openjdk version "17.0.20" 2026-07-21 LTS
   ```

   Capacitor 8의 `capacitor-android` 모듈은 Java 21로 컴파일된다. JDK 17로는 `--source 21`을 해석할 수 없다.

2. **시스템에 설치된 JDK 전수 조사** — `javac.exe` 존재 여부로 탐색한 결과 두 개뿐이었다.

   | 경로 | 버전 |
   |---|---|
   | `C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot` | 17 (현재 `JAVA_HOME`) |
   | `C:\Program Files\Android\Android Studio\jbr` | 25 |

3. **`gradle.properties` / `variables.gradle` / wrapper 확인** — Java 버전을 강제하는 설정은 없었고,
   wrapper는 `gradle-8.14.3-all.zip`이었다. 즉 프로젝트 설정 문제가 아니라 순수 환경 문제였다.

4. **7/20에는 왜 됐는지 역추적** — 트러블슈팅 문서
   [`android-home-env-not-reflected.md`](android-home-env-not-reflected.md)에 당시 우회책이 남아 있었다.

   ```bash
   export JAVA_HOME="/c/Program Files/Android/Android Studio/jbr"  # Android Studio 번들 JDK 21
   ```

   **당시 JBR은 JDK 21이었다.** 그 뒤 Android Studio가 업데이트되며 JBR은 25가 됐고,
   `JAVA_HOME`은 별개로 Microsoft JDK 17로 바뀌어 있었다. 빌드 환경이 두 축 모두에서 조용히 이동한 것이다.

## 최종 해결법

**임시 우회 (이번 세션)** — 환경변수·`gradle.properties`를 건드리지 않는 일회성 플래그로 JBR 25 지정.

```
.\gradlew.bat assembleDebug "-Dorg.gradle.java.home=C:\Program Files\Android\Android Studio\jbr"
→ BUILD SUCCESSFUL in 42s
```

Gradle 8.14.3의 공식 지원 상한이 Java 24라 JDK 25 데몬이 거부될 가능성을 우려했으나 정상 동작했다.

**항구 해결 (채택 방침)** — Adoptium Temurin 21 설치 후 `JAVA_HOME` 전환.
`gradle.properties`에 JBR 경로를 고정하는 방안은 ① Gradle 지원 상한 초과 ② 절대 경로 하드코딩으로
다른 PC에서 깨짐 ③ Android Studio 업데이트마다 JBR 버전이 또 움직임 — 세 이유로 기각했다.
자세한 트레이드오프는 [`docs/decisions/android-build-jdk21.md`](../decisions/android-build-jdk21.md) 참고.

## 남은 이슈

- Temurin 21 설치 및 `JAVA_HOME` 전환은 사용자가 직접 진행 예정
- 전환 후 플래그 없이 `.\gradlew.bat assembleDebug`가 통과하는지 검증 필요
- 검증 시 주의: 2026-07-20 기록대로 Windows에서는 환경변수를 바꿔도 실행 중인 상위 프로세스가
  예전 스냅샷을 물고 있어 새 셸에 반영되지 않을 수 있다. `java -version`이 21로 안 잡히면 재부팅

## 이력서 소재 한 줄

"지난주엔 되던 빌드"가 실패한 원인을 코드 변경이 아닌 툴체인 이동에서 찾아, 과거 트러블슈팅 문서를 역추적해
Android Studio 업데이트로 번들 JDK가 21→25로 바뀐 사실을 특정하고, 빌드 환경 고정 지점을 IDE 번들 런타임에서
독립 설치 JDK로 옮기는 방침을 수립함.
