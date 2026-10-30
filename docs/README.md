# 문서 안내

현재 구현을 확인할 때 정식 안내부터 읽는다. 과거 실행 로그의 버전·승률·미구현 목록을 현재 상태로 사용하지 않는다.

| 확인할 내용 | 기준 문서 |
| --- | --- |
| 계정 로그인·동일 UID 연동·약관/탈퇴 | [계정 로그인](account-login.md) |
| 서버 계약·남은 출시 요구 | [실서버 계약](server-release.md), [서버 전환](server-migration.md), [출시 차단 목록](release-fixture-cleanup.md) |
| DB 적용 여부·원격 버전·원본 해시 | [Supabase 적용 이력](../supabase/README.md#적용-이력) |
| 길드 구현과 남은 작업 | [길드 계획](guild-plan.md) |
| 고대 지층의 구조·재검수 경로 | [고대 지층](ancient-strata-varied-trials.md) — 과거 수치는 조건을 확인하고 읽는다 |
| CC 검사 도구와 해석 | [CC 점검](cc-density-audit.md), [적 AI 수정](enemy-utility-ai-fix-2026-10-26.md) |
| 클라이언트 오류 수집 | [오류 보고](error-reports.md) |

`qa/`는 실제 검증 근거와 재실행 도구다. 관련 문제를 재현할 때 해당 자료만 읽으며, 스크린샷·측정 시점의 결과를 현재 검사 통과로 재표기하지 않는다. 정식 안내·회귀 검사로 대체된 인증 임시 메모와 폐기된 고대 지층 v1 자료는 제거했다. 버전 이력과 개발 규칙, DB 적용 이력 및 아직 유효한 검증 근거는 유지한다.
