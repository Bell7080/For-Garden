# Supabase 연동 계획

실서버 DB는 **Supabase(PostgreSQL)**로 간다. 이 문서는 "무엇을 어떤 순서로 붙이는가"만 정한다.
`FakeServer`가 클라이언트 안에서 돌기 때문에 성립하던 전제와 구멍은 `docs/server-migration.md`가
갖고, 이 문서는 그 항목을 **연동 단계로 묶은 로드맵**이다. 새 단계를 시작할 때는 두 문서를 함께 읽는다.

## 0. 전제

- **배포 형태.** Vercel 배포는 브라우저 테스트용이다. 출시는 Capacitor 등으로 포장한 모바일 앱이
  목표이고(PC는 Electron 가능), 어느 쪽이든 클라이언트는 번들이라 **수정된 클라이언트가 반드시
  나온다.** 재화 차감·가챠 난수·전투 결과 검증은 전부 서버가 한다. 클라이언트는 요청하고 그린다.
- **빌드 두 벌.** 일반 빌드(`npm run build`)는 실서비스, QA 빌드(`npm run build:qa`)는 테스트다
  (`src/core/buildFlavor.ts`의 `QA_TOOLS_ENABLED`). 치트·표본 친구·시작 재화·임시 지급은 QA에서만 선다.
- **Supabase 프로젝트도 두 개.** 운영(`forgarden-prod`)과 테스트(`forgarden-test`)를 따로 만든다.
  일반 빌드는 운영, QA 빌드는 테스트 프로젝트의 URL·anon key를 쓴다(Vercel 프로젝트별 환경변수).
  치트로 만든 계정이 운영 데이터에 섞이는 일을 구조로 막는다.
- **경계는 이미 있다.** 씬은 `GameApi`·`AccountApi`·`SocialApi`만 본다. 구현을 HTTP/Supabase로 갈아
  끼우되 DTO(`src/api/contracts.ts`)는 유지한다. 보안상 **인증 토큰은 `Session`·`SaveData`·
  `localStorage`에 넣지 않는다**(CLAUDE.md). 웹은 Supabase 세션 쿠키/HttpOnly 경로, 앱은 보안 저장소.
- **서버 시계가 기준이다.** 기기 시계로 재던 모든 만료·주기·쿨다운은 서버 `now()`로 옮긴다.

## 1. 우선순위

| 단계 | 내용 | 이유 | 관련 항목 (`server-migration.md`) |
| --- | --- | --- | --- |
| 1 | 프로젝트 2개 생성, 환경변수, 클라이언트 SDK 연결, 빈 `SupabaseGameApi` 골격 | 나머지 전부의 바닥 | — |
| 2 | **계정**: 게스트 + Google/Apple 로그인, 계정 ↔ `players` 행, 계정 전환 시 BootScene 재진입 | 모든 데이터가 계정에 묶인다 | 6 |
| 3 | **서버 시계 + 저장 동기화**: 서버 `now()`, 세이브 업로드/다운로드, 해시 충돌 팝업(`SaveConflictPopup`) | 클라이언트 시계 의존 제거 | 3, 6 |
| 4 | **지갑·인벤토리 상태 변경 API**: 재화 증감, 아이템 묶음(유통기한), 멱등 키 | 재화 조작을 서버가 소유 | 1, 4 |
| 5 | **가챠**: 서버 난수, 천장(pity) 서버 보관, 10연 트랜잭션 | 과금의 핵심, 난수는 서버에서만 | 5 |
| 6 | **성장**: 급여·한계 돌파·룬 세공/장착 | 재화 소모 경로 | 1 |
| 7 | **전투 결과 경계**: 입장 영수증 → 결과 재현(서버가 `core/skirmish.ts`를 같은 코드로 재생) | 승패·점수 위조 방지 | 2 |
| 8 | **임무·상점·우편·광고 보상** | 재화 유입 경로 | 1, 4 |
| 9 | **결제**: 스토어 영수증 검증(`fulfillPlatformPurchase`) | 출시 전 필수 | 11 |
| 10 | **친구**: 친구 목록/요청, 공개 프로필 DTO, 조력자 대여, 친구 포인트 | 소셜의 시작점 (표본 친구 제거) | — |
| 11 | **랭킹류**: 원정 주간 기록, 결투장(방어덱 스냅샷 조회), 레이드 기여 | 실제 이용자 데이터가 필요 | 12 |
| 12 | **레이드**: 공유 체력 게이지, 소환 레이드, 정산 | 다인 동시 갱신, 가장 까다롭다 | — |
| 13 | **길드** | 친구·랭킹 위에 올라간다 | — |
| 14 | **출시 전 정리**: 속도 제한, 재생 공격 방어, 치트 코드 번들 제거 확인 | 오픈 직전 점검 | 7, 9 |

