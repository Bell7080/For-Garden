/** 원정 맵에서 보스 외 노드를 뽑을 때 사용하는 정적 밸런스 한 벌이다. */
export const EXPEDITION_MAP_BALANCE = {
  /** 시작과 보스 사이의 층 수 및 각 층의 가로 노드 범위다. */
  routeFloors: 19,
  bossFloor: 20,
  columns: 5,
  nodesPerFloor: { min: 2, max: 4 },
  /** 가중치는 상대값이며 생성기가 합계를 직접 가정하지 않는다. */
  typeWeights: {
    normal: 48,
    elite: 12,
    horde: 14,
    rest: 14,
    treasure: 12,
  },
  /** 같은 종류와 비전투 노드가 한 세로 흐름에 지나치게 몰리지 않게 하는 상한이다. */
  maxConsecutiveSameType: 2,
  maxConsecutiveNonCombat: 1,
  /** 이 층은 모든 갈래를 전투로 만들어 어느 경로든 최소 전투 수를 만족시킨다. */
  requiredCombatFloors: [1, 4, 7, 10, 13, 16, 19],
  minimumCombatsPerRoute: 7,
} as const;

/** 밸런스 표가 허용하는 전투 종류다. 보스는 마지막 층 전용이라 추첨에서 제외한다. */
export const EXPEDITION_COMBAT_TYPES = ["normal", "elite", "horde"] as const;

/** 노드별 적 수와 능력치/렌더 배율의 단일 밸런스 표다. 스토리 전투의 기존 3대3에는 관여하지 않는다. */
export const EXPEDITION_COMBAT_BALANCE = {
  normal: { enemyCount: 3, statScale: 1, bodyScale: 1 },
  elite: { enemyCount: 1, statScale: 1.65, bodyScale: 1.1 },
  horde: { enemyCount: 5, statScale: 0.82, bodyScale: 0.94 },
} as const;

/**
 * 원정 점수의 두 축이 서로 얼마나 무거운가.
 *
 * **주 점수는 폰토스에게 넣은 피해다.** 지도를 도는 것만으로 쌓이는 노드 점수가 총점을
 * 좌우하면, 누가 얼마나 키웠든 19층을 도는 사람은 모두 비슷한 점수로 마감한다 — 실제로
 * v0.85.0까지 노드 총점이 23만인데 20층 폰토스 피해는 450이라, 순위표가 "지도를 끝까지
 * 돌았는가"만 물었다. 노드는 총점의 한 자릿수 퍼센트만 차지하는 참가 점수로 두고, 층마다
 * 얼마나 성하게 도착했는지(잔여 HP)만 남긴다.
 *
 * 폰토스 피해는 방어가 매우 높아 원값이 작으므로, 점수판에서 읽히는 크기로 끌어올린다.
 * 배율은 표시용 환산일 뿐이라 전투 계산에는 들어가지 않는다.
 */
export const EXPEDITION_SCORE_BALANCE = {
  /** 노드 한 층당 기본 점수. */
  perFloor: 40,
  /** 원정대 평균 잔여 HP 1%당 점수. */
  perRemainingHpPercent: 1.5,
  /** 폰토스에게 넣은 피해 1점이 점수판에서 갖는 값. */
  bossDamagePerPoint: 200,
} as const;

/**
 * 일반 전투 노드 점수의 종류별 배율이다. 점수 공식은 core/expeditionScore가 소유하고,
 * 운영 중 조정하는 상대 가치만 이 한 표에 둔다.
 */
export const EXPEDITION_NODE_SCORE_MULTIPLIERS = {
  /** 표준 교전은 층과 잔여 HP의 기준 가치를 그대로 사용한다. */
  normal: 1,
  /** 단일 강적의 높은 실패 위험을 표준 교전보다 50% 높게 보상한다. */
  elite: 1.5,
  /** 다수전의 추가 부담은 정예보다 낮은 25% 가산으로 보상한다. */
  horde: 1.25,
  /** 휴식은 전투 성과가 아니므로 점수를 만들지 않는다. */
  rest: 0,
  /** 보물의 가치는 전리품에만 있으며 RNG 결과를 점수로 환산하지 않는다. */
  treasure: 0,
  /** 보스 점수는 별도의 서버 검증 피해 점수가 소유한다. */
  boss: 0,
} as const;

