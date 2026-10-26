# 게임·Android/iOS 출시 보안 점검 — 2026-10-25

현재 체크아웃의 게임·서버·결제/광고 경로, 공개 빌드, 의존성과 실제 QA/운영 Supabase 권한을 확인했다. 수정 사항은 로컬 코드와 생성한 서버 번들에 반영했다. 이 점검으로 원격 앱/API를 배포하거나 스토어에 패키지를 올리지는 않았다.

## 확인 후 수정한 문제

| 항목 | 확인한 문제 | 조치 |
|---|---|---|
| 광고 위조 | 일반·서버 빌드도 서명 없는 `temp-ad:<슬롯>`을 완료로 인정 | 임시 광고는 QA 전용. 검증자 없는 일반 서버의 광고 슬롯은 비활성화 |
| 과금 준비 상태 | SDK만 붙이면 서버 검증이 없어도 결제창을 열 수 있었음 | 서버가 상품을 구매 불가로 내려주고 실제 결제 직전 최신 카탈로그를 다시 확인. 검증 준비 전에 SDK를 호출하지 않음 |
| 이중 지급 | `activatePass`와 `fulfillPlatformPurchase`가 별도 지급 경로 | 패스 활성화도 공용 거래 지급 장부를 사용. 두 API 연속 호출·서버 객체 재생성 후 중복 지급 방지 검사 |
| 결제 복구 | 검증 결과가 객체의 메모리 Map에만 있어 다음 HTTP 요청에서 사라짐 | 서버 저장 장부에서 복원하고 구매 검증·지급 기록을 일반 영수증 정리에서 보존. 원본 스토어 영수증은 상태에 저장하지 않음 |
| 영수증·재시도 | 잘못된 SKU, 긴 거래 ID, 갱신된 영수증 본문에 대한 경계 부족 | SKU/본문 크기 확인, 64자 이내 해시 요청 키. 영수증 본문 갱신은 재검증하고 지급 키는 서버가 확인한 거래 ID로 유지. SDK 오류 원문을 화면에 보내지 않음 |
| 네이티브 WebCrypto | WebView에서 해시 기능이 없으면 결제 뒤 실패할 수 있음 | 결제 시작 전에 WebCrypto 사용 가능 여부 확인 |
| 운영 QA 도구 | 환경변수 한 개로 운영 서버에서도 개발 지급을 켤 수 있었음 | QA 도구는 승인된 QA Supabase 프로젝트에만 허용 |
| 서버 난수 | 가챠 등에 기본 `Math.random` 사용 | 서버 기본 난수를 `crypto.getRandomValues` 기반 53비트 균등 난수로 교체. 테스트의 명시적 고정 난수는 유지 |
| 요청 폭주 | 인스턴스의 직렬 게임 큐에 요청을 무제한 누적할 수 있었음 | 실행 중 요청 포함 32개 상한, 초과 시 재시도 가능한 503. 별도 계정도 공용 상한 적용 |
| 요청 영수증 저장 악용 | 임의 조회 ID와 큰 입력 원문·전체 상태 스냅샷을 영수증 표에 누적할 수 있었음 | 조회 ID는 장부에 기록하지 않고 변경 요청 fingerprint는 SHA-256으로 고정. 영수증에는 결과만 저장하고 재전송 시 최신 상태를 결합. 기존 원문 fingerprint 영수증도 호환하며 이미 저장된 기록을 삭제하지 않음 |
| 네이티브 API | `/api/game`, `/api/account`가 WebView의 로컬 주소를 가리킴 | 모든 게임·계정·친구·길드·아레나 경로에 공통 HTTPS API Origin 적용. 네이티브 주소 누락 시 실패 |
| WebView CORS | OPTIONS를 405로 거절해 네이티브의 인증 요청이 막힘 | 정확한 허용 Origin의 POST/authorization/content-type preflight 처리. 와일드카드·`null` Origin 거절. CORS는 인증 대체 수단이 아님 |
| 토큰 저장소 | 앱 패키지도 기본 Web용 localStorage 저장소로 돌아갈 수 있었음 | Android/iOS는 보안 저장소 미주입 시 연결 불가. 웹 OAuth 팝업도 앱의 기본값으로 설치하지 않음 |
| 브라우저 공격면 | 명시적 CSP 등 배포 정책이 없었음 | 인라인 스크립트·eval·외부 프레임 차단, 제한된 통신 Origin, nosniff/프레임 차단/리퍼러 정책. 네이티브 HTML에도 CSP 포함 |
| 빌드 공급망 | npm 감사 7건(critical 2, high 3 등) | Vite 7.3.7, Vitest 4.1.12, source-map-js 1.2.2 등 보안 수정 버전으로 갱신. lockfile 반영 후 감사 0건 |
| 키·서버 파일 혼입 | 자격증명과 잘못된 공개 산출물을 막는 자동 검사가 부족 | 비밀 파일 ignore와 정적 키/특권 JWT 검사 추가. 공개 SQL·서버 파일·소스맵·서명 자료 및 서버 비밀 설정 참조를 검사. Vercel 빌드도 이 검사를 통과해야 배포 가능 |

