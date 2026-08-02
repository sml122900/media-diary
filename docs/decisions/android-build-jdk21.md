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

> 일회성 플래그로 먼저 APK 빌드·설치를 완료했고, 이어서 사용자가 Adoptium Temurin 21을 설치하고
> `JAVA_HOME`을 전환했다. **같은 세션에서 검증까지 마쳤다.**
>
> ```
> JAVA_HOME = C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\
> openjdk version "21.0.12" 2026-07-21 LTS (Temurin-21.0.12+8)
>
> .\gradlew.bat assembleDebug        ← 플래그 없음
> → BUILD SUCCESSFUL in 27s
> ```
>
> 빌드된 APK를 실기기에 설치할 때는 이번엔 제거 없이 `adb install -r`만으로 덮어써졌다.
> 오늘 생성된 debug keystore가 그대로 유지되어 서명이 일치했기 때문이다.
>
> 검증 중 확인된 주의점: 2026-07-20에 기록된 현상이 재현됐다. `JAVA_HOME`이 레지스트리
> Machine 레벨에는 정상 등록(`[Environment]::GetEnvironmentVariable("JAVA_HOME","Machine")`)됐지만,
> 이미 실행 중이던 셸 프로세스는 여전히 JDK 17을 물고 있었다. 새 셸에서 레지스트리 값을 다시 읽어
> 적용해야 했다 — 환경변수 전환 후에는 셸을 새로 띄우거나 재부팅해야 한다.

**교훈**: 빌드 환경을 IDE 번들 런타임(Android Studio JBR)에 의존시키면, IDE 업데이트가
곧 빌드 환경 변경이 된다. "지난번엔 됐는데 지금 안 된다"는 상황에서는 코드 변경 이력뿐 아니라
**툴체인 버전이 그 사이 움직였는지**를 함께 확인해야 한다.
