# 2026-11-02 운영·QA 마이그레이션 및 배포 설정 점검

기준 게임 메인 `209417a6` (v0.400.1). 사용자 요청에 따라 두 Supabase 프로젝트의 적용 이력뿐 아니라 실제 테이블·함수·권한과 게임 Vercel 설정을 비교했다.

## 적용한 누락

|환경|이름|원격 적용 버전|처리|
|---|---|---|---|
|QA|server_regular_event|20261102104020|게임 원본 `20261118000000_server_regular_event.sql` 적용|
|QA|regular_event_utc_week|20261102104539|운영의 동일 마이그레이션 원문을 적용해 어드민 조회·이벤트 삭제 가능 기간 판정을 UTC 주간 기준으로 통일|
|운영|regular_event_utc_week|20261102074939|이미 적용된 동일 기능 확인. 재적용하지 않음|

두 번째 항목의 원본은 운영의 `supabase_migrations.schema_migrations`에 기록된 SQL이다. 배포된 For-Garden-Admin `fddb18935faaed03d343b534ab679273578aea41`도 같은 UTC 주간 변경을 사용한다. 함수 정의만 갱신했으며 이벤트 콘텐츠 삭제 함수를 호출하거나 이벤트 편성 데이터를 수정하지 않았다.

## 검증

- 저장소 마이그레이션의 public 테이블 생성 대상 62개가 QA·운영 양쪽 모두 존재한다. public 테이블 중 RLS 비활성 표는 없다.
- `public.admin_can`·`public.is_admin`은 과거 보안 강화로 `private` 스키마에 옮긴 함수다. 누락으로 간주해 public에 복원하지 않았다.
- `server_regular_event`, `get_regular_event`, `admin_delete_event_content`의 본문(줄바꿈 정규화)과 실행 권한이 QA·운영에서 일치한다. 세 함수 모두 빈 `search_path`를 유지한다.
- 서버 이벤트 RPC는 anon/authenticated 실행 불가, service_role만 실행 가능하다. 어드민 삭제 RPC는 기존 authenticated 권한 및 내부 owner/operator 검사 그대로다.
- 서비스 역할로 실제 조회를 실행해 양쪽 서버 RPC가 오류 없이 SQL NULL(미편성)을 반환함을 확인했다. QA 공개 조회 RPC도 JSON null을 반환했다.
- 남아 있던 소셜·길드 이름 변경 함수 해시 차이는 주석뿐이며 공백 무시 diff로 확인했다. 해당 함수는 변경하지 않았다.
- 보안 Advisor에서 `server_regular_event`에 대한 새 안내는 없었다. 프로젝트 전체에 기존 안내가 없다는 뜻은 아니다.

## 배포 및 설정

- 게임 운영·QA Vercel 배포 모두 `209417a6`이며 READY다. 각각 `forgarden.vercel.app`, `forgarden-test.vercel.app`에 연결돼 있다.
- 양쪽의 `SUPABASE_URL`, `VITE_SUPABASE_URL`, 공개 키, 서비스 키 설정 존재를 확인했다. 서비스 키 값은 복호화하거나 출력하지 않았다.
- 운영은 `FORGARDEN_BUILD=production`, `FORGARDEN_QA_TOOLS=0`, QA는 `qa`·`1`로 분리돼 있다. 필요한 환경변수 누락이 없어 변경·재배포하지 않았다.
- 기존 `recurring-mails` 스케줄은 양쪽 모두 활성 상태다.

## 추가 입력이 필요한 항목

- 양쪽 공개 Auth 설정에서 게스트와 이메일은 활성, Google·Apple은 비활성이다. 외부 제공자 자격 증명·callback·SMTP·수동 연결 설정을 현재 상태만으로 임의 구성하지 않았다. 비밀 자격 증명을 채팅에 요청하지 않았다.
- Google·Apple을 제외한 설정 점검과 누락 보완은 위 기록과 같다.

## 승인 후 적용 — 탈퇴 계정 자동 삭제 스케줄

사용자가 운영·QA 모두 활성화를 승인했다. 두 프로젝트에 `purge-deleted-accounts` 작업을 등록했다(각 job ID 2).

- 매일 한국시간 04:00. 양쪽 `cron.timezone=GMT` 기준 식은 `0 19 * * *`이다.
- 실행 SQL: `select public.purge_deleted_accounts();`. 함수 자체는 기존 정의를 유지한다.
- 취소되지 않았고 `purge_after <= now()`인 탈퇴 요청의 계정을 삭제한다. auth.users와 FK로 연결된 계정·저장 데이터가 영구 삭제되는 동작임을 승인 전에 알렸다.
- 등록 후 활성 상태·시간대·명령 일치·작업 실행 역할의 스키마 및 함수 권한을 확인했다. 같은 이름의 스케줄로 등록해 중복 작업을 만들지 않았다.
- 즉시 삭제 함수를 수동 실행하지 않았다. 초기화·재화 지급도 수행하지 않았다.
- 재현 SQL: 로컬 `output/ops-2026-11-02/enable-account-deletion-schedule.sql`.

검토용 SQL과 함수 정의 비교 파일은 로컬 `output/ops-2026-11-02/`에 보관했다.
