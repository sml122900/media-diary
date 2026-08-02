# 기술 결정 — Android 빌드 JDK를 Adoptium Temurin 21로 통일

## Problem (상황/문제)

> 모바일 메뉴 수정을 실기기에 반영하려고 `gradlew.bat assembleDebug`를 실행했더니 빌드가 실패했다.
>
> ```
> > Task :capacitor-android:compileDebugJavaWithJavac FAILED
>   error: invalid source release: 21
> ```
>
> Capacitor 8의 `capacitor-android` 모듈은 Java 21로 컴파일되는데, 세션의 `JAVA_HOME`은
> **JDK 17**(`C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot`)을 가리키고 있었다.
>
> 문제는 2026-07-20 Stage 11.2.1에서는 같은 명령이 성공했다는 점이다. 당시 트러블슈팅 문서
> [`android-home-env-not-reflected.md`](../troubleshooting/android-home-env-not-reflected.md)를
> 확인하니 그때는 `JAVA_HOME`을 Android Studio 번들 JBR로 지정했고, 그 시점 JBR은 **JDK 21**이었다.
> 그 사이 Android Studio가 업데이트되며 JBR은 **JDK 25**가 됐고, `JAVA_HOME`은 별개로
> Microsoft JDK 17로 바뀌어 있었다. 즉 빌드 환경이 두 축 모두에서 조용히 이동한 상태였다.
>
> 시스템에 설치된 JDK는 두 개뿐이었다.
>
> | 경로 | 버전 |
> |---|---|
> | `C:\Program Files\Microsoft\jdk-17.0.20.8-hotspot` | 17 (현재 `JAVA_HOME`) |
> | `C:\Program Files\Android\Android Studio\jbr` | 25 |

## Action (결정 및 근거)

> 당장 설치를 진행해야 했으므로 일회성 플래그로 JBR 25를 지정해 빌드를 통과시켰다.
> **환경변수와 `gradle.properties`는 건드리지 않았다** — 되돌릴 필요 없는 임시 우회로 남기기 위해서다.
>
> ```
> .\gradlew.bat assembleDebug "-Dorg.gradle.java.home=C:\Program Files\Android\Android Studio\jbr"
> → BUILD SUCCESSFUL in 42s
> ```
>
> 항구 해결책으로는 세 가지를 검토했다.
>
> | 방안 | 판단 |
> |---|---|
> | **Temurin 21 설치 + `JAVA_HOME` 전환** | **채택.** Capacitor 8 권장 환경, Gradle 8.14.3 지원 범위 안, 팀/다른 PC 재현 가능 |
> | `gradle.properties`에 `org.gradle.java.home` 고정 | 기각. JDK 25는 Gradle 8.14.3 공식 지원 상한(24) 초과로 미래 실패 여지, 절대 경로 하드코딩이라 다른 PC에서 깨지고, Android Studio 업데이트마다 JBR 버전이 또 움직임 |
> | Gradle wrapper 9.x 상향 | 기각. `gradle-wrapper.properties` 커밋 변경이 필요하고 AGP·플러그인 호환성 파급이 큼. 빌드 환경 하나 고치자고 감수할 범위가 아님 |
>
> 채택안의 핵심 근거는 **버전 고정 지점을 "설치된 JDK"로 옮기는 것**이다. JBR을 참조하면
> 빌드 환경이 Android Studio 업데이트에 종속되지만(이번 사고가 정확히 그 사례다),
> 프로젝트가 요구하는 JDK를 독립적으로 설치해 두면 IDE 업데이트와 무관해진다.

## Result (결과)

> 이번 세션에서는 일회성 플래그로 APK 빌드·설치를 완료했고, Temurin 21 설치와 `JAVA_HOME` 전환은
> 사용자가 직접 진행하기로 했다. 전환 후에는 플래그 없이 `.\gradlew.bat assembleDebug`가
> 통과하는지 검증이 필요하다.
>
> 검증 시 주의점: 2026-07-20에 기록된 것처럼 Windows에서는 환경변수를 바꿔도
> 실행 중인 상위 프로세스가 예전 환경 스냅샷을 물고 있어 새 셸에도 반영되지 않을 수 있다.
> `java -version`이 21로 잡히지 않으면 재부팅이 확실한 방법이다.

**교훈**: 빌드 환경을 IDE 번들 런타임(Android Studio JBR)에 의존시키면, IDE 업데이트가
곧 빌드 환경 변경이 된다. "지난번엔 됐는데 지금 안 된다"는 상황에서는 코드 변경 이력뿐 아니라
**툴체인 버전이 그 사이 움직였는지**를 함께 확인해야 한다.
