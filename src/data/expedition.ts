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

/** 휴식은 생존자를 최대 HP의 30%만큼 회복하고, 전멸 전이라면 사망자 한 기를 25% HP로 부활시킨다. */
export const EXPEDITION_REST_RULES = { healPercent: 30, revivePercent: 25, maxRevives: 1, cannotReviveAfterWipe: true } as const;

/** 휴식과 보물은 전투가 아닌 경로 보조 노드다. */
export const EXPEDITION_NON_COMBAT_TYPES = ["rest", "treasure"] as const;

/** 저장 데이터가 임의 문자열로 전투 규칙을 주입하지 못하게 하는 원정 증강 ID 목록이다. */
/** @deprecated 증강 상세 정의는 expeditionAugments.ts가 소유하며 이 목록은 저장 호환 조회만 제공한다. */
export { EXPEDITION_AUGMENTS } from "./expeditionAugments";
import { EXPEDITION_AUGMENTS } from "./expeditionAugments";
export const EXPEDITION_AUGMENT_IDS = EXPEDITION_AUGMENTS.map(({ id }) => id);

/** 노드 완료 전까지 런 안에 보류할 수 있는 보상 종류다. */
export const EXPEDITION_REWARD_IDS = ["gold", "fossil", "amber", "gems", "cheesecake"] as const;

/** 노드 완료 재화의 서버 추첨 범위와 한 런 누적 상한이다. 희귀 재화인 호박석은 원정 노드에서 지급하지 않는다. */
export const EXPEDITION_NODE_REWARD_BALANCE = {
  cheesecake: { perNode: { min: 4, max: 12 }, runCap: 180 },
  gold: { perNode: { min: 120, max: 420 }, runCap: 7_500 },
  fossil: { perNode: { min: 3, max: 12 }, runCap: 220 },
  gems: { perNode: { min: 0, max: 2 }, runCap: 24 },
} as const;

/** 빠른 원정은 서버가 보유한 유효 최고 점수의 이 비율만 보상 점수로 환산한다. */
export const QUICK_EXPEDITION_POLICY = { scoreRatio: 0.25, dailyLimitUtc: 2, weeklyLimitUtc: 5 } as const;

/** 불사 보스의 시간 경과 강화 표다. 마지막 처형 단계는 어떤 정상 편성도 버티지 못하게 한다. */
export const EXPEDITION_BOSS_BALANCE = {
  /** 서버 검증이 허용하는 전투 길이와 입력량 상한이다. */
  maximumDurationMs: 180_000,
  maximumActions: 2_000,
  maximumAcceptedScore: 100_000_000,
  /** 입력에는 동작만 담기며 피해량은 이 서버 소유 배율로 다시 계산한다. */
  actionPower: { basic: 1, ultimate: 3 } as const,
  actionCooldownMs: { basic: 900, ultimate: 8_000 } as const,
  /** 초당 광역 피해와 마지막 처형 피해를 단계화해 전투가 반드시 아군 전멸로 끝나게 한다. */
  phases: [
    { startsAtMs: 0, attackPerSecond: 18, label: "관측" },
    { startsAtMs: 30_000, attackPerSecond: 45, label: "과부하" },
    { startsAtMs: 60_000, attackPerSecond: 110, label: "붕괴" },
    { startsAtMs: 90_000, attackPerSecond: 1_000_000_000, label: "종말" },
  ],
} as const;

/** 주간 누적 피해 보상은 이 표 하나만 읽으며 단계 ID가 서버의 중복 수령 키가 된다. */
export const EXPEDITION_CUMULATIVE_REWARD_STAGES = [
  { id: "damage-10k", threshold: 10_000, reward: { currency: "gold", amount: 5_000 } },
  { id: "damage-50k", threshold: 50_000, reward: { currency: "fossil", amount: 100 } },
  { id: "damage-100k", threshold: 100_000, reward: { currency: "gems", amount: 100 } },
] as const;

/** 주차는 월요일 00:00 UTC에 초기화하며 동점은 최고 점수를 먼저 달성한 기록이 앞선다. */
export const EXPEDITION_WEEKLY_POLICY = { resetWeekdayUtc: 1, resetHourUtc: 0, tieBreak: "earliest-achieved-at" } as const;
