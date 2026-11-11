# 2026-11-10 마이그레이션 최신화

> 11월 10일 당시 기록이다. 운영 8개는 [2026-11-11 적용 완료 기록](migrations-2026-11-11.md)을 따른다.

## 현재 상태

**QA는 아래 8개 모두 적용 완료. 운영은 8개 모두 미적용.**

이번에 QA의 남은 `ops_schedule`과 새 `launch_at`을 적용했다. 운영의 첫 `ops_moderation` 적용 요청은
Supabase 실행 확인이 두 번 만료되어 실행되지 않았다. 재조회에서도 운영의 아래 이력은 0건이다.
이는 SQL 실행 오류나 자동 승인 심사의 거절이 아니라 도구 실행 확인 만료다.

- QA: `rscxzfdnbdmftortrcqt`
- 운영: `udujahnlyhedlrfbaaow`
- 게임 원본: `136e6bf6c91cb2096614ed88c3c03ab9ae4d5424` (v0.418.0)
- 어드민 원본: `c5823fcfe688c741e66c04a8929f4585d318e6d1`
- 이전 시점의 기록: [2026-11-09](migrations-2026-11-09.md)

## 적용 순서와 실제 이력

각 원본은 해당 저장소의 `supabase/migrations/` 아래에 있다. SQL 원문은 수정하지 않았다.
원격 버전은 실제 적용 시각이므로 파일명과 다르다. 이미 적용한 SQL을 파일명 차이 때문에 재실행하지 않는다.

| 순서 | 저장소 / 원본 | Git blob SHA | QA 실제 버전 | 운영 |
|---|---|---|---|---|
| 1 | Game / `20261120000000_ops_moderation.sql` | `63e61397378fad09406db51c59cb9381138810d3` | `20261109084123` | 미적용 |
| 2 | Admin / `20261120100000_ops_console_v3.sql` | `fd7e03c737ae4c31e6e60a6dc454173fe6272022` | `20261109084231` | 미적용 |
| 3 | Admin / `20261121000000_ops_console_v4.sql` | `9c36fdce72cf412659978b8afbede18ca0ed607e` | `20261109084300` | 미적용 |
| 4 | Game / `20261122000000_game_events.sql` | `f4968a3847830a7080fa81a0d90f1b5f76c3ba33` | `20261109084531` | 미적용 |
| 5 | Admin / `20261122100000_ops_analytics.sql` | `87cf74e432afcccec9be7748ac5ba9c819d42a02` | `20261109084548` | 미적용 |
| 6 | Game / `20261123000000_live_schedule.sql` | `baff18d40a9fcd8b4824838e7b59f2687c355f6c` | `20261109084602` | 미적용 |
| 7 | Admin / `20261123100000_ops_schedule.sql` | `6c2380efb3fe3d5a802f96041e3e2a42ef452109` | `20261110071057` | 미적용 |
| 8 | Game / `20261124000000_launch_at.sql` | `18037aa5485bb63fbec6635677be52683fe4e921` | `20261110071224` | 미적용 |

## 검증

네트워크를 차단한 임시 PostgreSQL 17에서 실제 Game 기본 마이그레이션, Admin recurring ops/v2,
위 8개를 순서대로 적용하고 표본 데이터로 동작과 권한 경계를 검증했다. 검사 후 컨테이너는 제거했다.

- 금칙어·프로필 조치 수신함/확인, 랭킹 제외/복구와 재등록 차단.
- 결제 기록·중복 환불 차단·회수 대기열, 조건별 대상 우편, 이상 징후 권한.
- 진행 계측·반복 저장 중복 방지·호출 집계·계측 오류 시 정상 저장 보존.
- 일정 설정/해제·기간 검증·감사 로그·공개 설정의 운영 메모 제외.
- 출시 전 `launch_at = null` 보존, 기존 공개 설정 필드와 일정 보존, 공개/서버 시각 일치.
- owner/operator/CS/viewer/일반 사용자 권한과 서버 전용 RPC 실행 권한.

재실행 자료는 [격리 DB 검사 안내](qa/ops-console-migration/README.md)에 있다.
공유 QA·운영 DB에서 표본 계정 생성, 실제 환불·우편 발송·제재·출시 초기화는 시험하지 않았다.

QA 원격 읽기 점검 결과:

- 신규 테이블 10개 존재, RLS 활성화 및 anon/authenticated 직접 접근 권한 위반 0건.
- 공개 일정과 서버 일정 일치, `launch_at`은 양쪽 모두 null.
- 일정 어드민 함수 3개 생성 및 내부 `private.admin_can` 검사 존재.
- 서버 전용 RPC는 일반 사용자 실행 불가, service_role 실행 가능.
- 일정/계측 어드민 조회 RPC는 anon 실행 불가.

최신 게임 원본에서 `npm run typecheck`, `npm test`, `npm run build` 모두 통과했다.
단위 테스트 466파일·5,306개 통과, 1개 건너뜀이다. 빌드는 기존 청크 크기 경고가 있으나 성공했고,
홈페이지 이벤트 5개와 운영 일정 ID 125개를 생성했다.
어드민도 `npm test` 44개, `npm run check`, `npm run build`가 통과했다.
화면 코드는 바꾸지 않았고 브라우저 E2E는 실행하지 않았다.

QA security advisor를 재조회했다. 내부 테이블의 정책 없음 안내는 RLS 활성화·직접 권한 회수와 함께 확인했다.
공개 설정/인증 RPC의 SECURITY DEFINER 경고, 기존 익명 로그인 정책 경고와 유출 비밀번호 보호 비활성 경고는 남아 있다.
이번 결과를 보안 경고 0건으로 해석하지 않는다.
참고: [DB advisor](https://supabase.com/docs/guides/database/database-linter),
[유출 비밀번호 보호](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## 남은 운영 적용

Supabase 실행 확인을 완료한 뒤 운영의 현재 이력과 사전 조건을 다시 확인하고 위 순서로 적용한다.
사전 조회 당시 기존 결제 영수증 backfill 대상은 0건, 기반 admin/mail 함수는 존재했고 새 테이블은 없었다.
적용 뒤 QA와 같은 스키마·권한·공개 설정 점검을 수행하고 실제 운영 버전을 이 표에 채운다.
그때 Admin README 및 v3/v4 문서의 운영 미적용 상태도 함께 갱신한다.

출시 시각을 수동 설정하거나 초기화 스크립트를 실행하지 않았다. 버전·개발 기록 파일도 수정하지 않았다.
