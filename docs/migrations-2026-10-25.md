# 2026-10-25 마이그레이션 적용 기록

최신 원격 `main` `f653d457`(v0.341.0)을 기존 CC 작업이 있는 `work`에 병합했다. 병합 커밋은 `37aabaff`이며 충돌은 없었다.

## 대상과 적용 SQL

원본: `supabase/migrations/20261031000000_currency_log.sql`

SHA-256: `1ac2b585c0cb9c1b0d840e3ba2659b011704bbac6288498866166ce8bfa584df`

- QA `forgarden-test` (`rscxzfdnbdmftortrcqt`): 적용 완료. 원격 이력은 `20261024210441_currency_log`다. 저장소 파일의 날짜와 원격 도구가 기록한 버전은 다르며 같은 SQL을 중복 실행하지 않는다.
- 운영 `forgarden-prod` (`udujahnlyhedlrfbaaow`): 적용 완료. 원격 이력은 `20261024211000_currency_log`다. 최초 자동 승인 검토에서 운영 대상의 명시적 승인 부족으로 중단됐고, 사용자의 추가 승인 후 QA와 동일 SHA-256의 SQL을 적용했다. 연결 요청 만료가 발생한 호출은 미적용 상태를 조회한 뒤 재시도했다.

이력 이름만으로 과거 파일을 재실행하지 않고 실제 스키마를 비교했다. 적용 전에는 QA와 운영 모두 이번 파일의 `currency_log`, `currency_alert_rules` 두 표가 빠져 있었다. 두 환경에 적용한 후 누락 표는 없다. 과거 `public.is_admin/admin_can`은 보안 강화로 `private`에 이동한 상태이므로 누락 마이그레이션으로 취급하지 않았다. 저장 함수 인자와 아레나 주간 필드도 양쪽에서 확인했다.

## 변경 범위

- `currency_log`·`currency_alert_rules`, 인덱스, RLS, 기본 경고 기준 11개를 추가한다.
- `player_saves` 저장 시 지갑 앞뒤를 비교하는 트리거를 연결한다.
- 기존 `server_commit_state`는 `server_commit_state_before_ledger`로 보존하고, 출처·request ID·호출자 문맥을 전달하는 래퍼를 만든다.
- 관리자 조회 `admin_currency_log`, 서비스 롤 전용 보관 기간 정리 함수를 추가한다. 정리 함수를 실행하지는 않았다.
- 기존 잔액·저장·계정을 초기화하거나 과거 내역을 소급 생성하지 않는다. 출시 초기화 SQL은 격리 로컬 테스트에서만 실행했다.

## 검증

격리 PostgreSQL에서 전체 마이그레이션을 적용한 뒤 다음을 검증했다.

- 초기 지갑 기록, 재화 획득·소모, 잔액·출처·request ID 보존.
- 명시적 스테미나 지급 기록과 자연 회복 제외.
- 대기 중인 어드민 조정의 별도 출처 기록.
- 변경 없는 저장의 로그 중복 방지, revision 충돌 시 로그 미생성.
- 관리자 조회·경고 집계, 일반 계정 접근 거부, 테이블 직접 조회 및 정리 함수 권한.
- 출시 초기화의 dry-run·5종 가드·분류·실행·재실행·운영 콘텐츠 보존.

최신 파일이 추가한 로그 표에 기존 출시 초기화 표본이 없어서 검증이 처음 실패했다. `launch-reset-seed.sql`의 구 표본 `{"gems":999}`를 실제 형식 `{"wallet":{"gems":999}}`로 고치고, 롤백되는 재화 로그 검증을 공용 DB 검사에 추가했다.

`npm run test:launch-reset` 통과, 관련 단위 검사 391개 통과, 타입 검사 및 프로덕션 빌드 통과.

QA와 운영 원격 모두에서 트리거 활성화, 경고 기준 11개, 두 표의 RLS, 익명/일반 계정의 직접 조회 불가, 서비스 롤 저장·정리 권한, 래퍼의 기존 저장 함수 위임을 확인했다. 관리자 문맥 없이 조회 RPC를 호출하면 권한 오류를 내는 것도 확인했다.

## 보안 점검 결과 해석

[정책 없는 RLS 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)는 두 표에 표시된다. 직접 접근을 닫고 권한을 확인하는 함수로만 읽도록 한 설계와 일치한다.

[인증 사용자에게 실행 권한이 있는 SECURITY DEFINER 함수 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)는 `admin_currency_log`에도 표시된다. 내부 `private.admin_can`의 owner/operator/cs 검증과 일반 계정 거부를 별도로 검사했다. 안내를 없애기 위해 일반 사용자 정책이나 테이블 권한을 열지 않았다.

운영 후속 적용도 완료했다. 이력·트리거·RLS·권한·관리자 접근 차단 검사 결과는 QA와 동일했고, 이번 변경의 보안 점검 안내도 같은 유형이었다. 운영 데이터 초기화·정리 함수 실행·과거 로그 소급 생성은 수행하지 않았다.
