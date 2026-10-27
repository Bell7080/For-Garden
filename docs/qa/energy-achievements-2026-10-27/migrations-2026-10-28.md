# 최신 main 마이그레이션 적용 확인

- 기준: origin/main `8e3410f9` (v0.368.0), 로컬 작업 복원 후 v0.369.0으로 통합.
- 대상: forgarden-test (`rscxzfdnbdmftortrcqt`), forgarden-prod (`udujahnlyhedlrfbaaow`).
- 저장소의 SQL 원문을 변경하지 않고 테스트 → 운영 순서로 적용했다. 초기화용 ops SQL은 실행하지 않았다.

| 마이그레이션 | 테스트 적용 이력 | 운영 적용 이력 |
| --- | --- | --- |
| coupon_mailbox | 20261027214455 | 20261027214914 |
| guild_guard | 20261027214536 | 20261027214917 |
| guild_war_defense | 20261027214541 | 20261027214925 |

두 DB에서 적용 이력을 재조회해 세 항목의 기록을 확인했다. MCP가 기록한 실행 시각은 저장소 파일의 순번과 다르므로 이름과 실제 스키마를 함께 대조했다.

검증 SQL은 양쪽에서 다음을 확인했다.

- coupon_web_tickets·guild_war_defense 테이블 RLS 활성화.
- guild_members의 guard_day·guard_best·guard_at 열 3개 존재.
- 길드 RPC는 anon/authenticated 실행 금지, service_role 실행 허용.
- private 쿠폰 함수·서버 전용 티켓 조회 함수는 authenticated 실행 금지.
- 로그인 사용자의 티켓 발급 함수 실행 허용, anon 실행 금지.
- 실제 쿠폰을 소모하지 않는 잘못된 티켓 조회·사용 요청은 invalid_ticket으로 거절.
- 길드 1레벨 우두머리 0번 칸 허용, 우두머리 1번·미개방 일반 칸·잘못된 ID 거절.

Supabase 보안 advisor도 조회했다. 서버 전용 테이블의 정책 없음(RLS 기본 차단), 기존 공개/인증 RPC와 게스트 정책 등의 안내·경고가 남아 있다. 권한을 임의로 확장하거나 전체 정책을 바꾸지 않았으며, 이번에 추가한 서버 전용 RPC의 클라이언트 실행 금지는 별도 SQL로 검증했다.

- [RLS 활성화 후 정책 없음 안내](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [SECURITY DEFINER RPC 점검](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)

게임 서버 생성물 api/game.js·api/account.js는 최신 main과 에너지/업적 변경을 포함해 production 모드로 다시 생성했다.
