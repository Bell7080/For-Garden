import { missionPeriodKeys, normalizeMissions, type MissionState } from "./missions";
import { EVENT_REWARD_BUDGET } from "./eventRewardBudget";
import { chestCurrencyGemValue, type ChestCardCurrency } from "./chestForge";
import { sameJsonShape } from "./jsonShape";

/**
 * 정규 이벤트 「슈테의 리듬 낚시」 — 코인을 내고 낚싯줄을 던지면 **물고기(보물)가 차례로 물린다**. 물고기 한 마리마다
 * 게이지 위를 바늘이 좌우로 오가고, 빛나는 구간에 바늘이 들어온 순간 눌러 **캐치**한다. 캐치를 정해진 횟수(3~5번)만큼
 * 쌓으면 그 물고기를 낚아 보물을 받는다. 구간을 벗어나 누르면 **미스** — 판 전체에서 세 번 미스하면 아웃이고, 그때까지
 * 낚은 것은 지켜진다(티아의 보물상자·델로피의 보물 찾기와 같은 결).
 *
 * **운이 아니라 손이 정한다.** 바늘은 일정한 속도로 0 → 1 → 0을 오가는 삼각파 하나뿐이고(`gaugePosition`), 구간·속도는
 * 판을 열 때 서버가 정해 그대로 보낸다 — 화면에 보이는 그대로가 판정이다. 판정 창(바늘이 구간을 지나는 시간)은 어느
 * 난이도·어느 물고기에서도 `MIN_WINDOW_MS` 아래로 내려가지 않는다. 값진 물고기일수록 **캐치가 많고, 빠르고, 구간이 좁다** —
 * 그래서 좋은 보물(젬·화석)이 어렵다. 셋리스트는 판을 여는 순간 정해지고 쉬운 것부터 큰 것 순으로 물린다 — 마지막 곡이
 * **보스곡**이고, 보스곡의 보물은 난이도마다 따로 짠 표(`boss`)에서 나와 앞의 곡보다 훨씬 크다.
 *
 * 판정은 서버가 한다: 화면은 바늘이 출발한 뒤 누르기까지 걸린 시간(ms)만 보내고, 서버가 같은 삼각파로 위치를 구해
 * 구간과 견준다. 바늘의 움직임이 시간의 함수 하나라 통신 지연은 판정에 들지 않는다.
 *
 * **코인은 이번 주에 쓴 스테미나와 1:1이다**(`chestForge.ts`와 같은 임무 사건). 정규 이벤트는 주마다 교대하므로
 * 장부(`ShuteFishingState`)를 따로 둔다.
 *
 * **보상은 이벤트 보상 예산을 따른다**(`eventRewardBudget.ts`의 정규 — 코인 100당 젬 환산). 모든 물고기를 낚는 완벽한
 * 판이 곧 상한이므로 난이도마다 **판에 물리는 보물의 기대 총가치**를 그 선 안에 두고, 입장값에 정확히 비례하게 짠다
 * (200은 100의 2배, 300은 3배, 400은 4배 — `shuteFishing.test`). 대박(젬 500·1,000)은 보스곡 자리에서만 나오고, 수치를
 * 깎지 않고 보스 표의 가중치로 묶는다.
 */
export const SHUTE_FISHING = {
  id: "shute-fishing",
  /** 판 전체에서 이만큼 미스하면 아웃이다. */
  maxMisses: 3,
} as const;

/** 바늘이 빛나는 구간을 지나는 가장 짧은 시간(ms). 이보다 짧아지면 사람의 손으로 맞출 수 없어 운이 된다. */
export const MIN_WINDOW_MS = 130;
/** 구간의 가운데 이 비율 안이면 PERFECT — 표시만 다르고 보상은 같다. */
export const PERFECT_RATIO = 0.4;
/** 한 번 캐치할 때마다 바늘이 이만큼(비율) 빨라진다 — 박자가 쌓일수록 템포가 올라간다. */
export const TEMPO_STEP = 0.05;
/** 누르기까지 걸린 시간의 상한(ms). 이보다 늦은 누름은 놓친 것으로 본다(화면을 오래 열어 둔 채 둔 판). */
export const MAX_PRESS_MS = 120_000;