/** 휴식은 생존자를 최대 HP의 30%만큼 회복하고, 전멸 전이라면 사망자 한 기를 25% HP로 부활시킨다. */
export const EXPEDITION_REST_RULES = { healPercent: 30, revivePercent: 25, maxRevives: 1, cannotReviveAfterWipe: true } as const;

/** 휴식과 보물은 전투가 아닌 경로 보조 노드다. */
export const EXPEDITION_NON_COMBAT_TYPES = ["rest", "treasure"] as const;

/** 저장 데이터가 임의 문자열로 전투 규칙을 주입하지 못하게 하는 원정 증강 ID 목록이다. */
/** @deprecated 증강 상세 정의는 expeditionAugments.ts가 소유하며 이 목록은 저장 호환 조회만 제공한다. */
export { EXPEDITION_AUGMENTS } from "./expeditionAugments";
import { EXPEDITION_AUGMENTS } from "./expeditionAugments";
import { registerDataText } from "../i18n";
export const EXPEDITION_AUGMENT_IDS = EXPEDITION_AUGMENTS.map(({ id }) => id);

/** 노드 완료 전까지 런 안에 보류할 수 있는 보상 종류다. */
export const EXPEDITION_REWARD_IDS = ["gold", "fossil", "amber", "gems", "cheesecake", "salvageRecord"] as const;

/** 노드 완료 재화의 서버 추첨 범위와 한 런 누적 상한이다. */
export const EXPEDITION_NODE_REWARD_BALANCE = {
  cheesecake: { perNode: { min: 4, max: 12 }, runCap: 180 },
  gold: { perNode: { min: 120, max: 420 }, runCap: 7_500 },
  fossil: { perNode: { min: 0, max: 1 }, runCap: 1 },
  gems: { perNode: { min: 0, max: 2 }, runCap: 24 },
  /**
   * 인양 기록 — 노드를 넘을 때마다 **소소하게** 쌓인다. 전리품 상점의 재화라 한 판에 몇 개라도 손에
   * 쥐어져야 원정을 돌 이유가 상점까지 이어진다. 큰 몫은 폰토스 피해와 주간 보상이 맡는다.
   */
  salvageRecord: { perNode: { min: 2, max: 5 }, runCap: 90 },
} as const;

/**
 * 폰토스에게 넣은 피해가 주는 인양 기록 — 원정 점수(피해 점수)에 비례한다.
 *
 * 폰토스 전은 쓰러뜨리는 싸움이 아니라 얼마나 깊이 긁었는가의 싸움이라, 그 깊이가 점수뿐 아니라
 * 손에 남는 것으로도 돌아와야 한다. 평균적인 한 판(피해 점수 4만 안팎)이 40개 남짓이다.
 */
export const EXPEDITION_BOSS_SALVAGE = { perScore: 1 / 1_000, cap: 200 } as const;

export function expeditionBossSalvage(bossDamageScore: number): number {
  return Math.max(0, Math.min(EXPEDITION_BOSS_SALVAGE.cap, Math.floor(Math.max(0, bossDamageScore) * EXPEDITION_BOSS_SALVAGE.perScore)));
}

/** 일반·정예·무리는 같은 기초 표에 배율만 적용해 난이도 대비 보상을 비교할 수 있게 한다. */
export const EXPEDITION_COMBAT_REWARD_MULTIPLIERS = {
  normal: 1,
  elite: 1.75,
  horde: 1.4,
} as const;

/**
 * 보물은 증강을 포기하는 대신 특별한 재화 선택을 주는 별도 표다.
 * 보장 보석과 높은 전투 재화 기대값은 직접 경로를 누른 플레이어에게만 제공한다. 따라서 원정 스킵은 이 보물을
 * 얻지 못해, 소기액 재화 획득(소위 '쌀먹')과 증강·편의성 사이에 아쉬움이 남는 선택지를 만든다.
 */
export const EXPEDITION_TREASURE_REWARD_BALANCE = {
  gold: { min: 520, max: 900 },
  fossil: { min: 1, max: 1 },
  gems: { min: 3, max: 5 },
  salvageRecord: { min: 6, max: 10 },
} as const;