Vitest/Vite 관련 취약점의 주 공격면은 개발·테스트 서버와 빌드 환경이다. 이를 곧바로 배포된 게임의 원격 코드 실행이라고 간주하지 않았다. npm 감사 0건도 Git 커밋 의존성·네이티브 SDK·운영체제 전체의 안전성을 증명하지 않는다.

## 실제 권한·키 점검 결과

`forgarden-prod`와 `forgarden-test`를 읽기 전용으로 조회했다.

- `anon`·`authenticated` 모두 `admin_roles`의 INSERT/UPDATE/DELETE 권한이 없다. 관리자 권한 표의 정책은 본인 행 SELECT뿐이다.
- 관리자 판단은 사용자가 편집 가능한 `user_metadata`가 아니라 `private.admin_can` → `admin_roles`를 읽는다.
- 일반 계정의 `upload_my_save`·`remove_my_save` 실행 권한은 이미 회수되어 있다. 과거 문서의 미해결 항목과 달리 현재 DB에서는 닫혀 있다.
- 확인한 `server_commit_state`, `server_set_account_id`, `server_wipe_player`, `server_ops_ack`, `server_arena_rating_publish`는 익명·일반 인증 계정이 직접 실행할 수 없다.
- public 표에서 RLS가 꺼진 항목은 없었다. 관리자 조회 RPC는 함수 내부의 관리자 검사도 확인했다.
- 현재 게임의 추적 파일·공개 디렉터리·생성 번들에서 서비스 롤 JWT, `sb_secret_` 비밀 키, 개인 키 등 검사 대상 비밀값은 발견하지 못했다. `.env.qa.example`의 publishable 키는 공개 클라이언트용이며 서비스 비밀 키가 아니다.
- 알려진 비밀 파일 확장자와 `.env`/`.env.production` 경로의 Git 이력에도 해당 파일은 발견하지 못했다. 저장소 전체 과거 바이너리의 포렌식이나 외부 로그·배포 플랫폼의 비밀값 전체를 검사한 것은 아니다.
- 형제 어드민의 인증 코드는 access/refresh 토큰을 메모리에만 보관하고 공개 publishable 키를 사용한다. 이 작업에서 어드민 사이트를 수정하거나 재배포하지 않았다.

현재 점검 범위에서는 ‘아무나 관리자 등록’이나 ‘공개 서비스 비밀 키’가 확인되지 않았다. 사용자가 자기 기기에서 자기 액세스 토큰을 관찰할 수 있다는 사실과, 다른 계정의 토큰·서버 서비스 키가 공개되는 것은 구분한다.

## 실제 결제·광고 전에 남은 출시 차단 항목

아래는 완료된 SDK 기능이 아니다. 일반 서버는 현재 실제 검증 서비스가 없어 과금/보상 광고를 사용할 수 없도록 유지한다.