export type FishTier = "common" | "fine" | "rare" | "jackpot";
export const FISH_TIER_ORDER: readonly FishTier[] = ["common", "fine", "rare", "jackpot"];
export function fishTierRank(tier: FishTier): number { return FISH_TIER_ORDER.indexOf(tier); }

/**
 * 등급마다 붙는 손맛 — 캐치 수, 바늘 속도 배율(작을수록 빠르다), 구간 폭 배율. 값진 물고기일수록 오래, 빠르게, 좁게
 * 버텨야 한다("3~5번 캐치해서 기회를 잡는다" — 응태 2026-11-03).
 */
export const FISH_TIER_FEEL: Readonly<Record<FishTier, { catches: number; speed: number; width: number }>> = {
  common: { catches: 3, speed: 1, width: 1 },
  fine: { catches: 3, speed: 0.92, width: 0.92 },
  rare: { catches: 4, speed: 0.86, width: 0.85 },
  jackpot: { catches: 5, speed: 0.8, width: 0.78 },
};

export interface FishTreasure {
  readonly id: string;
  readonly tier: FishTier;
  readonly currency: ChestCardCurrency;
  readonly amount: number;
  /** 같은 등급 안에서 뽑힐 가중치. */
  readonly weight: number;
}

/**
 * 보물표. 젬 환산(`TRADE_GEM_RATE`): 골드 500 · 치즈케이크 2 · 원석 5 · 스테미나 0.83 · 화석/호박석 300.
 * 원석은 고고학이 주 수급처라 가장 흔한 등급에만 둔다(`rawStoneSupply.test`). 화석·호박석·젬 큰 몫은 rare 이상이라
 * 캐치가 많고 빠르다. 대박은 젬 500·1,000("가끔 젬 300~1,000급 대박" — 응태 2026-11-03).
 */
export const FISH_TREASURES: readonly FishTreasure[] = [
  { id: "gold-s", tier: "common", currency: "gold", amount: 25_000, weight: 1 },
  { id: "cheesecake-s", tier: "common", currency: "cheesecake", amount: 25, weight: 1 },
  { id: "stamina-s", tier: "common", currency: "stamina", amount: 50, weight: 1 },
  { id: "stone-s", tier: "common", currency: "rawStone", amount: 10, weight: 1 },
  { id: "gems-xs", tier: "common", currency: "gems", amount: 40, weight: 1 },
  { id: "gold-m", tier: "fine", currency: "gold", amount: 70_000, weight: 1 },
  { id: "cheesecake-m", tier: "fine", currency: "cheesecake", amount: 70, weight: 1 },
  { id: "gems-s", tier: "fine", currency: "gems", amount: 100, weight: 1 },
  { id: "stamina-m", tier: "fine", currency: "stamina", amount: 150, weight: 1 },
  { id: "gems-m", tier: "rare", currency: "gems", amount: 200, weight: 3 },
  { id: "gold-l", tier: "rare", currency: "gold", amount: 150_000, weight: 1 },
  { id: "cheesecake-l", tier: "rare", currency: "cheesecake", amount: 150, weight: 1 },
  { id: "gems-l", tier: "rare", currency: "gems", amount: 300, weight: 2 },
  { id: "fossil", tier: "rare", currency: "fossil", amount: 1, weight: 2 },
  { id: "amber", tier: "rare", currency: "amber", amount: 1, weight: 2 },
  { id: "jackpot-500", tier: "jackpot", currency: "gems", amount: 500, weight: 3 },
  { id: "jackpot-1000", tier: "jackpot", currency: "gems", amount: 1_000, weight: 1 },
];
export function fishTreasure(id: string): FishTreasure | undefined { return FISH_TREASURES.find((treasure) => treasure.id === id); }
export function fishTreasureGemValue(treasure: FishTreasure): number { return chestCurrencyGemValue(treasure.currency) * treasure.amount; }

export type FishingDifficultyId = "easy" | "normal" | "hard" | "extreme";

