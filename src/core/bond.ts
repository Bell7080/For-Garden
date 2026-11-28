import type { RelicProgress } from "./types";

/**
 * 유대는 함께한 경험으로 쌓이는 플레이어별 관계 진행이다.
 * 로비에 누구를 세우는지 정하는 애착(favorite)과는 서로 독립된 개념이다.
 */
/**
 * 능력치(%)가 붙는 마지막 유대 레벨 — 1~10레벨이 레벨마다 오각형 다섯 +1%다(응태 결정 2026-11-28, 최대 +10%).
 * 업적의 「유대 10레벨」도 이 값이다. 유대 레벨 자체에는 상한이 없다(`BOND_LEVEL_MAX`는 저장 검증의 끝일 뿐).
 */
export const BOND_STAT_LEVEL_CAP = 10;

/**
 * 저장이 받아들이는 유대 레벨의 끝. 11레벨부터 요구 경험치가 레벨마다 1.2배로 불어나 실제 플레이로 닿는 선은
 * 30레벨 언저리다(응태 2026-11-28 — 「올릴수록 곡선으로 확 높아져 실제로 얻을 수 있는 선은 상한이 있다」).
 * 이 값은 숫자가 터지지 않게 막는 바닥이지 화면에 서는 상한이 아니다.
 */
export const BOND_LEVEL_MAX = 100;

/** 1~10레벨까지 다음 레벨로 가는 데 드는 경험치(예전 표 그대로 — 지금까지 쌓은 유대가 바뀌지 않는다). */
const EARLY_STEPS = [20, 30, 40, 50, 60, 70, 80, 90, 100, 110] as const;
/** 11레벨로 가는 몫과 그 뒤 레벨마다 불어나는 배율. */
export const BOND_LATE_STEP = { base: 140, growth: 1.2 } as const;

/** 그 레벨에서 다음 레벨로 가는 데 드는 경험치. 11레벨부터 가파르다. 5 단위로 끊는다. */
export function bondXpToNext(level: number): number {
  if (level < EARLY_STEPS.length) return EARLY_STEPS[Math.max(0, level)];
  return Math.round(BOND_LATE_STEP.base * BOND_LATE_STEP.growth ** (level - EARLY_STEPS.length) / 5) * 5;
}

/** 각 레벨에 도달하는 데 필요한 누적 경험치다. 인덱스가 곧 유대 레벨이다(0~`BOND_LEVEL_MAX`). */
export const BOND_TOTAL_XP_BY_LEVEL: readonly number[] = (() => {
  const totals = [0];
  for (let level = 0; level < BOND_LEVEL_MAX; level += 1) totals.push(totals[level] + bondXpToNext(level));
  return totals;
})();

/** 쌓을 수 있는 유대 경험치의 끝. */
export const BOND_XP_MAX = BOND_TOTAL_XP_BY_LEVEL[BOND_LEVEL_MAX];

/** 허용된 경로만 이름 있는 상수로 노출해 임의 보상 생성을 막는다. */
export const BOND_XP_REWARD = { firstAcquisition: 20, partyVictory: 12, firstLobbyInteraction: 5, firstObservationInterview: 5 } as const;

/**
 * 스토리 관문 승리 한 판의 유대 경험치 — 장마다 1씩 더 준다(1장 12 → 9장 20, 응태 2026-11-28).
 * 모두가 1-1만 돌지 않도록 깰 수 있는 선에서 높은 장을 도는 보람을 남긴다. 치즈케이크 대작전 등 다른 전투는 그대로 12다.
 */
export function storyVictoryBondXp(chapter: number): number {
  const safe = Number.isInteger(chapter) && chapter > 0 ? chapter : 1;
  return BOND_XP_REWARD.partyVictory + (safe - 1);
}

/**
 * 유대 한 레벨이 올리는 능력치(%) — 오각형 다섯(체력·방어·저항·공격·주문력)에 레벨마다 1%씩, 10레벨이면 10%다.
 *
 * 예전에는 유대가 야성이 차는 속도를 최대 +50%까지 올렸다. 응태 결정(2026-11-28)으로 걷어 내고 능력치로 옮겼다 —
 * 폭주 시각이 유대 하나로 크게 당겨지면 같은 편성도 얼마나 오래 함께했는지에 따라 판이 통째로 갈렸고, 그 몫은
 * 화면의 오각형에 서지 않았다. **성장은 오각형 다섯만 올린다**는 규칙(공명·레벨과 같은 축)을 그대로 따르고,
 * 공명과 더해서 한 번에 곱한다(`calculateFinalStats`). 대인전에서도 그대로 든다 — 꺼지는 것은 공명뿐이다.
 */
export const BOND_STAT_PERCENT_PER_LEVEL = 1;

/** 그 유대 레벨이 오각형 다섯에 더하는 몫(%). 10레벨 몫에서 멈춘다. */
export function bondStatPercent(bondLevel: number): number {
  if (!Number.isFinite(bondLevel) || bondLevel <= 0) return 0;
  return Math.min(BOND_STAT_LEVEL_CAP, Math.floor(bondLevel)) * BOND_STAT_PERCENT_PER_LEVEL;
}

/** 유대 각성이 고를 수 있는 다섯 축 — 오각형과 같다. */
export const BOND_AWAKENING_KEYS = ["hp", "def", "res", "atk", "ap"] as const;
export type BondAwakeningKey = (typeof BOND_AWAKENING_KEYS)[number];
/** 어느 축에 몇 번 각성했는가. 없는 축은 0이다. */
export type BondAwakening = Partial<Record<BondAwakeningKey, number>>;