1. **스토어 서버 검증과 전역 거래 장부.** 현재 지급 영수증은 계정별 저장 장부다. Apple/Google 환경·bundle/package ID·SKU·환불 상태·계정 귀속을 실제 서버 API로 확인하고, `(스토어, 거래/구매 토큰)` 전역 유니크 제약과 계정 바인딩을 지급 트랜잭션에 넣어야 한다. 단순 검증 콜백을 끼우는 것만으로 계정 간 영수증 재사용이 해결되지 않는다. 수량 제한 상품은 결제 전 주문 예약과 초과 결제 보상/환불 정책도 필요하다.
2. **스토어 복구·ACK·환불/구독 알림.** 앱 종료·백그라운드·네트워크 단절 후 미완료 거래 재조회, 지급 확인 후 StoreKit finish / Play acknowledge·consume, RTDN·App Store Server Notifications 검증과 중복 처리, 환불/구독 만료 회수 정책이 없다. 실제 구매·갱신·취소를 sandbox에서 검사해야 한다.
3. **광고 SSV·일회용 장부.** SDK가 준 문자열을 믿지 말고 광고 제공자의 공식 서명·키·시각을 검증한다. 계정·슬롯·서버 발급 nonce에 묶고 지급과 소비를 원자적으로 확정해야 한다. 현재 서버는 이런 실제 SSV가 없어 보상 광고를 비활성화한다.
4. **네이티브 보안 저장소/로그인 부트스트랩.** Keychain/Android Keystore 어댑터와 네이티브 OAuth 브릿지 구현이 아직 없다. `installBackend({ store, oauth })` 연결을 실제 앱 초기화에 넣어야 한다. 앱이 localStorage로 대신 인증을 이어 가지 않도록 막은 상태이지, 보안 저장소 SDK를 구현한 것은 아니다.
5. **웹 로그인 저장소.** 웹용 localStorage refresh 토큰의 임시 저장은 아직 남아 있다. CSP를 추가해도 XSS 상황의 저장소 접근 위험은 사라지지 않는다. 실제 유저·과금 웹 서비스를 계속 제공하려면 HttpOnly/Secure 서버 세션(BFF)으로 전환하고 기존 세션 회수·계정 복구·refresh 동시성까지 검증해야 한다. 사용자의 게스트 계정을 잃게 만드는 단순 메모리 저장소 교체나, JS가 복호화할 수 있는 저장소를 안전한 대안으로 제시하지 않았다.
6. **광고 개인정보와 앱 정책.** ATT/UMP·개인화/문맥 광고 선택·연령 처리·SDK 초기화 순서·스토어 개인정보 신고가 실제 SDK에 연결되어 있지 않다. 타입에 동의 필드가 있는 것만으로 개인정보 처리가 완성되는 것은 아니다. iOS Privacy Manifest/필요 권한과 Play Data Safety를 실제 SDK 수집 항목에 맞춰 작성해야 한다.
7. **서명된 AAB/IPA 검증.** 이 저장소에는 Android/iOS 네이티브 프로젝트와 서명 결과물이 없다. 디버그 서명, 병합된 Android manifest, 백업/평문 통신, 공개 컴포넌트, WebView 외부 이동/디버깅, 최종 iOS entitlement·ATS·권한을 실제 산출물에서 확인해야 한다. 웹 자산 빌드를 APK/IPA 보안 검증으로 대신하지 않았다.
8. **계정·공격 대응 운영 설정.** 운영 보안 advisory에서 비밀번호 유출 차단 비활성화를 확인했다. 현재 연결 도구에는 Auth 설정 변경 기능이 없어 이 설정은 변경하지 않았다. 관리자 MFA·민감 계정 변경의 재인증 정책, 가입/인증 전 IP 악용과 분산 요청에 대한 게이트웨이 제한은 별도 운영 검토가 필요하다. 애플리케이션 큐 상한과 기존 계정별 DB 제한이 네트워크 DDoS 방어 전체를 대신하지 않는다.

## 검사 실행법