/** 빠른 원정은 서버가 보유한 유효 최고 점수의 이 비율만 보상 점수로 환산한다. */
export const QUICK_EXPEDITION_POLICY = { scoreRatio: 0.25, dailyLimitUtc: 2, weeklyLimitUtc: 5 } as const;

/** 불사 보스의 시간 경과 강화 표다. 마지막 처형 단계는 어떤 정상 편성도 버티지 못하게 한다. */
export const EXPEDITION_BOSS_BALANCE = {
  /** 서버 검증이 허용하는 전투 길이와 입력량 상한이다. */
  maximumDurationMs: 180_000,
  maximumActions: 2_000,
  maximumAcceptedScore: 100_000_000,
  /** 일반 단계의 공격은 폰토스 정적 스킬만 담당하고, 이 표는 제한 시간 처형만 담당한다. */
  phases: [
    { startsAtMs: 0, attackPerSecond: 0, label: "관측" },
    { startsAtMs: 30_000, attackPerSecond: 0, label: "과부하" },
    { startsAtMs: 60_000, attackPerSecond: 0, label: "붕괴" },
    { startsAtMs: 90_000, attackPerSecond: 1_000_000_000, label: "종말" },
  ],
} as const;

/** 최고 점수 보상 길과 순위 보상이 줄 수 있는 재화. 모두 지갑 칸이다. */
export type ExpeditionRewardCurrency = "gold" | "fossil" | "gems" | "salvageRecord" | "cheesecake" | "dnaFragments" | "amber";

/**
 * 이번 주 **한 판 최고 점수**가 여는 보상 길 — 단계 ID가 서버의 중복 수령 키다.
 *
 * 누적 점수(두세 판의 합)는 걷어 냈다 — 몇 번 들어왔는지를 셀 뿐 얼마나 잘 싸웠는지를 말하지 못했다.
 * 최고 점수 하나로 여는 대신 **잘게 쪼개** 스물네 마디를 둔다: 첫 판이 곧바로 여러 마디를 열고,
 * 기록을 조금씩 넘길 때마다 한두 마디가 더 열린다. 보상은 한 재화로 채우지 않는다 — 인양 기록이
 * 뼈대이고 골드·치즈케이크·DNA 조각·화석·호박석·보석이 사이사이에 선다.
 *
 * 평균적인 한 판이 5만 점 안팎(노드 점수 몇천 + 폰토스 피해 점수)이라 그 언저리에 마디가 촘촘하고,
 * 20만 점은 끝까지 키운 편성의 목표다.
 */
export const EXPEDITION_BEST_SCORE_REWARD_STAGES: readonly { id: string; threshold: number; reward: { currency: ExpeditionRewardCurrency; amount: number } }[] = [
  { id: "best-2k", threshold: 2_000, reward: { currency: "salvageRecord", amount: 10 } },
  { id: "best-4k", threshold: 4_000, reward: { currency: "gold", amount: 3_000 } },
  { id: "best-6k", threshold: 6_000, reward: { currency: "salvageRecord", amount: 10 } },
  { id: "best-8k", threshold: 8_000, reward: { currency: "cheesecake", amount: 30 } },
  { id: "best-10k", threshold: 10_000, reward: { currency: "salvageRecord", amount: 15 } },
  { id: "best-13k", threshold: 13_000, reward: { currency: "dnaFragments", amount: 5 } },
  { id: "best-16k", threshold: 16_000, reward: { currency: "salvageRecord", amount: 15 } },
  { id: "best-20k", threshold: 20_000, reward: { currency: "gems", amount: 20 } },
  { id: "best-24k", threshold: 24_000, reward: { currency: "salvageRecord", amount: 20 } },
  { id: "best-28k", threshold: 28_000, reward: { currency: "gold", amount: 6_000 } },
  { id: "best-33k", threshold: 33_000, reward: { currency: "salvageRecord", amount: 20 } },
  { id: "best-38k", threshold: 38_000, reward: { currency: "fossil", amount: 1 } },
  { id: "best-44k", threshold: 44_000, reward: { currency: "salvageRecord", amount: 25 } },
  { id: "best-50k", threshold: 50_000, reward: { currency: "gems", amount: 40 } },
  { id: "best-57k", threshold: 57_000, reward: { currency: "salvageRecord", amount: 25 } },
  { id: "best-65k", threshold: 65_000, reward: { currency: "cheesecake", amount: 60 } },
  { id: "best-74k", threshold: 74_000, reward: { currency: "salvageRecord", amount: 30 } },
  { id: "best-84k", threshold: 84_000, reward: { currency: "dnaFragments", amount: 10 } },
  { id: "best-95k", threshold: 95_000, reward: { currency: "salvageRecord", amount: 30 } },
  { id: "best-110k", threshold: 110_000, reward: { currency: "amber", amount: 1 } },
  { id: "best-125k", threshold: 125_000, reward: { currency: "salvageRecord", amount: 40 } },
  { id: "best-145k", threshold: 145_000, reward: { currency: "gems", amount: 60 } },
  { id: "best-170k", threshold: 170_000, reward: { currency: "salvageRecord", amount: 50 } },
  { id: "best-200k", threshold: 200_000, reward: { currency: "fossil", amount: 2 } },
];