export interface FishingDifficulty {
  readonly id: FishingDifficultyId;
  /** 판을 여는 값(코인). */
  readonly entryCost: number;
  /** 한 판에 물리는 물고기 수(마지막 한 마리가 보스다). */
  readonly fish: number;
  /** 바늘이 게이지 한쪽 끝에서 다른 끝까지 가는 시간(ms) — 흔한 물고기의 첫 캐치 기준. */
  readonly sweepMs: number;
  /** 빛나는 구간의 폭(게이지 전체에 대한 비율) — 흔한 물고기 기준. */
  readonly zone: number;
  /** 보스 앞 물고기를 뽑는 등급 가중치. 대박은 여기서 나오지 않고 보스 자리에서만 나온다. */
  readonly tierWeights: Readonly<Record<Exclude<FishTier, "jackpot">, number>>;
  /** 마지막 곡(보스)의 보물과 가중치 — 난이도마다 훨씬 좋게 짠다. */
  readonly boss: readonly (readonly [string, number])[];
}

/**
 * 난이도 표(값은 여기 하나). 어려울수록 ① 물고기가 많고 ② 바늘이 빠르며 ③ 구간이 좁고 ④ 값진 물고기가 물릴 몫이 크다.
 * 판에 물리는 기대 총가치는 입장값에 비례한다 — 100 : 200 : 300 : 400 = 1 : 2 : 3 : 4배.
 *
 * 판을 열면 셋리스트가 팅팅 정해지고 **뒤로 갈수록 좋아지며 마지막 곡(보스)이 난이도에 맞춰 훨씬 좋다**(응태 2026-11-03):
 * 쉬움은 젬 300·화석·호박석, 보통은 젬 500, 어려움은 젬 500~1,000, 매우 어려움은 늘 젬 1,000이다.
 * 구간 폭은 "너무 어렵다"(응태 2026-11-03)는 말에 처음보다 1.4배 남짓 넓혔다.
 * 2026-11-11 「살짝 낮춰 주자」(응태): 쉬움은 그대로 두고 보통~매우 어려움의 바늘을 5~10% 늦추고 구간을 넓혔으며,
 * 가장 짧은 판정 창을 110 → 130ms로 올렸다(보스 대박 캐치가 그 바닥에 붙어 있었다).
 */
export const FISHING_DIFFICULTIES: readonly FishingDifficulty[] = [
  { id: "easy", entryCost: 100, fish: 3, sweepMs: 1300, zone: 0.34,
    tierWeights: { common: 58, fine: 42, rare: 0 }, boss: [["gems-l", 3], ["fossil", 2], ["amber", 2], ["jackpot-500", 1]] },
  { id: "normal", entryCost: 200, fish: 4, sweepMs: 1180, zone: 0.31,
    tierWeights: { common: 20, fine: 50, rare: 30 }, boss: [["jackpot-500", 1]] },
  { id: "hard", entryCost: 300, fish: 5, sweepMs: 1040, zone: 0.28,
    tierWeights: { common: 0, fine: 45, rare: 55 }, boss: [["jackpot-500", 5], ["jackpot-1000", 1]] },
  { id: "extreme", entryCost: 400, fish: 6, sweepMs: 900, zone: 0.25,
    tierWeights: { common: 10, fine: 52, rare: 38 }, boss: [["jackpot-1000", 1]] },
];
export function fishingDifficulty(id: unknown): FishingDifficulty | undefined { return FISHING_DIFFICULTIES.find((difficulty) => difficulty.id === id); }

/** 캐치 한 번의 게이지 — 구간의 가운데·폭(0~1)과 바늘이 한쪽 끝에서 다른 끝까지 가는 시간. */
export interface FishingCatch {
  readonly center: number;
  readonly width: number;
  readonly sweepMs: number;
}

