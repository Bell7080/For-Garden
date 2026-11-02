import { missionPeriodKeys, normalizeMissions, type MissionState } from "./missions";

/**
 * 정기 이벤트 「보물상자」 — 코인을 내고 상자를 받아, 더 키울지(강화) 지금 열지(보상 받기)를 고른다.
 *
 * **코인은 이번 주에 쓴 스테미나와 1:1이다.** 따로 적립하는 경계를 두지 않고, 스테미나를 쓰는 모든 경계가
 * 이미 지나는 임무 사건(`stamina_spent`)이 이번 주 몫(`MissionState.weeklyStamina`)을 센다 — 새 입장 API가
 * 코인 적립을 빠뜨릴 길이 없다. 장부(`ChestForgeState`)는 이번 주에 **쓴** 코인과 진행 중인 상자만 든다.
 * 주가 바뀌면(UTC 월요일 00:00) 번 코인·쓴 코인이 함께 0으로 돌아가 남은 코인이 사라진다. 진행 중인
 * 상자는 이미 값을 치렀으므로 주가 바뀌어도 그대로 이어 끝낼 수 있다.
 *
 * **어느 단계에서 멈춰도 기대값이 거의 같다**(젬 환산 15~24). 한쪽이 확실히 유리하면 모두 같은 단계에서
 * 멈추고 「올릴까 말까」가 사라진다. 젬 환산(`TRADE_GEM_RATE`): 골드 500 = 젬 1 · 치즈케이크 1 = 젬 2.
 *
 * | 단계 | 오를 확률 | 도달 확률 | 젬 환산 | 멈췄을 때 기대값 |
 * | 0 | — | 100% | 15 | 15 |
 * | 1 | 100% | 100% | 18 | 18 |
 * | 2 | 90% | 90% | 24 | 21.6 |
 * | 3 | 75% | 67.5% | 34 | 23.0 |
 * | 4 | 60% | 40.5% | 60 | 24.3 |
 * | 5 | 45% | 18.2% | 130 | 23.7 |
 * | 6 | 35% | 6.4% | 300 | 19.1 |
 * | 7 | 25% | 1.6% | 1,000 | 15.9 |
 *
 * 한 판(코인 100 = 스테미나 100 ≈ 젬 83) 최선 기대값이 젬 약 24라 환원율은 약 29%다. 주 상한은 두지 않는다
 * (응태 결정, 2026-11-02 — 최종 보상 젬 환산 1,000). 공급은 쓴 스테미나에 비례하고, 젬으로 스테미나를 사서
 * 돌려도 산 값의 30%가 안 돌아와 되파는 길이 없다.
 */
export const CHEST_FORGE = {
  id: "chest-forge",
  /** 상자 하나를 받는 값(코인). */
  entryCost: 100,
} as const;

export interface ChestForgeReward { readonly gold: number; readonly cheesecake: number; readonly gems: number }
export interface ChestForgeStage {
  /** 이 단계로 **오를** 확률(%). 0단계는 받는 순간이라 100이다. */
  readonly chance: number;
  readonly reward: ChestForgeReward;
}

export const CHEST_FORGE_STAGES: readonly ChestForgeStage[] = [
  { chance: 100, reward: { gold: 3_000, cheesecake: 3, gems: 3 } },
  { chance: 100, reward: { gold: 4_000, cheesecake: 4, gems: 2 } },
  { chance: 90, reward: { gold: 5_000, cheesecake: 5, gems: 4 } },
  { chance: 75, reward: { gold: 6_000, cheesecake: 8, gems: 6 } },
  { chance: 60, reward: { gold: 10_000, cheesecake: 12, gems: 16 } },
  { chance: 45, reward: { gold: 20_000, cheesecake: 25, gems: 40 } },
  { chance: 35, reward: { gold: 40_000, cheesecake: 60, gems: 100 } },
  { chance: 25, reward: { gold: 100_000, cheesecake: 150, gems: 500 } },
];
export const CHEST_FORGE_MAX_STAGE = CHEST_FORGE_STAGES.length - 1;

