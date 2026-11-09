# 2026-11-09 마이그레이션 적용 기록

## 상태

**QA 6개 적용, QA 운영 일정 편집 1개 미적용. 운영 7개 미적용. 전체 배포 완료 기록이 아니다.**

원격 `supabase_migrations.schema_migrations`와 실제 스키마를 조회해 확인했다.
Supabase 도구의 실행 확인 만료·중단으로 `ops_schedule`은 실행되지 않았으며,
운영 적용은 QA의 마지막 단계 검증 전까지 진행하지 않았다.
이 기록의 파일명 시각과 원본 SQL의 파일명 시각은 서로 다른 축이다. 적용 여부는 아래 원격 버전으로 판단한다.

- QA: `rscxzfdnbdmftortrcqt`
- 운영: `udujahnlyhedlrfbaaow`
- 검증한 게임 원본: [ca7dc11c](https://github.com/Bell7080/For-Garden/tree/ca7dc11c0186c6820c8ba23dd793adba04d23a1c)
- 검증한 어드민 원본: [c5823fc](https://github.com/Bell7080/For-Garden-Admin/tree/c5823fcfe688c741e66c04a8929f4585d318e6d1)
- 게임 main `84372a72`에서도 아래 게임 SQL 3개의 blob SHA가 같은 것을 재확인했다.

## 원본과 적용 순서

파일은 각 저장소의 `supabase/migrations/` 아래에 있다. 원본 SQL을 수정하지 않고 적용했다.

| 순서 | 저장소 / 원본 파일 | Git blob SHA | QA 실제 버전 | 운영 |
|---|---|---|---|---|
| 1 | Game / `20261120000000_ops_moderation.sql` | `63e61397378fad09406db51c59cb9381138810d3` | `20261109084123` | 미적용 |
| 2 | Admin / `20261120100000_ops_console_v3.sql` | `fd7e03c737ae4c31e6e60a6dc454173fe6272022` | `20261109084231` | 미적용 |
| 3 | Admin / `20261121000000_ops_console_v4.sql` | `9c36fdce72cf412659978b8afbede18ca0ed607e` | `20261109084300` | 미적용 |
| 4 | Game / `20261122000000_game_events.sql` | `f4968a3847830a7080fa81a0d90f1b5f76c3ba33` | `20261109084531` | 미적용 |
| 5 | Admin / `20261122100000_ops_analytics.sql` | `87cf74e432afcccec9be7748ac5ba9c819d42a02` | `20261109084548` | 미적용 |
| 6 | Game / `20261123000000_live_schedule.sql` | `baff18d40a9fcd8b4824838e7b59f2687c355f6c` | `20261109084602` | 미적용 |
| 7 | Admin / `20261123100000_ops_schedule.sql` | `6c2380efb3fe3d5a802f96041e3e2a42ef452109` | 미적용 | 미적용 |

## 검증 결과와 한계

격리된 네트워크 없는 PostgreSQL 17 임시 컨테이너에서 실제 Game 기본 마이그레이션,
Admin recurring ops·v2, 위 7개를 순서대로 적용하고 표본 데이터로 검증했다. 컨테이너는 검사 후 제거했다.

- 금칙어 정규화, 프로필 초기화 수신함·확인 처리, 랭킹 제외·재등록 차단·복구.
- 결제 기록 트리거, 회수 대기열, 중복 환불 거절, 조건 우편 대상 제한.
- owner/operator/CS/viewer/일반 플레이어의 RPC 권한 경계.
- 행동 계측의 진행 변화·반복 저장 중복 방지·호출 수 집계와 집계 RPC.
- 계측 제약 오류가 정상 저장을 막지 않는 동작.
- 운영 일정 설정·해제·기간 검증·감사 로그·공개 응답의 운영 메모 제외.

QA 원격에서는 표본 쓰기 없이 다음을 재확인했다.

- 새 테이블 10개 모두 RLS 활성화 및 anon/authenticated 직접 SELECT/INSERT/UPDATE/DELETE 권한 없음.
- `get_public_config().schedule`과 `server_live_schedule()` 응답 일치, 공개 응답에 note/updatedBy 없음.
- `server_live_schedule()`은 일반 사용자 실행 불가, service_role 실행 가능.
- `admin_analytics(integer)`는 anon 실행 불가.
- `admin_list_schedule()`은 아직 존재하지 않음: 7번 미적용 상태와 일치.

게임 `ca7dc11c`에서 로컬 타입 검사는 통과했다. 전체 단위 테스트는 460파일 중 459 통과,
5,259개 중 5,254 통과·1 건너뜀·4 실패였다. 4개는 에셋 검사 실패다. 상세 로그는 실행 환경 복구 후 다시 확인해야 한다.
일반 빌드도 설정의 `git` 호출이 `spawnSync git EPERM`으로 차단됐다.
제한 해제 재시도는 중단되어 결과를 확인하지 못했으므로 **전체 테스트·빌드 통과로 기록하지 않는다**.
이후 실행 환경이 다시 준비 중이어서 로컬 재검증 결과를 회수하지 못했다.

QA security advisor도 조회했다. 새 내부 테이블의 정책 없음 안내는 RLS·직접 권한 회수와 함께 확인했다.
공개 설정 RPC 및 인증 사용자용 SECURITY DEFINER RPC의 노출 경고는 용도와 내부 권한 검사를 함께 검토해야 한다.
기존 유출 비밀번호 보호 비활성 경고도 남아 있다.
참고: [DB advisor](https://supabase.com/docs/guides/database/database-linter),
[유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

공유 QA·운영에서 실제 환불·우편 발송·프로필 초기화·계정 삭제·전체 초기화는 시험하지 않았다.
운영 일정 행과 삭제 스케줄러도 새로 설정하지 않았다.

## 이어서 할 일

1. QA 이력을 다시 읽고 7번만 적용한다. 이미 적용된 1~6번을 이력 이름 차이 때문에 재실행하지 않는다.
2. QA 일정 RPC의 생성·역할별 권한과 공개 설정 연동을 검증한다.
3. 운영의 현재 이력·사전 조건을 재확인한 뒤 같은 원본 1~7번을 적용하고 검증한다.
4. 로컬 환경 복구 후 전체 테스트·빌드 결과를 확인하고 이 기록의 운영 버전·검증 결과를 갱신한다.
5. 운영 적용이 끝나면 Admin README 및 v3/v4 문서의 운영 미적용 상태도 함께 갱신한다.

버전·개발 기록 파일은 이 적용 기록 변경에서 수정하지 않는다.
