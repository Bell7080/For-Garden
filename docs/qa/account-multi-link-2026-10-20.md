# 계정 다중 연동 (v0.322.0)

## 구현

- 설정의 연동 목록은 게스트/아이디 로그인 여부로 사라지지 않는다. Google/Apple 각각 연결·해제, 이메일 인증, 아직 없는 아이디 추가를 제공한다.
- 타이틀의 Google/Apple은 별도 계정 로그인, 설정의 Google/Apple은 현재 UID에 정체성을 추가한다. 수동 연동 실패를 별도 계정 로그인으로 대체하지 않는다.
- OAuth는 PKCE(S256), 부모 메모리의 verifier, 같은 origin과 실제 팝업 창을 확인한 code 메시지를 사용한다. callback URL은 처리 직후 지운다. 토큰을 postMessage하지 않는다.
- UID가 다른 소셜/이메일 검증 응답은 기존 토큰을 덮지 않는다. 소셜 해제는 로그인 수단이 하나뿐이면 거절한다. 이메일/비밀번호는 이 화면에서 삭제하지 않는다.
- 이메일 인증은 Supabase의 email_change/이메일 OTP를 사용한다. 임의로 확인 완료 처리하지 않는다.
- `account_login_ids`는 아이디 → Auth UID만 보관한다. 비밀번호는 Auth만 소유한다. 이메일이 바뀌어도 서버가 해당 UID의 현재 이메일로 비밀번호를 검증한다. 클라이언트가 합성 이메일을 먼저 인증하지 않는다(예전 합성 이메일을 재사용한 다른 UID 선택 방지).
- Google/이메일 계정에 아이디를 추가할 때 확인된 기존 이메일을 유지하고 같은 UID에 비밀번호를 설정한다. 기존 ID/다른 UID의 ID를 덮어쓰지 않는다.

## 운영 적용 순서 (권한 있는 담당자)

1. 앞선 마이그레이션까지 적용된 DB에 `supabase/migrations/20261029000000_account_identity_aliases.sql` 적용. **이번 `/api/account` 배포와 함께 필요**하다. 기존 합성 이메일 ID를 일괄 등록한다.
2. Supabase Authentication → Providers에서 Google/Apple을 각각 실제 프로젝트 자격 증명으로 활성화. 외부 서비스의 callback은 Supabase가 안내하는 `https://<project>.supabase.co/auth/v1/callback`을 등록한다.
3. Authentication → URL Configuration에 실제 게임 origin의 `https://forgarden.vercel.app/?pf_auth_callback=1`을 허용한다. 프리뷰는 사용할 origin만 개별 등록한다. Site URL도 게임 origin으로 지정한다.
4. Authentication의 **Allow manual linking**을 활성화한다. 비활성 상태에서 연동 실패가 다른 UID 로그인으로 바뀌지 않도록 코드가 거절한다.
5. 이메일 OTP를 실제 유저에게 보낼 SMTP를 설정하고 이메일 변경/로그인 템플릿에 `{{ .Token }}`을 포함한다. 기본 Supabase 발송은 대상/호출량 제한이 있어 상용 발송용으로 간주하지 않는다.
6. 합성 이메일 ID 계정에는 과거 주소의 메일함이 없다. 이 경우 새 주소만 확인하도록 Auth의 **Secure email change(양쪽 주소 확인)** 정책을 끈 상태에서 이 앱의 이메일 연동을 사용해야 한다. 새 주소 인증은 여전히 필수이며 인증된 현재 세션에서만 변경을 요청한다. 정책을 유지한다면 ID 계정의 이메일 연동은 기존 주소 확인까지 완료되지 않아 작동하지 않는다.
7. 실제 게스트→ID→Google→이메일→다른 기기 ID 로그인 / Google→ID / 연결 해제를 검증한다. Apple은 개발자 계정·서비스 ID·도메인/리턴 URL 등 Apple 측 설정도 필요하다.

이번 환경에는 Supabase/Vercel 관리 권한이나 실제 제공자 자격 증명이 없다. 운영 설정과 실제 Google/Apple/SMTP 성공은 여기서 적용·검증하지 않았다. 키는 채팅이 아닌 해당 서비스의 보안 설정에 넣는다.

## 경계와 남은 출시 항목

- 로그인은 다른 계정으로 전환하는 동작이다. 설정의 ID 로그인은 기존 확인 창을 거치고 성공한 경우만 진행 연결을 내리고 Boot로 이동한다. 같은 UID 연동은 진행을 초기화하지 않는다.
- 기존 웹 TokenStore의 보안 저장소 대체/HttpOnly 이전은 `docs/release-fixture-cleanup.md`의 기존 출시 차단 항목이다. 이 변경으로 해결됐다고 간주하지 않는다.
- 로그인 별칭은 Auth 계정에 종속되어 계정 삭제 시 FK로 삭제된다. 출시 초기화 때 운영자 계정의 별칭만 남는다.