```sh
npm test
npm run build
npm run build:server
npm run test:release-fixtures
npm run test:build-isolation
npm run test:server-db
npm run security:audit
npm audit

# 네이티브 프로젝트가 생성된 뒤 사용. 없는 현재 상태에서는 실패가 정상이다.
npm run security:android
npm run security:ios
node scripts/check-security.mjs --android --dist path/to/android-web-assets
node scripts/check-security.mjs --ios --dist path/to/ios-web-assets
```

`.env.native.example`은 공개 설정의 예시다. Android/iOS 빌드에 `VITE_APP_TARGET`과 실제 `VITE_GAME_API_ORIGIN`을 지정한다. 서버의 `FORGARDEN_APP_ORIGINS`에는 실제 WebView Origin을 정확히 등록한다. `*` 또는 `null`로 우회하지 않는다. 서비스·스토어 서명 키를 `VITE_` 환경변수에 넣지 않는다.

새 네이티브 앱의 웹 자산은 production 모드로 빌드한다. QA 모드를 앱스토어에 배포하지 않는다. 원격 `server.url`, 광범위한 `allowNavigation`, 혼합 콘텐츠/웹 콘텐츠 디버깅, Android 백업·평문 허용과 의도하지 않은 exported 컴포넌트, iOS ATS 예외/디버그 entitlement는 자동 검사 대상이다. 이 검사는 텍스트 설정 검사이며 실제 바이너리 manifest·최종 코드서명 검사나 동적 침투시험의 대체가 아니다.

## 검증 결과

- 최종 확인: 2026-10-26. 전체 회귀는 400파일에서 4,765개 통과·기존 건너뜀 1개, 실행 환경이 `unzip` 자식 프로세스를 거절한 에셋 검사 4개가 실패했다. 해당 파일을 자식 프로세스 실행이 가능한 환경에서 재검증해 4개 모두 통과했다. 합산 4,769개 통과이며 테스트 코드를 우회하거나 에셋 스냅샷을 갱신하지 않았다.
- 최종 보안·결제·큐 검사 32개 통과. 결제/구독 기존 회귀 150개 통과.
- 요청 영수증·게임 처리·큐 관련 25개 검사와 격리된 실제 PostgreSQL의 RLS·동시 요청·중복 지급·저장 형식 검사가 통과했다. DB 검사 도구는 초기화용 임시 PostgreSQL 대신 최종 서버가 준비된 뒤 실행하도록 보정했다.
- production/QA/test의 실제 번들 검증에서 테스트 영수증·광고 토큰 거절, 검증 서비스 없는 상품/슬롯 비활성화, SDK 미호출을 확인했다.
- Web·Android·iOS 모드의 웹 자산 빌드 및 서버 빌드 통과. 네이티브 번들에서 웹 토큰 저장소 구현이 제외됐고, 프로필별 검사에는 아직 없는 네이티브 프로젝트/manifest가 차단 항목으로 남았다.
- production 브라우저에서 타이틀 진입, 스크립트 오류 0, 정상 실행 중 CSP 위반 0. 격리된 로컬 브라우저의 인라인 주입 검사에서는 실행을 차단했고 QA 디버그 전역도 없었다.
- 공개 산출물 검사 0건, npm 감사 0건. 키 값·액세스/refresh 토큰·실제 스토어 영수증은 보고서에 기록하지 않았다.

증거 요약은 [QA 자료](qa/security-2026-10-25/)에 있다. 출시 차단 항목을 통과한 것으로 바꾸거나 미구현 SDK를 성공 처리하지 않는다.

참고: [Supabase 비밀번호 보안](https://supabase.com/docs/guides/auth/password-security), [Google Play 구매 검증/보안](https://developer.android.com/google/play/billing/security), [Apple App Store Server API](https://developer.apple.com/documentation/appstoreserverapi), [AdMob SSV](https://developers.google.com/admob/android/ssv), [Android 앱 보안](https://developer.android.com/privacy-and-security/security-best-practices).