/** 바늘의 자리(0~1) — 0에서 출발해 오른쪽으로 갔다가 돌아오는 삼각파. 서버 판정과 화면이 같은 함수를 읽는다. */
export function gaugePosition(sweepMs: number, elapsedMs: number): number {
  if (!(sweepMs > 0) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  const phase = (elapsedMs / sweepMs) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

export type FishingJudgment = "perfect" | "good" | "miss";
/** 누른 시간을 판정한다. 구간 경계는 들어간 것으로 본다. */
export function judgeCatch(spec: FishingCatch, elapsedMs: number): { judgment: FishingJudgment; position: number } {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > MAX_PRESS_MS) return { judgment: "miss", position: 0 };
  const position = gaugePosition(spec.sweepMs, elapsedMs);
  const offset = Math.abs(position - spec.center);
  const half = spec.width / 2;
  const judgment: FishingJudgment = offset <= half * PERFECT_RATIO + 1e-9 ? "perfect" : offset <= half + 1e-9 ? "good" : "miss";
  return { judgment, position };
}

/** 판정 창(ms) — 바늘이 구간을 한 번 지나는 시간. */
export function catchWindowMs(spec: FishingCatch): number { return spec.width * spec.sweepMs; }

function clampRoll(random: () => number): number {
  const raw = random();
  return Math.min(1 - Number.EPSILON, Math.max(0, Number.isFinite(raw) ? raw : 0));
}
function pickWeighted<T>(entries: readonly (readonly [T, number])[], random: () => number): T {
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  let roll = clampRoll(random) * total;
  for (const [value, weight] of entries) { if (roll < weight) return value; roll -= weight; }
  return entries[entries.length - 1][0];
}

/**
 * 한 판에 물릴 물고기를 뽑는다. 보스 앞 물고기는 등급 가중치로 뽑아 **흔한 것부터 값진 것 순**으로 세우고(같은 보물은 한 판에
 * 한 마리만), 마지막에 보스 한 마리가 선다 — 판이 갈수록 박자가 빨라지고 보상이 좋아지며, 마지막이 보스곡이다.
 */
export function rollFishingFish(difficulty: FishingDifficulty, random: () => number): string[] {
  const boss = pickWeighted(difficulty.boss, random);
  const picked: FishTreasure[] = [];
  const tiers = (["common", "fine", "rare"] as const);
  while (picked.length < difficulty.fish - 1) {
    const open = tiers.filter((tier) => difficulty.tierWeights[tier] > 0
      && FISH_TREASURES.some((treasure) => treasure.tier === tier && treasure.id !== boss && !picked.includes(treasure)));
    const tier = pickWeighted(open.map((entry) => [entry, difficulty.tierWeights[entry]] as const), random);
    const pool = FISH_TREASURES.filter((treasure) => treasure.tier === tier && treasure.id !== boss && !picked.includes(treasure));
    picked.push(pickWeighted(pool.map((treasure) => [treasure, treasure.weight] as const), random));
  }
  const ordered = picked
    .map((treasure, index) => ({ treasure, index }))
    .sort((a, b) => fishTreasureGemValue(a.treasure) - fishTreasureGemValue(b.treasure) || a.index - b.index)
    .map(({ treasure }) => treasure.id);
  return [...ordered, boss];
}

/**
 * 물고기 한 마리의 캐치들. 캐치가 쌓일수록 바늘이 빨라지고(`TEMPO_STEP`) 구간은 매번 다른 자리에 선다(직전 자리와 너무
 * 가깝지 않게). 폭은 판정 창이 `MIN_WINDOW_MS`보다 짧아지지 않게 넓혀 둔다 — 어느 판이든 손으로 맞출 수 있다.
 */
export function rollFishCatches(difficulty: FishingDifficulty, treasureId: string, random: () => number): FishingCatch[] {
  const treasure = fishTreasure(treasureId);
  const feel = FISH_TIER_FEEL[treasure?.tier ?? "common"];
  const catches: FishingCatch[] = [];
  let previous = -1;
  for (let index = 0; index < feel.catches; index += 1) {
    const sweepMs = Math.round(difficulty.sweepMs * feel.speed * (1 - TEMPO_STEP * index));
    const width = Math.max(difficulty.zone * feel.width, MIN_WINDOW_MS / sweepMs);
    const margin = width / 2 + 0.06;
    let center = margin + clampRoll(random) * (1 - margin * 2);
    // 직전 구간과 겹치면 반대편으로 옮긴다 — 같은 자리를 연달아 누르는 단조로운 판을 피한다.
    if (previous >= 0 && Math.abs(center - previous) < width) center = center < 0.5 ? Math.min(1 - margin, center + 0.4) : Math.max(margin, center - 0.4);
    previous = center;
    catches.push({ center: Math.round(center * 1000) / 1000, width: Math.round(width * 1000) / 1000, sweepMs });
  }
  return catches;
}

/** 물고기를 전부 낚았을 때 받는 총가치(젬 환산) — 난이도 예산을 재는 기준이다. */
export function fishingRunGemValue(fish: readonly string[]): number {
  return fish.reduce((sum, id) => { const treasure = fishTreasure(id); return sum + (treasure ? fishTreasureGemValue(treasure) : 0); }, 0);
}

/** 정규 이벤트 예산 — 완벽한 판의 기대 총가치가 코인 100당 상한을 넘지 않는다. */
export const SHUTE_FISHING_BUDGET = EVENT_REWARD_BUDGET.regular;

export interface FishingRun {
  difficulty: FishingDifficultyId;
  /** 물릴 물고기(보물 ID) — 차례대로. */
  fish: string[];
  /** 물고기마다의 캐치들. */
  catches: FishingCatch[][];
  /** 지금 낚는 물고기의 차례. */
  index: number;
  /** 지금 물고기에서 쌓은 캐치 수. */
  caught: number;
  misses: number;
  /** 이 판에서 지금까지 받은 몫(상한에서 깎인 뒤). */
  collected: Partial<Record<ChestCardCurrency, number>>;
}

/** 캐치(누르기) 한 번의 결과. */
export interface FishingReel {
  judgment: FishingJudgment;
  /** 서버가 구한 바늘의 자리(0~1). */
  position: number;
  /** 누른 물고기의 차례와 그 물고기에서 쌓인 캐치 수(이번 누름 반영). */
  fishIndex: number;
  caught: number;
  misses: number;
  /** 이 누름으로 물고기를 낚았다면 그 보물. */
  landed?: string;
  /** 판이 끝났는가(세 번 미스했거나 전부 낚았다). */
  finished: boolean;
  cleared: boolean;
}

export class FishingReelError extends Error {}

/** 순수 규칙 — 지금 캐치를 누른다. 보상 지급은 부르는 쪽(서버)이 맡는다. */
export function reelFishing(run: FishingRun, elapsedMs: unknown): { run: FishingRun; reel: FishingReel } {
  if (typeof elapsedMs !== "number" || !Number.isFinite(elapsedMs) || elapsedMs < 0) throw new FishingReelError("올바르지 않은 입력입니다.");
  const spec = run.catches[run.index]?.[run.caught];
  if (!spec) throw new FishingReelError("낚을 물고기가 없습니다.");
  const { judgment, position } = judgeCatch(spec, elapsedMs);
  if (judgment === "miss") {
    const misses = run.misses + 1;
    const finished = misses >= SHUTE_FISHING.maxMisses;
    return { run: { ...run, misses }, reel: { judgment, position, fishIndex: run.index, caught: run.caught, misses, finished, cleared: false } };
  }
  const caught = run.caught + 1;
  const need = run.catches[run.index].length;
  if (caught < need) return { run: { ...run, caught }, reel: { judgment, position, fishIndex: run.index, caught, misses: run.misses, finished: false, cleared: false } };
  const landed = run.fish[run.index];
  const index = run.index + 1;
  const cleared = index >= run.fish.length;
  return {
    run: { ...run, index, caught: 0 },
    reel: { judgment, position, fishIndex: run.index, caught, misses: run.misses, landed, finished: cleared, cleared },
  };
}

export interface ShuteFishingState {
  /** 아래 `spent`가 묶인 UTC 주(월요일 날짜). */
  weekKey: string;
  /** 이번 주에 판을 여느라 쓴 코인. */
  spent: number;
  /** 진행 중인 판. 없으면 `null`. */
  run: FishingRun | null;
}

export function createEmptyShuteFishingState(): ShuteFishingState { return { weekKey: "", spent: 0, run: null }; }

const CURRENCIES: readonly ChestCardCurrency[] = ["gold", "cheesecake", "stamina", "rawStone", "gems", "fossil", "amber"];
function normalizeCatch(value: unknown): FishingCatch | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<Record<keyof FishingCatch, unknown>>;
  const { center, width, sweepMs } = source;
  if (typeof center !== "number" || typeof width !== "number" || typeof sweepMs !== "number") return null;
  if (!(center >= 0 && center <= 1 && width > 0 && width <= 1 && Number.isInteger(sweepMs) && sweepMs > 0)) return null;
  return { center, width, sweepMs };
}
function normalizeRun(value: unknown): FishingRun | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<Record<keyof FishingRun, unknown>>;
  const difficulty = fishingDifficulty(source.difficulty);
  if (!difficulty) return null;
  const fish = Array.isArray(source.fish) ? source.fish.filter((id): id is string => typeof id === "string" && !!fishTreasure(id)) : [];
  if (fish.length !== difficulty.fish || new Set(fish).size !== fish.length) return null;
  const rawCatches = Array.isArray(source.catches) ? source.catches : [];
  if (rawCatches.length !== fish.length) return null;
  const catches: FishingCatch[][] = [];
  for (const entry of rawCatches) {
    if (!Array.isArray(entry) || entry.length === 0) return null;
    const row = entry.map(normalizeCatch);
    if (row.some((spec) => spec === null)) return null;
    catches.push(row as FishingCatch[]);
  }
  const { index, caught, misses } = source;
  if (!Number.isInteger(index) || (index as number) < 0 || (index as number) >= fish.length) return null;
  if (!Number.isInteger(caught) || (caught as number) < 0 || (caught as number) >= catches[index as number].length) return null;
  if (!Number.isInteger(misses) || (misses as number) < 0 || (misses as number) >= SHUTE_FISHING.maxMisses) return null;
  const collected: FishingRun["collected"] = {};
  const raw = (source.collected && typeof source.collected === "object" ? source.collected : {}) as Record<string, unknown>;
  for (const [currency, amount] of Object.entries(raw)) {
    if ((CURRENCIES as readonly string[]).includes(currency) && Number.isInteger(amount) && (amount as number) > 0) collected[currency as ChestCardCurrency] = amount as number;
  }
  return { difficulty: difficulty.id, fish, catches, index: index as number, caught: caught as number, misses: misses as number, collected };
}