단계 4~6은 재화가 오가는 곳이라 **멱등 키를 DB 제약(unique)으로** 만든 뒤에 연다.

## 2. 테이블 초안

- `players` (id = auth uid, uid 9자리, 닉네임, 레벨, 개시일, 하루 기준 시각들)
- `wallets` (player_id, 재화별 컬럼) — 모든 증감은 함수(RPC) 한 곳을 지난다
- `item_lots` (받은 묶음마다 기한), `runes`, `relic_progress`, `relic_fragments`
- `gacha_pity` (player_id, 그룹별 천장 상태)
- `idempotency_keys` (player_id, request_id, 결과 해시) — 같은 요청 중복 처리 방지
- `battle_receipts` (입장 영수증), `battle_results`
- `friends`, `friend_requests`, `public_profiles`
- `duel_state`, `duel_defense_snapshots`, `expedition_weekly`, `raid_instances`, `raid_contributions`
- 길드 테이블은 길드 기획이 나온 뒤 추가한다.

모든 테이블에 **RLS(행 단위 보안)**를 켠다. 클라이언트는 자기 행의 읽기만 허용하고, 변경은
서버 함수(Postgres 함수 또는 Edge Function)만 한다. 재화·가챠·전투 결과는 클라이언트가 직접
`insert/update`하지 못하게 정책을 닫는다.

## 3. 표본(가짜) 데이터의 운명

일반 빌드에서는 표본 친구·레이드 임시 참가자·시작 재화·임시 지급이 이미 꺼져 있다
(`PREVIEW_FRIENDS`, `mockRaid*`, 부트의 임시 지급 모두 `QA_TOOLS_ENABLED` 뒤). 아직 남은 것:

- **결투장 표본 상대**(`src/core/duelNpcPool.ts`, 240명): 결투가 상대 없이는 굴러가지 않아 일반 빌드에도
  남아 있다. 단계 11에서 방어덱 스냅샷 조회로 바꾸고, 상대가 모자랄 때를 위해 서버 쪽 보충 규칙을 정한다.
- **원정 순위 표본**(`FakeServer.expeditionRank`): 단계 11에서 주간 실기록으로 교체.
- 교체가 끝나면 해당 표본 모듈과 `docs/server-migration.md` 12절의 안내를 함께 지운다.

## 4. 단계마다 지킬 것

1. 새 서버 경계를 열 때는 `FakeServer` 구현과 같은 DTO를 쓰고, 단위 테스트로 계약을 고정한다.
2. 클라이언트에서 재화·난수·승패를 계산하던 경로가 남아 있으면 그 단계는 끝난 것이 아니다.
3. 테스트 프로젝트에서 먼저 켜고, QA 빌드로 확인한 뒤 운영 프로젝트에 같은 마이그레이션을 적용한다.
4. 마이그레이션(SQL)은 저장소에 파일로 남기고 두 프로젝트에 같은 순서로 적용한다. 대시보드에서
   손으로 고치지 않는다.
5. 단계가 끝나면 이 표에 ✅를 붙이고 `VERSION.md`에 남긴다.

## 5. 아직 정해지지 않은 것

- 길드 기획(규모, 길드 레이드 여부) — 정해지면 단계 13 갱신.
- 실시간 요구(친구 접속 표시, 레이드 체력 실시간 갱신)를 Supabase Realtime으로 할지 폴링으로 할지.
- 전투 재현 서버를 Edge Function(Deno)에서 돌릴지 별도 Node 서버에서 돌릴지 — `core/skirmish.ts`가
  Phaser 없는 순수 코드라 둘 다 가능하다. 재현 시간이 길면 Edge Function 제한에 걸릴 수 있다.
