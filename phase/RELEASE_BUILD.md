# 릴리즈 키스토어 생성 + AAB 빌드 가이드 (Stage 11.4.3)

> ⚠️ 키스토어 파일과 비밀번호를 분실하면 이 앱을 다시는 업데이트할 수 없다.
> (Play Console에 다른 키로 새 AAB를 올리면 "서명이 일치하지 않는다"며 거부됨)
> 반드시 아래 순서대로, 백업까지 마치고 넘어갈 것.

---

## 1. [사용자 작업] 릴리즈 키스토어 생성

Git Bash 또는 PowerShell에서 실행 (JDK의 `keytool`이 PATH에 있어야 함 —
Android Studio 설치 시 함께 설치된 JBR을 쓰면 편함):

```bash
# 생성 위치: 저장소 밖의 안전한 폴더 (예: 사용자 홈 아래 별도 폴더)
mkdir -p ~/keystores
cd ~/keystores

keytool -genkey -v \
  -keystore media-diary-release.keystore \
  -alias media-diary \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

- `-validity 10000`: 약 27년 — Play 앱 서명 키는 장기간 유효해야 하므로 넉넉하게
- `-alias media-diary`: 이후 `keystore.properties`의 `keyAlias`와 반드시 일치시킬 것
- 실행하면 대화형으로 비밀번호(스토어 비밀번호, 키 비밀번호)와 소유자 정보(이름/조직/지역 등)를
  물어봄 — 비밀번호는 키 비밀번호와 스토어 비밀번호를 **같은 값으로 설정하는 것을 권장**
  (Play App Signing 업로드 키 흐름에서 값이 다르면 헷갈리기 쉬움)

### 백업 (필수, 최소 2곳)

1. 이 keystore 파일 자체 (`media-diary-release.keystore`)
2. 비밀번호 (스토어 비밀번호 + 키 비밀번호 + alias)를 별도로 (예: 비밀번호 관리자)

권장 백업 위치 조합: 클라우드 드라이브(개인 계정) + 로컬 외장 저장매체, 또는
비밀번호 관리자(1Password/Bitwarden 등)에 파일 첨부 기능으로 저장.
**git 저장소 안에는 어떤 경우에도 넣지 말 것** — `frontend/android/.gitignore`에
`*.keystore`/`*.jks`가 이미 등록돼 있어 실수로 커밋되진 않지만, 애초에 저장 위치
자체를 repo 밖으로 두는 것이 안전.

---

## 2. keystore.properties 작성

`frontend/android/app/keystore.properties.example`을 복사해서 실제 값 채우기:

```bash
cp frontend/android/app/keystore.properties.example frontend/android/app/keystore.properties
```

```properties
storeFile=/절대/경로/media-diary-release.keystore
storePassword=<키스토어 생성 시 입력한 스토어 비밀번호>
keyAlias=media-diary
keyPassword=<키스토어 생성 시 입력한 키 비밀번호>
```

이 파일은 `.gitignore`에 등록되어 있어 git에 올라가지 않음 (Stage 11.4.3에서 확인).

---

## 3. AAB 빌드

```bash
cd frontend
npm run build        # 웹 자산 최신화
npx cap sync android  # 네이티브 프로젝트에 반영 (Stage 11.3 플러그인 포함 확인 완료)
cd android
./gradlew bundleRelease
```

- 산출물: `frontend/android/app/build/outputs/bundle/release/app-release.aab`
- `keystore.properties`가 있으면 자동으로 서명되어 나옴 (build.gradle 설정, Stage 11.4.3)
- `keystore.properties`가 없으면 서명 없이 빌드됨 — Play Console 업로드 전 반드시
  키스토어를 만들고 위 2번을 먼저 완료할 것

### 서명 확인

```bash
apksigner verify --print-certs frontend/android/app/build/outputs/bundle/release/app-release.aab
```
(AAB는 apksigner가 직접 지원 안 하는 버전도 있음 — 안 되면 `bundletool`로 APK 추출 후 확인)

---

## 4. versionCode / versionName 관리 규칙

`frontend/android/app/build.gradle`의 `defaultConfig`:

```groovy
versionCode 1
versionName "1.0.0"
```

- **versionCode**: Play Console에 업로드할 때마다 반드시 1씩 증가 (정수, 사용자에게 안 보임)
- **versionName**: 사용자에게 보이는 버전 문자열, SemVer 권장 (1.0.0 → 1.0.1 → 1.1.0 ...)
- 규칙: 버그 수정만 → patch(1.0.x), 기능 추가 → minor(1.x.0), 큰 변경 → major(x.0.0)
  올릴 때마다 두 값을 함께 갱신하고 커밋 메시지에 남길 것

---

## 5. 이번 세션에 이미 완료된 것

- [x] `npx cap sync android` 실행 완료 — `capacitor-plugin-cdv-purchase@13.18.0`,
      `@capacitor/app@8.1.1` 2개 플러그인이 네이티브 프로젝트에 정상 반영됨
      (`capacitor.settings.gradle`, `app/capacitor.build.gradle`에 모듈 등록 확인)
- [x] `versionName`을 `"1.0"` → `"1.0.0"`으로 통일
- [x] `keystore.properties` 유무에 따라 안전하게 분기하는 서명 설정 완료
- [x] `./gradlew bundleRelease` 실제 실행 검증 (BUILD SUCCESSFUL, 190+ tasks)
  - `keystore.properties` 없는 상태 → 미서명 AAB 정상 생성 확인 (`jarsigner -verify` → "jar is unsigned.")
  - 임시 테스트 키스토어(1일 유효, scratchpad에서만 생성)로 서명 경로도 실행해
    `jarsigner -verify` → "jar verified." 확인 → 테스트 키스토어와 `keystore.properties`
    즉시 삭제, 저장소에는 아무 흔적도 남기지 않음
  - 즉, 실제 릴리즈 키스토어만 만들어서 `keystore.properties`에 채우면
    바로 서명된 AAB가 나오는 상태까지 검증 완료
