import { registerDataText } from "../i18n";
import { requiredBreakthroughForLevel } from "../core/levelDesign";

/**
 * 레이드 — **경쟁이 아니라 함께 미는 보스전**이다.
 *
 * 레이드 하나는 **보스 한 마리 + 난이도 + 공유 체력 + 수명**으로 이루어진 판이다. 두 갈래다.
 *
 * - **월드 폭주** — 시스템만 여는 하루 한 마리(난이도 `rampage`, 만렙). 모든 플레이어가 체력
 *   한 줄을 함께 깎고 **잡지 못해도 된다.**
 * - **소환 레이드** — 토벌권으로 여는 판(쉬움·보통·어려움). 친구 목록 인원끼리 함께 본다.
 *
 * 어느 쪽이든 판 하나에 **두 번** 도전하고, 판이 끝나면(토벌되거나 수명이 다하면) **완료 탭에서
 * 정산을 눌러** 보상을 받는다(`raidSettlement`). 보상은 **참여한 사람만** 받고, 내가 많이 깎을수록
 * 그리고 판 전체가 많이 깎일수록 커진다. 때린 판마다 그 피해에 비례한 골드는 곧바로 받는다.
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
 * 난이도 — 레벨·체력·수명·정산이 한 줄이다.
 *
 * **레벨은 한계 돌파 사다리 위에 선다**(`requiredBreakthroughForLevel`). 쉬움 20(돌파 0) · 보통
 * 30(돌파 1: 일반 공격) · 어려움 40(돌파 2: 궁극기) · 폭주 60(돌파 4: 네 칸 전부)이라, 난이도가
 * 오를 때마다 보스가 돌파로 여는 기술이 하나씩 드러난다(지금은 모두 "없음"이다).
 *
 * **체력은 함께 치는 사람 수에서 거꾸로 구한다.** 한 판의 피해는 실측으로 0.8만~2.6만이고 한
 * 사람이 판마다 두 번 친다. 소환 레이드는 친구 몇 명이 하루 안에 잡을 무게이고, 월드 폭주는
 * 모두가 함께여야 비로소 줄이 움직이는 **레전드급**이라 날마다 다 깎이지 않을 수 있다.
 *
 * **정산**(`settlement`)은 참여한 사람에게만 나간다. `mine`은 내 피해가 `mineTarget`에 닿을수록
 * 차오르고(두 판의 합), `total`은 판 전체가 깎인 비율만큼, `kill`은 토벌된 판에만 붙는다.
 */
export type RaidDifficulty = "easy" | "normal" | "hard" | "rampage";

export interface RaidDifficultySpec {
  level: number;
  totalHp: number;
  /** 판이 열려 있는 시간. 토벌되면 그 전에 끝난다. */
  lifetimeHours: number;
  settlement: { mine: number; mineTarget: number; total: number; kill: number };
}

export const RAID_DIFFICULTY: Record<RaidDifficulty, RaidDifficultySpec> = {
  easy: { level: 20, totalHp: 150_000, lifetimeHours: 24, settlement: { mine: 12, mineTarget: 10_000, total: 8, kill: 5 } },
  normal: { level: 30, totalHp: 300_000, lifetimeHours: 24, settlement: { mine: 20, mineTarget: 15_000, total: 14, kill: 8 } },
  hard: { level: 40, totalHp: 600_000, lifetimeHours: 24, settlement: { mine: 32, mineTarget: 22_000, total: 22, kill: 12 } },
  rampage: { level: 60, totalHp: 10_000_000, lifetimeHours: 24, settlement: { mine: 50, mineTarget: 45_000, total: 60, kill: 30 } },
};

/** 저장·진입 데이터에서 온 값이 난이도 표에 있는지. 모르는 값은 어느 몸으로 세울지 알 수 없다. */
export function isRaidDifficulty(value: unknown): value is RaidDifficulty {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(RAID_DIFFICULTY, value);
}

/** 소환권으로 고를 수 있는 난이도. 폭주는 시스템만 연다. */
export const RAID_SUMMON_DIFFICULTIES = ["easy", "normal", "hard"] as const satisfies readonly RaidDifficulty[];

/** 소환 레이드에 서는 보스 풀. 토벌권은 이 중 하나를 무작위로, 선택 토벌권은 골라서 연다. */
export const RAID_BOSS_POOL = ["sukusuino"] as const;

/** 두 가지 토벌권. 가방의 재료 아이템이다(`src/data/items.ts`). */
export const RAID_TICKET_ITEM = "raid-ticket";
export const RAID_SELECT_TICKET_ITEM = "raid-select-ticket";

/** 월드 폭주가 갖는 공유 체력. 판 안의 몸(`RAID_BOSS_HP_SCALE`)이 이 값을 단위로 삼는다. */
export const RAID_SEASON_TOTAL_HP = RAID_DIFFICULTY.rampage.totalHp;

/**
 * 판 안에 서는 보스의 몸은 월드 폭주 줄의 400분의 1이다(2만 5천).
 *
 * 몸은 세기가 아니라 **단위**다 — 보스는 판 안에서 죽지 않고(공유 체력은 서버가 갖는다) 머리 위
 * 줄이 얼마나 밀렸는지만 말한다. 난이도마다 몸을 바꾸면 쉬움의 몸이 한 번에 비어 그 줄이 뜻을
 * 잃으므로, 모든 판이 같은 몸을 쓴다.
 */
export const RAID_BOSS_HP_SCALE = 400;

/** 판 하나에 도전할 수 있는 횟수. 내 기여는 그 두 판의 피해 합이다. */
export const RAID_ATTEMPTS_PER_RAID = 2;

/**
 * 때린 판마다 곧바로 받는 골드 — **그 판의 피해에 비례한다.**
 *
 * 정산은 판이 끝나야 열리므로, 한 판을 치고 나온 손에 아무것도 없으면 두 번째 판을 칠 이유가
 * 화면에서 사라진다. 한 판 2만 피해가 4천 골드다.
 */
export const RAID_RUN_GOLD_PER_DAMAGE = 0.2;

/** 끝난 판이 완료 탭에 남는 시간. 정산하지 않은 판은 이보다 오래 남는다(받을 것이 있으므로). */
export const RAID_COMPLETED_KEEP_HOURS = 48;

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
