import { registerDataText } from "../i18n";
import { requiredBreakthroughForLevel } from "../core/levelDesign";

/**
 * 레이드 — **경쟁이 아니라 함께 미는 보스전**이다.
 *
 * 맨 위에 서는 것은 **월드 폭주**다. 시스템만 여는 하루 한 마리이고, 모든 플레이어가 체력 한
 * 줄을 함께 깎는다. **잡지 못해도 된다** — 서버 전체가 깎은 비율마다 모든 플레이어에게 보상이
 * 얹히고(`RAID_WORLD_REWARD_STAGES`), 내 몫은 하루 두 판의 피해 합으로 따로 받는다. 그 아래
 * 친구가 소환한 레이드는 다음 단계에서 붙는다.
 *
 * 원정의 폰토스가 "내 한 판이 몇 점인가"를 겨루는 자리라면, 레이드는 시즌 하나가 **보스 한
 * 마리의 공유 체력**을 갖고 참가자 전원의 피해가 그 한 줄을 깎는다. 그래서 화면이 먼저 말하는
 * 것은 내 순위가 아니라 **얼마나 남았나**이고, 목록은 순위표가 아니라 기여 목록이다.
 *
 * 보스는 **수쿠스이노**다. 이 콘텐츠를 위해 만든 첫 전용 개체이고, 공멸이 풀어 놓은 폭주
 * 병기라 "함께 밀어야 하는 표적"이라는 자리와 설정이 맞물린다. 코마가 이 자리를 임시로
 * 맡던 때는 1장 마지막 관문의 중간보스가 시즌 보스를 겸해, 한 얼굴이 두 콘텐츠에서 서로
 * 다른 무게로 섰다 — 폰토스를 쓰지 않는 이유와 같다.
 */

/**
 * 시즌 보스의 성장 스냅샷.
 *
 * **스테이지와 같은 문법을 쓴다** — 태생 능력치에 손대지 않고 레벨 하나만 적는다. 레이드 전용
 * 배율이나 숨은 보정을 만들지 않는 이유는 관문을 조일 손잡이가 둘이 되는 순간 화면에 선
 * `LV.n`과 실제로 맞는 수치가 갈리기 때문이다. **여기 적힌 수가 곧 화면에 서는 레벨이다** —
 * 유형이 레벨을 얹던 때(`endless` +8)는 40이라 적어 두고 48이 서 있었다.
 *
 * **월드 폭주는 만렙(60)이다.** 돌파 네 칸이 모두 열리는 자리라, 보스가 한계 돌파로 얻는 기술이
 * 전부 드러나는 유일한 판이다(지금은 네 칸 모두 "없음"이다).
 *
 * **몸집과 걸음은 여기 적지 않는다.** 거대하고 느린 것은 이 개체의 성질이 아니라 **레이드라는
 * 자리의 성질**이라 유형 표(`ENCOUNTER_ROLE.endless`)가 갖는다 — 개체에 적으면 같은 몸이
 * 도감과 관문에 설 때까지 함께 느려진다.
 */
const RAID_SEASON_BOSS_LEVEL = 60;

export const RAID_SEASON_BOSS = {
  relicId: "sukusuino",
  level: RAID_SEASON_BOSS_LEVEL,
  /**
   * **돌파는 레벨에서 나온다**(`requiredBreakthroughForLevel`). 2로 적어 두었을 때는 정보창이
   * `48 / 40`을 세워 상한을 넘긴 레벨을 말했다 — 적도 플레이어와 같은 성장 축을 지나야 한다.
   */
  breakthrough: requiredBreakthroughForLevel(RAID_SEASON_BOSS_LEVEL),
} as const;

/**
 * 서버 검증이 허용하는 전투 길이와 입력량 상한이다.
 *
 * 마지막 단계의 처형 피해는 **제한 시간을 전멸로 바꾸는 장치**이지 난이도가 아니다 — 보스는
 * 판 안에서 죽지 않고(공유 체력은 서버가 갖는다) 90초가 지나면 판이 끝나야 하는데, 재현이
 * 인정하는 종료는 전멸 하나뿐이기 때문이다. 원정 보스와 같은 방식이다.
 */
export const RAID_BOSS_BALANCE = {
  maximumDurationMs: 100_000,
  maximumActions: 2_000,
  maximumAcceptedScore: 100_000_000,
  phases: [
    { startsAtMs: 0, attackPerSecond: 0, label: "교전" },
    { startsAtMs: 30_000, attackPerSecond: 0, label: "격화" },
    { startsAtMs: 60_000, attackPerSecond: 0, label: "최후" },
    { startsAtMs: 90_000, attackPerSecond: 1_000_000_000, label: "철수" },
  ],
} as const;