export function normalizeShuteFishingState(value: unknown): ShuteFishingState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ShuteFishingState, unknown>>;
  return {
    weekKey: typeof source.weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.weekKey) ? source.weekKey : "",
    spent: Number.isInteger(source.spent) && (source.spent as number) >= 0 ? source.spent as number : 0,
    run: normalizeRun(source.run),
  };
}

export function isValidShuteFishingState(value: unknown): value is ShuteFishingState {
  return !!value && typeof value === "object" && sameJsonShape(normalizeShuteFishingState(value), value);
}

/** 주가 바뀌었으면 쓴 코인을 비운다. 진행 중인 판은 남긴다(이미 값을 치렀다). */
export function rollShuteFishingWeek(state: ShuteFishingState, now: Date): ShuteFishingState {
  const { weeklyKey } = missionPeriodKeys(now);
  return state.weekKey === weeklyKey ? { ...state } : { weekKey: weeklyKey, spent: 0, run: state.run };
}

export interface ShuteFishingStatus {
  weekKey: string;
  /** 지금 쓸 수 있는 코인. */
  coins: number;
  /** 이번 주에 번 코인(= 이번 주에 쓴 스테미나). */
  earned: number;
  /** 진행 중인 판 — 숨길 것이 없어 그대로 내려간다(구간·속도가 보이는 그대로가 판정이다). */
  run: FishingRun | null;
  /** 남은 코인이 사라지는 시각(다음 UTC 월요일 00:00). */
  resetsAt: string;
}

/** 지금 판을 열 수 있는가 — 진행 중인 판이 있거나 코인이 가장 싼 난이도 값 이상이다(로비 이벤트 점·정렬). */
export function shuteFishingPlayable(status: Pick<ShuteFishingStatus, "coins" | "run">): boolean {
  return status.run !== null || status.coins >= Math.min(...FISHING_DIFFICULTIES.map(({ entryCost }) => entryCost));
}

export function shuteFishingStatus(missions: MissionState, ledger: ShuteFishingState, now: Date): ShuteFishingStatus {
  const current = normalizeMissions(missions, now);
  const state = rollShuteFishingWeek(ledger, now);
  const earned = current.weeklyStamina ?? 0;
  return {
    weekKey: state.weekKey, coins: Math.max(0, earned - state.spent), earned, run: state.run ? structuredClone(state.run) : null,
    resetsAt: new Date(Date.parse(`${state.weekKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString(),
  };
}
