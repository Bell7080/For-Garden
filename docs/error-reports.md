# 클라이언트 오류 자동 수집

플레이어 기기에서 난 오류를 Supabase `client_errors`에 모아 두고, 그 기록을 AI에게 넘겨 고치는 흐름이다.
(Sentry 같은 외부 서비스 대신 직접 구현한 이유: 전투 정산·검증 실패 같은 **도메인 오류**를 서버 판정 기록과 한 곳에서 보고, 무료 한도와 외부 전송을 피한다. 번들 소스맵 해석이 필요해지면 Sentry를 병행해도 충돌하지 않는다.)

## 무엇이 모이나

| 종류 | 코드 예 | 출처 |
| --- | --- | --- |
| 잡히지 않은 오류 / 처리 안 된 Promise 거절 | `window.error`, `window.rejection` | `installErrorReporter` (부트) |
| 프레임 오류 | `frame.error`, `frame.stuck` | `main.ts` guardFrame |
| 전투 결과 확정·검증 실패 | `battle.result.<phase>`, `raid.submit`, `expedition.nodeSettle` | `BattleScene` |
| 서버 5xx / 예상 밖 4xx | `api.5xx`, `api.4xx` | `RemoteGameApi` (재시도 후 최종 실패만) |
| SD·Puppet 표시 실패 | `puppet.display`, `puppet.load` | 각 팝업·씬 |
| 삼켜지던 저장·진행 호출 | `story.applyChoice`, `archaeology.selectSite` … | `reportCatch` |

모든 행에 **앱 버전·빌드(production/qa)·현재 화면·최근 조작 20개(화면 이동·팝업 제목)·맥락(모드·스테이지 ID 등)**이 붙는다.
토큰·이메일·긴 식별자·주소의 질의 문자열은 보내기 전에 지운다(`core/errorReport.ts`). 저장 데이터 본문은 보내지 않는다.

## 새 오류 지점에 붙이는 법

- `console.error` 대신 `logError("영역.무슨일", "라벨", error, { 맥락 })`.
- `.catch(() => undefined)`로 삼키는 **상태를 바꾸는 호출**은 `.catch(reportCatch("영역.무슨일"))`.
- 코드는 `영역.무슨일` 꼴. 같은 코드·같은 스택은 서버가 한 줄로 묶는다.
- 맥락은 평평한 문자열·숫자·불리언만(중첩은 버려진다). 개인 정보를 넣지 않는다.
- 개발 서버(DEV)와 E2E(test)는 보내지 않는다. 서버에 연결되지 않은 빌드는 조용히 버린다.

## 남용 방지

- 클라이언트: 세션당 20건, 같은 오류는 한 번만, 1.5초 간격(`ReportThrottle`).
- 서버(`report_client_error`): 계정당 시간당 30건, 필드 길이 상한, 새 오류 종류 5,000개 상한(넘으면 새 종류만 거절). 로그인한 계정만.
- 읽기는 owner/operator 직원만(RLS). `launch_reset.sql`이 출시 전 비운다.

## 보는 법 → AI에게 넘기는 법

1. 운영 DB SQL 편집기에서 `supabase/ops/client_errors_top.sql`을 실행한다(열린 오류 상위 10건이 글로 나온다).
2. 결과의 `report` 칸을 그대로 AI에게 붙여 "이 오류를 고쳐 줘"라고 한다. 스택·버전·화면·최근 조작·맥락이 모두 들어 있다.
3. 고친 뒤 `select public.admin_set_client_error_status(<id>, 'fixed', '메모');`. 고친 버전과 **다른 버전에서 다시 나오면** 자동으로 `open`으로 돌아온다.
4. 의미 없는 오류는 `'ignored'`.

관리자 페이지(For-Garden-Admin)에 목록 탭을 붙이는 것은 다음 단계다. 표·함수는 이미 그 용도로 준비돼 있다.

## 적용

마이그레이션 `20261116000000_client_errors.sql`은 파일로만 올려 두었다. 운영 DB 적용은 사람이 한다
(적용 전에는 클라이언트의 보고가 `report_client_error` 부재로 조용히 실패할 뿐 게임에는 영향이 없다).
