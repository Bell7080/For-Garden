# 2026-10-28 최신 마이그레이션 적용 확인

- 기준 main: `ecd3ab4c` (v0.376.1).
- 대상: QA `rscxzfdnbdmftortrcqt`, 운영 `udujahnlyhedlrfbaaow`.
- 누락된 `supabase/migrations/20261110000000_guild_shop_tabs.sql` 원문을 QA 검증 후 운영에 적용했다.
- SHA-256: `635e852d6859997c802c7fd15d1c07c4b02e048181400dd3559d8caa01b55b01`.

| 항목 | QA 적용 이력 | 운영 적용 이력 |
| --- | --- | --- |
| guild_shop_tabs | 20261028024941 | 20261028025220 |
| expedition_rank_pool (기적용 확인) | 20261028002044 | 20261028002132 |

기존 coupon_mailbox·guild_guard·guild_war_defense도 양쪽에 적용되어 있다. 저장소 SQL 순번과 MCP 실행 시각은 다르므로 이름과 실제 스키마를 함께 확인했다.

## 검증

- QA에서 임시 사용자·길드로 상점 상품 6개와 가격, 월간 화석 한도, 주간 희귀 룬 한도, Lv.10 길드 보급 제한을 실제 RPC 호출로 검증했다.
- 같은 요청 재전송 시 코인을 다시 차감하지 않고, 주간·월간 구매 한도가 서로 독립적으로 초기화되는 것을 확인했다. 잘못된 requestId와 코인 부족도 거절된다.
- 새 상점 래퍼에서 기존 getGuild 호출이 정상 위임된다. 검증 트랜잭션은 모두 ROLLBACK했다. 재실행 SQL은 `docs/qa/guild-shop-2026-10-28/checks.sql`이며 QA 전용이다.
- 운영에는 검증용 계정이나 구매를 생성하지 않고 상품표·열·함수·권한을 읽어 확인했다.
- 관련 여섯 함수의 정의 MD5가 두 DB에서 일치한다. 빈 search_path와 service_role 실행 권한을 유지하며 anon/authenticated 실행은 금지되어 있다. guild_members RLS도 활성 상태다.
- 단위 회귀 49개와 production/qa/test 저장·디버그 분리 및 출시용 fixture 차단 검사를 통과했다.

## 서버 배포 확인

- 운영 `dpl_3rT3gMfa4o8YXtsym6NepK6eas2D`, QA `dpl_BrSmcBDrLRbRP8fKujB65qDs9tDC`가 기준 커밋으로 READY 상태다.
- 두 빌드 로그에서 각각 production/qa 모드와 api/game.js·api/account.js 재생성을 확인했다. 운영 API의 GET 요청은 예상대로 405와 Allow: POST로 응답했다.
- 저장소의 production 서버 생성물도 최신 소스에서 재생성했다. 실제 로그인 사용자의 브라우저 구매 흐름은 이번 DB 검증에 포함하지 않았다.

Supabase 보안 Advisor도 양쪽에서 조회했다. 기존 서버 전용 표의 RLS 정책 없음, 공개/인증 RPC, 익명 로그인, 비밀번호 유출 방지 설정 안내가 남아 있다. 이번 상점 함수의 클라이언트 실행 금지는 별도 SQL로 확인했고 기존 인증 정책을 임의 변경하지 않았다.

- [RLS 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER 실행 권한 안내](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