/**
 * 월드 폭주 하루치의 공유 체력 — **레전드급**이다.
 *
 * 한 판의 피해는 실측으로 0.8만~2.6만(LV40~60 편성, 수쿠스이노 LV60)이고 한 사람이 하루 두 판을
 * 치므로 인당 2~5만이다. 체력은 그 수백 배라 **모두가 함께여야** 비로소 줄이 움직이고, 날마다
 * 다 깎이지 않을 수 있다 — 그것이 의도다. 깎은 비율만큼 모두에게 보상이 얹히므로 못 잡은 날도
 * 헛수고가 아니다.
 */
export const RAID_SEASON_TOTAL_HP = 10_000_000;

/**
 * 시즌 게이지와 **한 판에 서는 보스가 같은 몸**이라는 것을 말하는 배율이다.
 *
 * 보스의 최대 체력을 태생 성장으로만 구하던 때는 판 안의 몸이 1만이었다. 시즌 줄은 1,000만인데
 * 전장의 줄은 1만이라, 한 판에서 반이나 깎아 놓고 시즌 화면에 돌아오면 게이지가 미동도 하지
 * 않았다 — 두 줄이 **다른 단위**였기 때문이다. 그래서 판에 서는 보스의 체력을 시즌 게이지에서
 * 거꾸로 구한다: 시즌 줄의 100분의 1이 한 판의 보스이고, 그 위에서 깎은 만큼이 그대로 기여다.
 *
 * 400인 이유는 **하루 두 번짜리 도전 한 판이 판 안의 보스를 눕히지 못하되 눈에 보이게는 밀어야**
 * 하기 때문이다. 1(게이지와 같은 몸)이면 한 판의 몫이 줄에서 보이지 않고, 1,000이면 첫 판에
 * 판 안의 보스가 통째로 넘어가 90초를 채울 이유가 사라진다.
 *
 * **100이던 때는 출혈이 아니면 줄이 움직이지 않았다.** 판 안의 몸이 10만이라 출혈 없는 편성은
 * 한 판에 줄의 4~6%만 깎았고, 출혈(최대 체력 비례)만 그 10만을 기준으로 재어 혼자 줄을
 * 비웠다. 비율 피해는 이제 성장 체력에서 재고(`raidBossPercentHpBasis`), 몸은 2만 5천이라
 * 실측으로 편성에 따라 한 판에 줄의 13~27%를 민다(레벨 40 · 돌파 2 파티, 출혈과 타격이 같은 자릿수).
 */
export const RAID_BOSS_HP_SCALE = 400;

/**
 * 하루에 도전할 수 있는 횟수다. UTC 날짜 경계로 초기화한다.
 *
 * **두 판이다.** 내 기여는 그 두 판의 피해 합이고, 한 판만 쳐도 그 몫만큼은 받는다.
 */
export const RAID_DAILY_ATTEMPTS = 2;

/**
 * 내 기여 보상 — **오늘 두 판의 피해 합**이 문턱을 넘긴다.
 *
 * 순위가 아니라 합이 문턱을 넘기는 이유는 협력전이라 늦게 들어온 사람도 같은 길을 걷게 하려는
 * 것이다. 문턱은 한 판 실측(0.8만~2.6만)에서 잡았다 — 첫 문턱은 약한 편성의 한 판이면 넘고,
 * 마지막은 강한 편성이 두 판을 다 쳐야 닿는다. 단계 ID가 서버의 중복 수령 키이며 날마다 새로 열린다.
 */
export const RAID_CONTRIBUTION_REWARD_STAGES = [
  { id: "raid-daily-8k", threshold: 8_000, reward: { currency: "raidSigil", amount: 5 } },
  { id: "raid-daily-16k", threshold: 16_000, reward: { currency: "raidSigil", amount: 10 } },
  { id: "raid-daily-28k", threshold: 28_000, reward: { currency: "raidSigil", amount: 15 } },
  { id: "raid-daily-45k", threshold: 45_000, reward: { currency: "raidSigil", amount: 20 } },
] as const;

