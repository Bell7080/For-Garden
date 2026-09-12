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
export const EXPEDITION_REWARD_IDS = ["gold", "fossil", "amber", "gems", "cheesecake"] as const;

/** 노드 완료 재화의 서버 추첨 범위와 한 런 누적 상한이다. */
export const EXPEDITION_NODE_REWARD_BALANCE = {
  cheesecake: { perNode: { min: 4, max: 12 }, runCap: 180 },
  gold: { perNode: { min: 120, max: 420 }, runCap: 7_500 },
  fossil: { perNode: { min: 3, max: 12 }, runCap: 220 },
  gems: { perNode: { min: 0, max: 2 }, runCap: 24 },
} as const;

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
  fossil: { min: 14, max: 28 },
  gems: { min: 3, max: 5 },
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

/**
 * 주간 누적 원정 점수 보상은 이 표 하나만 읽으며 단계 ID가 서버의 중복 수령 키가 된다.
 *
 * `damage-*` ID는 예전 "누적 피해" 명칭으로 저장된 수령 기록과의 호환을 위해 유지한다. 새 ID로
 * 즉시 바꾸면 같은 단계가 미수령으로 되살아날 수 있으므로, 영구 저장 마이그레이션을 제공하기
 * 전에는 표시명과 문서에서만 정확한 "주간 누적 원정 점수" 용어를 사용한다.
 *
 * 현재 한 판 점수는 일반 노드 점수 + 폰토스 피해 점수로 확정됐고, 주간 플레이 상한은 2회다.
 * 10,000은 첫 정상 노드들에서 보상 길을 알리는 초반 문턱, 50,000은 평균적인 1회 진행 목표,
 * 100,000은 평균 50,000점인 플레이를 주 2회 마치는 목표로 재검토해 유지한다. 실제 평균 점수가
 * 쌓이면 이 표의 세 threshold만 다시 조정하며 화면이나 서버에 별도 보상 표를 만들지 않는다.
 */
export const EXPEDITION_CUMULATIVE_REWARD_STAGES = [
  // 저장 호환 ID다. `score-10k`로 바꾸지 않는다.
  { id: "damage-10k", threshold: 10_000, reward: { currency: "gold", amount: 5_000 } },
  // 저장 호환 ID다. `score-50k`로 바꾸지 않는다.
  { id: "damage-50k", threshold: 50_000, reward: { currency: "fossil", amount: 100 } },
  // 저장 호환 ID다. `score-100k`로 바꾸지 않는다.
  { id: "damage-100k", threshold: 100_000, reward: { currency: "gems", amount: 100 } },
] as const;

/** 주차는 월요일 00:00 UTC에 초기화하며 동점은 최고 점수를 먼저 달성한 기록이 앞선다. */
export const EXPEDITION_WEEKLY_POLICY = { resetWeekdayUtc: 1, resetHourUtc: 0, tieBreak: "earliest-achieved-at", maxPlaysPerWeek: 2 } as const;

/**
 * 소탕은 직접 플레이하지 않고 지금까지의 최고 기록 일부만 즉시 정산한다.
 *
 * 주간 달성도(누적 점수 단계 보상)는 문턱을 처음 넘는 순간에만 지급되므로, 같은 주에 소탕을
 * 반복해도 이미 넘은 문턱에는 의미가 없다 — 그래도 막지 않는 이유는 아직 넘지 못한 다음 문턱을
 * 향해 누적 점수를 계속 쌓을 수 있기 때문이다. 소탕도 원정 한 판으로 세어 주간 횟수를 소비한다.
 */
export const EXPEDITION_SWEEP_POLICY = { allTimeBestScoreRatio: 0.8, lootRatio: 0.5 } as const;

/** 보스 단계 이름을 언어별로 덮어쓸 수 있게 등록한다. */
EXPEDITION_BOSS_BALANCE.phases.forEach((phase, index) => registerDataText(phase, "label", `expedition.phase.${index}`));
