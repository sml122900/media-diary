# gradle 파일이 계속 modified로 뜸 — 줄바꿈이 아니라 git stat 캐시

## 문제 상황

Capacitor 프로젝트의 gradle 파일 2개가 작업 시작 시점부터 계속 `modified` 상태로 남아 있었다.

```
$ git status --short
 M frontend/android/app/capacitor.build.gradle
 M frontend/android/capacitor.settings.gradle
```

`git diff`를 걸면 줄바꿈 경고만 나오고 내용 차이는 안 보였다.

```
warning: in the working copy of 'frontend/android/app/capacitor.build.gradle',
LF will be replaced by CRLF the next time Git touches it
```

실제 변경사항을 커밋할 때마다 이 2개가 섞여 들어와서, **진짜 변경을 놓치기 쉬운 상태**였다.

## 시도한 것들

### 1. 줄바꿈 문제로 단정 (오진)

경고 문구가 CRLF/LF를 가리키고 `core.autocrlf=true`인 Windows 환경이라 줄바꿈 문제라고 보고했다.
`.gitattributes`로 해결하면 된다고 판단했다. **이 진단은 틀렸다.**

### 2. 실제 바이트 비교

`.gitattributes`를 쓰기 전에 근거를 확인했다. HEAD blob과 워크트리 파일의 해시를 직접 비교했다.

```
$ git rev-parse HEAD:frontend/android/app/capacitor.build.gradle
18894fae172d7b0d2cb7e0bf99c3e137ad08a653
$ git hash-object frontend/android/app/capacitor.build.gradle
18894fae172d7b0d2cb7e0bf99c3e137ad08a653   ← 완전히 동일
```

양쪽 다 LF였다(`cat -A`로 확인, `^M` 없음). `git diff --numstat`도 비어 있었다.
**내용이 같은데 status만 modified로 뜨는 상태**였다.

### 3. 인덱스 상태 확인

```
$ git update-index --refresh
frontend/android/app/capacitor.build.gradle: needs update

$ git diff-files frontend/android/
:100644 100644 18894fae… 0000000000000000000000000000000000000000 M
                         ^^^^ 목적지 해시가 all-zero = "아직 계산 안 함"
```

`diff-files`의 목적지 해시가 all-zero라는 건 git이 **stat 정보만 보고 "달라졌을 수 있다"고 표시**
했을 뿐 내용을 비교하지 않았다는 뜻이다.

원인이 잡혔다. `npx cap sync android`가 매번 **같은 내용으로 파일을 다시 쓴다.** 내용은 그대로인데
mtime이 바뀌니 git의 stat 캐시가 어긋나고, 그 상태가 인덱스에 반영되지 않은 채 남아 있었다.

## 최종 해결법

`git add`로 인덱스의 stat 정보만 갱신했다. 내용이 동일하므로 **스테이징되는 변경은 없다.**

```
$ git add frontend/android/app/capacitor.build.gradle frontend/android/capacitor.settings.gradle
$ git diff --cached --stat      # 비어 있음 — 스테이징된 내용 없음
$ git status --short            # 두 파일 사라짐
```

`.gitattributes`도 함께 넣었다. 이번 원인은 아니었지만 경고가 가리키던 재발 경로
(git이 CRLF로 체크아웃 → `cap sync`가 LF로 덮어씀 → **진짜 diff** 발생)는 실재하기 때문이다.

```
*.gradle           text eol=lf
gradle.properties  text eol=lf
gradlew            text eol=lf
gradlew.bat        text eol=crlf   # 배치 스크립트는 CRLF여야 실행된다
*.bat              text eol=crlf
```

`npx cap sync android`를 다시 돌려 status가 깨끗하게 유지되는 것까지 확인했다.

## 이력서 소재 한 줄

> 에러 메시지가 가리키는 원인(줄바꿈)을 그대로 받아들이지 않고 blob 해시와 인덱스 상태를 직접
> 비교해, 실제 원인이 코드 생성 도구의 재작성으로 인한 git stat 캐시 불일치임을 규명하고
> 잘못된 진단을 정정했다.