/**
 * 월드 진행 보상 — 서버 전체가 깎은 **비율**이 문턱을 넘기면 **모든 플레이어**에게 한 번씩 열린다.
 *
 * 보스를 잡지 못해도 된다는 것이 이 표의 뜻이다. 처치 보상을 따로 두지 않고 마지막 단계(100%)가
 * 그 몫을 맡는다 — 둘을 가르면 "다 깎은 날"에 같은 일로 보상이 두 번 나간다. 참가하지 않은
 * 사람도 받는다: 다 같이 민 결과이고, 오늘 못 친 사람이 내일 다시 들어올 이유가 된다.
 *
 * 하루 합계는 내 기여(최대 50)와 월드 진행(최대 60)을 더해 110이다 — 한 주로 보면 예전 주간
 * 시즌의 몫(약 440)과 비슷해 전리품 상점의 물가를 흔들지 않는다.
 */
export const RAID_WORLD_REWARD_STAGES = [
  { id: "raid-world-25", ratio: 0.25, reward: { currency: "raidSigil", amount: 5 } },
  { id: "raid-world-50", ratio: 0.5, reward: { currency: "raidSigil", amount: 10 } },
  { id: "raid-world-75", ratio: 0.75, reward: { currency: "raidSigil", amount: 15 } },
  { id: "raid-world-100", ratio: 1, reward: { currency: "raidSigil", amount: 30 } },
] as const;

/**
 * 모의 참가자 명단.
 *
 * 백엔드가 없어 지금은 이 표가 함께 미는 사람들을 대신한다 — **추후 길드원과 친구로 교체한다.**
 * 이름은 계정 이름이라 번역하지 않고(친구 표본과 같은 규칙), `favoriteRelicId`만 줄 왼쪽의
 * 얼굴이 된다. `pace`는 그 사람이 하루에 내는 피해의 상대 배율이라 목록이 늘 같은 순서로
 * 굳지 않는다.
 */
export const RAID_MOCK_PARTICIPANTS = [
  { id: "raider-haneul", displayName: "하늘정원", favoriteRelicId: "rex", pace: 1.32 },
  { id: "raider-moss", displayName: "이끼연구소", favoriteRelicId: "anky", pace: 0.71 },
  { id: "raider-viola", displayName: "비올라", favoriteRelicId: "spino", pace: 1.18 },
  { id: "raider-kettle", displayName: "주전자", favoriteRelicId: "luka", pace: 0.94 },
  { id: "raider-noon", displayName: "정오의표본", favoriteRelicId: "dodo", pace: 1.07 },
  { id: "raider-dust", displayName: "먼지떨이", favoriteRelicId: "tia", pace: 0.62 },
  { id: "raider-ember", displayName: "잔불", favoriteRelicId: "stella", pace: 1.24 },
  { id: "raider-quartz", displayName: "석영", favoriteRelicId: "meron", pace: 0.88 },
  { id: "raider-tidal", displayName: "밀물", favoriteRelicId: "pachi", pace: 1.02 },
  { id: "raider-orchid", displayName: "난초", favoriteRelicId: "maki", pace: 0.79 },
  { id: "raider-cinder", displayName: "재", favoriteRelicId: "keris", pace: 1.15 },
  { id: "raider-fern", displayName: "고사리", favoriteRelicId: "delopi", pace: 0.68 },
  { id: "raider-halo", displayName: "달무리", favoriteRelicId: "nodonia", pace: 1.29 },
  { id: "raider-pebble", displayName: "조약돌", favoriteRelicId: "ella", pace: 0.84 },
  { id: "raider-signal", displayName: "신호탑", favoriteRelicId: "mette", pace: 1.11 },
  { id: "raider-lantern", displayName: "등불", favoriteRelicId: "deina", pace: 0.75 },
  { id: "raider-marrow", displayName: "골수연구", favoriteRelicId: "maddy", pace: 0.97 },
  { id: "raider-willow", displayName: "버드나무", favoriteRelicId: "terisa", pace: 1.21 },
  { id: "raider-gale", displayName: "돌풍", favoriteRelicId: "parua", pace: 0.66 },
  { id: "raider-amberly", displayName: "호박빛", favoriteRelicId: "shute", pace: 1.06 },
  { id: "raider-slate", displayName: "점판암", favoriteRelicId: "dian", pace: 0.81 },
  { id: "raider-vellum", displayName: "양피지", favoriteRelicId: "rex", pace: 1.13 },
  { id: "raider-drift", displayName: "표류", favoriteRelicId: "anky", pace: 0.73 },
  { id: "raider-kiln", displayName: "가마", favoriteRelicId: "spino", pace: 1.27 },
] as const;

// 단계 이름은 화면에 서는 정적 콘텐츠라 다른 언어만 개체 ID로 덮어쓴다.
RAID_BOSS_BALANCE.phases.forEach((phase, index) => registerDataText(phase, "label", `raid.phase.${index}`));