/** 젬 환산(`TRADE_GEM_RATE`와 같은 비율). 표의 근거와 테스트가 읽는다. */
export function chestForgeGemValue(reward: ChestForgeReward): number {
  return reward.gold / 500 + reward.cheesecake * 2 + reward.gems;
}

/** 0단계에서 출발해 `stage`에 닿을 확률(0~1). */
export function chestForgeReachRate(stage: number): number {
  let rate = 1;
  for (let index = 1; index <= stage; index += 1) rate *= (CHEST_FORGE_STAGES[index]?.chance ?? 0) / 100;
  return rate;
}

export interface ChestForgeState {
  /** 아래 `spent`가 묶인 UTC 주(월요일 날짜). */
  weekKey: string;
  /** 이번 주에 상자를 받느라 쓴 코인. */
  spent: number;
  /** 진행 중인 상자의 단계. 없으면 `null`. */
  stage: number | null;
}

export function createEmptyChestForgeState(): ChestForgeState { return { weekKey: "", spent: 0, stage: null }; }

export function normalizeChestForgeState(value: unknown): ChestForgeState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ChestForgeState, unknown>>;
  const stage = Number.isInteger(source.stage) && (source.stage as number) >= 0 && (source.stage as number) <= CHEST_FORGE_MAX_STAGE ? source.stage as number : null;
  return {
    weekKey: typeof source.weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.weekKey) ? source.weekKey : "",
    spent: Number.isInteger(source.spent) && (source.spent as number) >= 0 ? source.spent as number : 0,
    stage,
  };
}

export function isValidChestForgeState(value: unknown): value is ChestForgeState {
  return !!value && typeof value === "object" && JSON.stringify(normalizeChestForgeState(value)) === JSON.stringify(value);
}

/** 주가 바뀌었으면 쓴 코인을 비운다. 진행 중인 상자는 남긴다. */
export function rollChestForgeWeek(state: ChestForgeState, now: Date): ChestForgeState {
  const { weeklyKey } = missionPeriodKeys(now);
  return state.weekKey === weeklyKey ? { ...state } : { weekKey: weeklyKey, spent: 0, stage: state.stage };
}

export interface ChestForgeStatus {
  weekKey: string;
  /** 지금 쓸 수 있는 코인. */
  coins: number;
  /** 이번 주에 번 코인(= 이번 주에 쓴 스테미나). */
  earned: number;
  stage: number | null;
  /** 다음 강화의 성공 확률(%). 상자가 없거나 마지막 단계면 `null`. */
  nextChance: number | null;
  /** 남은 코인이 사라지는 시각(다음 UTC 월요일 00:00). */
  resetsAt: string;
}

export function chestForgeStatus(missions: MissionState, ledger: ChestForgeState, now: Date): ChestForgeStatus {
  const current = normalizeMissions(missions, now);
  const state = rollChestForgeWeek(ledger, now);
  const earned = current.weeklyStamina ?? 0;
  const nextChance = state.stage === null || state.stage >= CHEST_FORGE_MAX_STAGE ? null : CHEST_FORGE_STAGES[state.stage + 1].chance;
  return {
    weekKey: state.weekKey, coins: Math.max(0, earned - state.spent), earned, stage: state.stage, nextChance,
    resetsAt: new Date(Date.parse(`${state.weekKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString(),
  };
}

/** 강화 한 번. 난수가 성공 확률 아래면 성공이다 — 100%는 늘 성공한다. */
export function rollChestForgeUpgrade(stage: number, random: () => number): boolean {
  const next = CHEST_FORGE_STAGES[stage + 1];
  if (!next) return false;
  const raw = random();
  const roll = Math.min(1 - Number.EPSILON, Math.max(0, Number.isFinite(raw) ? raw : 0));
  return roll < next.chance / 100;
}
