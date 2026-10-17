# 출시 전 전체 초기화 — 베타 운영 DB를 0으로 되돌리는 절차

운영 DB(`forgarden-prod`)를 먼저 만들어 베타 시연에 쓰고, **정식 오픈 직전에 한 번 전부 0으로 비워** 모두가
같은 출발선에서 시작한다. 이 문서는 그 "비우는 한 번"의 설계와 절차다. 테스트 잔재가 정식 오픈에 하나라도 남지
않는 것이 목표이므로 **지우는 쪽이 아니라 남기는 쪽을 목록으로 관리한다** — 목록에 없는 표는 스크립트가 지우지
않고 멈춘다.

## 1. 환경 구조 (결정)

| | 정식 주소 | QA 주소 |
| --- | --- | --- |
| Vercel 프로젝트 | 포가든 (`forgarden.vercel.app`) | `forgarden-test` |
| 빌드 모드 | 일반 빌드 (치트·표본 없음) | QA 빌드 (`FORGARDEN_BUILD` 또는 프로젝트 주소로 자동 선택, `scripts/vercel-build.mjs`) |
| Supabase | **`forgarden-prod`** (베타 시연 → 출시 직전 초기화) | **`forgarden-test`** (영구 테스트용) |
| 검증용 익명 계정·가짜 데이터 | 만들지 않는다 | 여기에만 둔다 |

- 두 Vercel 프로젝트의 환경변수 `SUPABASE_URL`·`SUPABASE_SERVICE_ROLE_KEY`·`VITE_SUPABASE_URL`·`VITE_SUPABASE_PUBLISHABLE_KEY`를
  **각각 자기 DB의 값**으로 둔다. 정식 주소가 테스트 DB를 보고 있다면 이 구조가 아니다(v0.311.0 시점에는 그랬다).
- 치트·표본(`QA_TOOLS_ENABLED`)은 일반 빌드에 없으므로 정식 주소에서 가짜 계정이 저절로 생기지는 않는다. 그래도
  베타 동안 운영 DB에서 사람이 직접 만든 계정·우편·쿠폰·문의는 생기므로 초기화가 필요하다.
- 마이그레이션은 `supabase/migrations`가 원본이다. 운영 DB에도 테스트 DB와 같은 순서로 적용한다
  (홈페이지의 `website_*` 표 — `For-Garden-Web/supabase/migrations/202610160001_website.sql` — 가 가장 먼저).

## 2. 계정 권한이 필요한 일 (응태가 한다)

1. Supabase에서 `forgarden-prod` 프로젝트를 만든다(서울 리전).
2. SQL 편집기로 마이그레이션을 순서대로 적용한다: 홈페이지 `202610160001_website.sql` → 이 저장소의
   `supabase/migrations/*.sql`을 파일명 순서로 전부(`20261020000000_launch_epoch.sql` 포함).
   - `20261019000000_guild_basics.sql`은 본문에 `delete`가 든 함수 두 개(`server_guild_members_call`·`server_guild_call`) 때문에
     테스트 DB에서 SQL 도구가 확인 창을 기다리다 시간이 초과됐다. 운영 DB에서는 편집기에서 직접 실행하면 된다.
3. Auth 설정을 테스트 프로젝트와 같게 맞춘다(익명 로그인 허용 등).
4. 운영자 계정을 만들고 `admin_roles`에 역할을 넣는다(owner 한 명 이상). **초기화 때 이 계정들만 남는다.**
5. 포가든 Vercel 프로젝트의 환경변수 네 개를 `forgarden-prod` 값으로 바꾸고 **재배포**한다. `forgarden-test`는 그대로 둔다.
6. (지금 테스트 DB 정리) 길드 마이그레이션의 남은 함수 두 개를 편집기에서 직접 실행하고, 시험 삼아 만든 함수를 지운다:
   ```sql
   drop function if exists public.server_guild_probe(uuid);
   ```
   검증용 익명 계정은 테스트 DB에 두는 것이 이 구조의 취지이므로 정리할 필요가 없다.

## 3. 베타 동안 지킬 것

- 베타 참가자에게 **정식 오픈 전에 모든 진행이 초기화된다**고 알린다(공지 + 약관). 초기화는 되돌릴 수 없다.
- 새 마이그레이션이 **표를 만들면 같은 변경에서 `supabase/ops/launch_reset.sql`과 `launch_reset_verify.sql`의 목록에
  `reset`/`ops`/`keep` 중 하나로 분류를 더한다.** 안 하면 `tests/unit/launchReset.test.ts`가 실패한다.
  - 플레이어·거래·기록이면 `reset`. 사람이 만든 운영 콘텐츠면 `ops`. 테스트가 아닌 실제 데이터·설정이면 `keep`.
  - 표를 만들 때 `public` 밖의 스키마를 쓰면 그 스키마도 점검 대상이다(시스템 스키마 목록 밖이면 멈춘다).
  - 독립 시퀀스(표에 딸리지 않은 것)는 만들지 않는다 — 처음으로 되돌릴 수 없어 스크립트가 멈춘다.