/** 각성 한 번이 그 축에 더하는 몫(%) — 유대 %·공명과 같은 덧셈 단계에 든다. */
export const BOND_AWAKENING_PERCENT = 2;
/** 각성을 레벨마다 주는 구간(11~20)과 그 뒤 몇 레벨마다 하나씩 주는가(30·40·50…). */
export const BOND_AWAKENING_LADDER = { everyLevelFrom: 11, everyLevelTo: 20, stride: 10 } as const;

/** 그 레벨에서 하나가 생기는가. 사다리 설명이 같은 규칙을 읽는다. */
export function bondAwakeningAtLevel(level: number): boolean {
  const { everyLevelFrom, everyLevelTo, stride } = BOND_AWAKENING_LADDER;
  if (level >= everyLevelFrom && level <= everyLevelTo) return true;
  return level > everyLevelTo && level % stride === 0;
}

/** 그 유대 레벨까지 받은 각성 횟수(쓰지 않은 것 포함). */
export function bondAwakeningPoints(bondLevel: number): number {
  const level = Math.max(0, Math.min(BOND_LEVEL_MAX, Math.floor(Number.isFinite(bondLevel) ? bondLevel : 0)));
  const { everyLevelFrom, everyLevelTo, stride } = BOND_AWAKENING_LADDER;
  const early = Math.max(0, Math.min(level, everyLevelTo) - everyLevelFrom + 1);
  const late = level > everyLevelTo ? Math.floor(level / stride) - Math.floor(everyLevelTo / stride) : 0;
  return early + late;
}

/** 쓴 각성 횟수. */
export function bondAwakeningSpent(awakening: BondAwakening | undefined): number {
  if (!awakening) return 0;
  return BOND_AWAKENING_KEYS.reduce((sum, key) => sum + (awakening[key] ?? 0), 0);
}

/** 레벨로 받은 횟수 안에서 다섯 축에 나눈 올바른 각성인가. 서버·저장 검증이 같은 함수를 읽는다. */
export function isValidBondAwakening(awakening: unknown, bondLevel: number): awakening is BondAwakening {
  if (awakening === undefined) return true;
  if (!awakening || typeof awakening !== "object" || Array.isArray(awakening)) return false;
  const entries = Object.entries(awakening as Record<string, unknown>);
  if (!entries.every(([key, value]) => (BOND_AWAKENING_KEYS as readonly string[]).includes(key) && Number.isInteger(value) && (value as number) >= 0)) return false;
  return bondAwakeningSpent(awakening as BondAwakening) <= bondAwakeningPoints(bondLevel);
}

/** 0인 축을 걷어 낸 사본. 저장에 빈 칸을 남기지 않는다. */
export function compactBondAwakening(awakening: BondAwakening | undefined): BondAwakening | undefined {
  if (!awakening) return undefined;
  const entries = BOND_AWAKENING_KEYS.filter((key) => (awakening[key] ?? 0) > 0).map((key) => [key, awakening[key]!] as const);
  return entries.length > 0 ? Object.fromEntries(entries) as BondAwakening : undefined;
}

/** 유대가 다섯 축에 더하는 몫(%) — 레벨 몫 + 그 축의 각성 몫. `calculateFinalStats`가 공명과 더해 한 번에 곱한다. */
export function bondStatBonus(progress: { bondLevel: number; bondAwakening?: BondAwakening }): Record<BondAwakeningKey, number> {
  const base = bondStatPercent(progress.bondLevel);
  return Object.fromEntries(BOND_AWAKENING_KEYS.map((key) => [key, base + (progress.bondAwakening?.[key] ?? 0) * BOND_AWAKENING_PERCENT])) as Record<BondAwakeningKey, number>;
}

export interface BondXpResult { progress: RelicProgress; xpGained: number; levelsGained: number; }

/** 누적 경험치에서 레벨을 다시 계산해 저장값 조작이나 큰 보상도 상한을 넘지 않게 한다. */
export function bondLevelForXp(xp: number): number {
  if (!Number.isInteger(xp) || xp < 0) throw new RangeError("유대 경험치는 0 이상의 정수여야 합니다.");
  let level = 0;
  while (level < BOND_LEVEL_MAX && xp >= BOND_TOTAL_XP_BY_LEVEL[level + 1]) level += 1;
  return level;
}

/** 원본 성장 객체를 변경하지 않고 경험치와 그 결과 레벨을 함께 반환한다. */
export function grantBondXp(progress: RelicProgress, amount: number): BondXpResult {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError("유대 경험치 보상은 0 이상의 정수여야 합니다.");
  const bondXp = Math.min(BOND_XP_MAX, progress.bondXp + amount);
  const bondLevel = bondLevelForXp(bondXp);
  return { progress: { ...progress, bondXp, bondLevel, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] }, xpGained: bondXp - progress.bondXp, levelsGained: bondLevel - progress.bondLevel };
}

/** UTC 날짜키를 비교해 로비 경험치를 하루 한 번만 확정한다. */
export function grantDailyLobbyBondXp(progress: RelicProgress, utcDate: string): BondXpResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(utcDate)) throw new RangeError("로비 상호작용 날짜가 올바르지 않습니다.");
  if (progress.lastLobbyInteractionDate === utcDate) return { progress: { ...progress, heartGemSlots: [...progress.heartGemSlots] as RelicProgress["heartGemSlots"] }, xpGained: 0, levelsGained: 0 };
  const result = grantBondXp(progress, BOND_XP_REWARD.firstLobbyInteraction);
  return { ...result, progress: { ...result.progress, lastLobbyInteractionDate: utcDate } };
}