/** 주차는 월요일 00:00 UTC에 초기화하며 동점은 최고 점수를 먼저 달성한 기록이 앞선다. */
export const EXPEDITION_WEEKLY_POLICY = { resetWeekdayUtc: 1, resetHourUtc: 0, tieBreak: "earliest-achieved-at" } as const;

/** 원정은 **하루 한 번** 떠난다(UTC 날짜). 소탕도 그 한 번을 쓴다. */
export const EXPEDITION_DAILY_POLICY = { maxPlaysPerDay: 1 } as const;

/**
 * 주간 순위 보상 — 한 주가 끝나면 그 주 최고 점수의 순위로 우편을 보낸다(`pendingRankReward`).
 * `upTo`까지의 순위가 그 줄의 보상을 받고, 마지막 줄은 기록을 남긴 모두의 몫이다. 인양 기록과
 * 보석을 함께 준다 — 순위가 상점 재화까지 끌고 가야 주마다 기록을 다시 쓸 이유가 된다.
 */
export const EXPEDITION_WEEKLY_RANK_REWARDS: readonly { upTo: number | null; rewards: Partial<Record<ExpeditionRewardCurrency, number>> }[] = [
  { upTo: 1, rewards: { gems: 500, salvageRecord: 400 } },
  { upTo: 3, rewards: { gems: 400, salvageRecord: 320 } },
  { upTo: 10, rewards: { gems: 300, salvageRecord: 250 } },
  { upTo: 50, rewards: { gems: 200, salvageRecord: 180 } },
  { upTo: 100, rewards: { gems: 150, salvageRecord: 130 } },
  { upTo: null, rewards: { gems: 80, salvageRecord: 80 } },
];

export function expeditionRankRewards(rank: number): Partial<Record<ExpeditionRewardCurrency, number>> {
  const row = EXPEDITION_WEEKLY_RANK_REWARDS.find(({ upTo }) => upTo === null || rank <= upTo) ?? EXPEDITION_WEEKLY_RANK_REWARDS.at(-1)!;
  return { ...row.rewards };
}

/**
 * 소탕은 직접 싸우지 않고 **노드 클리어 보상의 75%**만 한꺼번에 받는다.
 *
 * 기준은 한 판을 끝까지 돌며 노드마다 쌓이는 몫(`EXPEDITION_NODE_REWARD_BALANCE`의 `runCap`)이고,
 * **보물 전리품과 폰토스 피해의 인양 기록은 빠진다** — 그 둘은 지도를 직접 걸은 사람의 몫이다.
 * 점수도 남기지 않는다(최고 기록은 싸운 판만의 것이다). 하루 한 번의 기회를 쓴다.
 */
export const EXPEDITION_SWEEP_POLICY = { nodeRewardRatio: 0.75 } as const;

/** 보스 단계 이름을 언어별로 덮어쓸 수 있게 등록한다. */
EXPEDITION_BOSS_BALANCE.phases.forEach((phase, index) => registerDataText(phase, "label", `expedition.phase.${index}`));