- **결제 기록 표가 생기면**(영수증·거래) 실제 결제 흔적을 지울 수 있는지 먼저 정책을 정한다. 스토어 테스트 구매(샌드박스)는
  서버 DB 밖에 남으므로 이 스크립트가 지우지 못한다. 결제 연동 전까지는 해당 없음.
- 저장소(Storage)에 플레이어 파일을 올리는 기능이 생기면 보존 버킷(`notice-images`) 말고 다른 버킷을 쓰게 되어
  초기화가 멈춘다 — 그때 파일 비우기를 절차에 넣는다.

## 4. 무엇이 지워지고 무엇이 남나

| 구분 | 표/대상 | 처리 |
| --- | --- | --- |
| 계정 | `auth.users`(운영자 제외), 세션·토큰·연결 계정·인증 로그 | **삭제.** `admin_roles`에 있는 운영자만 남김 |
| 플레이어 | `players`, `player_saves`, `player_assets`, `asset_ledger`, `request_receipts` | 삭제 + 번호(UID `100000001`부터, 장부 번호)를 처음부터 다시 셈 |
| 소셜 | `server_*` 8개(친구·대여 포인트·속도 제한·영수증·레이드) | 삭제 |
| 길드 | `guilds`, `guild_*` 5개 | 삭제 |
| 문의 | `support_tickets`, `support_messages`, `support_limits` | 삭제 |
| 감사·제한 | `admin_audit_log`, `website_registration_limits` | 삭제 (초기화 기록 한 줄만 새로 남음) |
| 운영 콘텐츠 | `mails`, `coupons`, `coupon_codes`, `mail_claims`, `coupon_redemptions`, `coupon_attempts` | 기본 삭제. 오픈용으로 미리 준비해 뒀다면 `p_purge_ops_content := false`로 정의는 남기고 **사용 흔적(쿠폰 사용 횟수·단일 코드 사용 표시·수령 기록)은 되돌림** |
| 보존 | `admin_roles`, `app_config`, `reward_assets`, `website_notices`(+번역), `website_preregistrations`, 공지 이미지 버킷 | **그대로.** 사전 등록자 이메일은 실제 사람의 데이터라 지우지 않는다 |
| 기기 | 브라우저/앱에 남은 게스트 토큰·서버 연결 표식·로컬 저장 | 서버 `launch_epoch`가 바뀐 것을 본 클라이언트가 처음 한 번 지우고 다시 시작한다(`src/api/launchEpoch.ts`) |

공지(`website_notices`)와 보존 대상에 테스트 문구가 남아 있는지는 사람이 본다 — 점검 SQL이 `review` 줄로 건수를 보여 준다.

## 5. 실행 절차 (오픈 직전)

되돌릴 수 없다. 아래를 순서대로 하고, **초기화는 오픈 전 점검의 맨 마지막 단계다** — 초기화 뒤에 운영 DB로 스모크
테스트를 하면 그 계정이 새 잔재가 된다(했다면 다시 초기화한다. 점검 SQL이 그 계정을 잔재로 잡는다).

1. **백업.** Supabase 대시보드에서 지금 시점의 백업을 받는다(PITR이 있으면 시각을 적어 둔다). 되돌릴 유일한 길이다.
2. **점검 모드 켜기.** 어드민 > 운영 설정에서 점검을 켠다. 스크립트는 점검이 꺼져 있으면 실행을 거절한다.
3. **저장소 확인.** Storage에서 `notice-images` 말고 파일이 있으면 대시보드/API로 비운다(SQL로 지우면 파일이 고아로 남는다).
4. **dry-run.** `supabase/ops/launch_reset.sql` 전체를 SQL 편집기에 붙여 **기본값 그대로** 실행한다.
   `DRY-RUN 완료: 아무것도 바뀌지 않았습니다` 오류와 함께 표별 삭제 건수·보존 건수·새 `launch_epoch`가 나온다.
   실제 삭제까지 해 본 뒤 되돌리므로 외래키 같은 실패도 여기서 드러난다. **이 DB가 맞는지 건수로 확인한다.**
   - `UNCLASSIFIED_TABLES`/`MISSING_TABLES`/`STANDALONE_SEQUENCES`/`STORAGE_NOT_EMPTY`가 나오면 아무것도 지우지 않은 것이다.
     메시지가 가리키는 대로 고치고(목록에 분류 추가·저장소 비우기) 다시 dry-run을 한다.
5. **실행.** 같은 스크립트의 `[실행 값]` 네 줄을 고쳐 다시 실행한다.
   ```
   p_mode := 'execute';
   p_confirm := 'RESET-FORGARDEN-LAUNCH';
   p_expect_players := <dry-run이 알려 준 players 행 수>;
   p_purge_ops_content := true;   -- 미리 준비한 우편·쿠폰을 남기려면 false
   ```
   한 트랜잭션이라 도중에 실패하면 아무것도 바뀌지 않는다. 가드는 넷이다: 확인 문구, 행 수 대조(다른 DB에 붙은 실수 방지),
   점검 모드, 그리고 모든 표의 분류. 끝에 같은 트랜잭션 안에서 결과(비었는지·UID가 1부터인지·시퀀스가 처음인지)를 다시
   확인하고 어긋나면 전체를 되돌린다.
6. **점검.** `supabase/ops/launch_reset_verify.sql`을 실행한다. 맨 위 `ALL` 줄이 `true`여야 하고 `false` 줄이 없어야 한다.
   `review` 줄(남긴 공지·사전 등록자·점검 플래그)은 눈으로 본다.
7. **오픈용 콘텐츠 준비.** 환영·보상 우편, 쿠폰, 공지를 이제 만든다(5번에서 `purge=false`로 남긴 경우는 이미 있다).
8. **점검 모드 끄기 → 오픈.** 베타 기기는 처음 열 때 `launch_epoch`가 달라진 것을 보고 옛 토큰·저장을 지운 뒤 한 번 다시
   시작한다. 새 기기는 아무 일도 없다.

초기화를 다시 해야 하면 같은 절차를 처음부터 반복한다. 스크립트는 몇 번을 돌려도 같은 상태가 된다.

## 6. 누락을 잡는 네 겹

1. **정적 테스트** — `tests/unit/launchReset.test.ts`: 마이그레이션이 만드는 모든 표가 목록에 분류돼 있는지, 목록의 표가 실제로
   있는지, 두 SQL(초기화·점검)의 목록이 같은지, `CASCADE`가 없는지. 새 표를 만들고 분류를 빠뜨리면 여기서 실패한다.
2. **스크립트 자체 가드** — 운영 DB의 실제 카탈로그를 읽어 분류되지 않은 표·없는 표·독립 시퀀스·남은 저장소 파일이 있으면
   아무것도 지우지 않고 멈춘다(마이그레이션을 거치지 않고 손으로 만든 표도 잡는다).
3. **DB 통합 테스트** — `npm run test:launch-reset`: 임시 PostgreSQL에 모든 마이그레이션을 적용하고 모든 표에 표본을 넣은 뒤
   dry-run → 가드 → 실행 → 점검 → 재실행을 돌린다. 표본이 없는 표가 있어도 실패한다(`supabase/tests/launch-reset-seed.sql`).
4. **점검 SQL** — 실행 직후 그리고 오픈 직전에 읽기 전용으로 잔재를 센다.

## 7. 이 스크립트가 지우지 못하는 것 (사람이 확인)

- **백업·PITR에 남은 과거 데이터** — 보존 기간이 지나야 사라진다. 개인정보 관점에서 필요하면 기간을 확인한다.
- **스토어 샌드박스 구매·광고 테스트 기록**, Vercel 로그/Analytics 같은 DB 밖의 흔적.
- **보존 대상 안의 테스트 문구** — 공지 본문, `reward_assets` 상한, `app_config`의 점검 문구·버전 값.
- **For-Garden-Web·For-Garden-Admin 저장소의 `supabase/migrations` 사본** — 원본은 이 저장소이며, 새 마이그레이션이 생기면 사본을 맞춘다.
- 이 저장소의 로컬 저장 키(`eternal-city.*.local-save`)는 `launch_epoch` 비교로 한 번 지워지지만, 키 이름을 바꾸는 방식의 일괄
  초기화(`docs/release-fixture-cleanup.md`의 "출시 전환 점검")를 함께 하면 더 확실하다 — 둘은 겹쳐도 해가 없다.

## 8. 세대(`launch_epoch`)의 약속

- `app_config.launch_epoch`: 초기화마다 `YYYYMMDDTHHMMSS-xxxxxxxx` 새 값. 한 번도 안 했으면 빈 문자열. `get_public_config()`가 돌려준다.
- 클라이언트(`reconcileLaunchEpoch`): 기기에 적어 둔 세대와 서버 값이 다르면 게스트 토큰·서버 연결 표식·이 빌드의 로컬 저장을
  지우고 새 세대를 적는다. 세대를 적은 적 없는 기기는 `""`로 보므로 이 기능 이전부터 테스트한 기기도 걸러진다. 지운 것이 있을
  때만 앱을 다시 시작한다. 서버가 값을 주지 않으면(`""`, 네트워크 실패 포함) 아무것도 지우지 않는다.
- 설정·언어처럼 로컬 저장에 든 기기 취향도 함께 처음으로 돌아간다. 의도한 동작이다.
