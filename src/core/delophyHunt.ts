import { missionPeriodKeys, normalizeMissions, type MissionState } from "./missions";
import { EVENT_REWARD_BUDGET } from "./eventRewardBudget";
import { chestCurrencyGemValue, type ChestCardCurrency } from "./chestForge";

/**
 * 정규 이벤트 「델로피의 보물 찾기」 — 코인을 내고 판을 열면 **보물 카드 쌍이 앞면으로 잠깐 펼쳐지고**, 다시 엎어져
 * **섞인 뒤**, 같은 그림 두 장을 찾아 뒤집는다. 짝을 맞추면 그 보물을 받고, **세 번 틀리면 아웃**이다. 모은 것은
 * 지켜진다(티아의 보물상자와 같은 결).
 *
 * **운이 아니라 눈이 정한다.** 섞이는 길은 서버가 판을 열 때 정해 그대로 보내므로 카드가 어디로 가는지는 화면에서
 * 전부 보인다 — 값이 큰 보물일수록 더 자주, 더 어렵게(곡선으로 돌고 다른 카드 뒤로 들어갔다 나오며) 움직일 뿐
 * 속도에는 사람이 따라갈 수 있는 하한을 둔다(`MIN_MOVE_MS`). 틀린 카드는 뒤집혀 정체가 드러나므로 한 번의 실수도
 * 다음 시도의 단서가 된다. 판의 짝은 서버가 들고 있어, 화면이 정답을 미리 알지 못한 채 고른 슬롯만 보내 확인받는다.
 *
 * **코인은 이번 주에 쓴 스테미나와 1:1이다**(`chestForge.ts`와 같은 임무 사건). 두 정규 이벤트는 주마다 교대하므로
 * 장부(`DelophyHuntState`)를 따로 둔다.
 *
 * **보상은 이벤트 보상 예산을 따른다**(`eventRewardBudget.ts`의 정규 — 코인 100당 젬 환산). 짝을 전부 맞추는
 * 완벽한 판이 곧 상한이므로, 난이도마다 **판에 놓이는 보물의 기대 총가치**를 그 선 안에 두고 사람이 실제로 맞추는
 * 몫은 그보다 훨씬 작다. 화끈한 한 칸(젬 1,000·3,000)은 수치를 깎지 않고 판에 놓일 확률로 묶는다.
 */
export const DELOPHY_HUNT = {
  id: "delophy-hunt",
  /** 이만큼 틀리면 아웃이다. */
  maxMisses: 3,
} as const;

/** 한 번 섞는 움직임의 가장 빠른 길이(ms). 이보다 빨라지면 눈으로 따라갈 수 없어 운이 된다. */
export const MIN_MOVE_MS = 260;

export type HuntTier = "common" | "fine" | "rare" | "jackpot";
export const HUNT_TIER_ORDER: readonly HuntTier[] = ["common", "fine", "rare", "jackpot"];
/** 카드가 얼마나 어렵게 움직이는가 — 값이 클수록 섞이는 자리에 자주 뽑힌다. 등급 차례에서 나온다. */
export function huntHeat(tier: HuntTier): number { return HUNT_TIER_ORDER.indexOf(tier) + 1; }

export interface HuntTreasure {
  readonly id: string;
  readonly tier: HuntTier;
  readonly currency: ChestCardCurrency;
  readonly amount: number;
  /** 같은 등급 안에서 뽑힐 가중치. */
  readonly weight: number;
}

/**
 * 보물표. 젬 환산(`TRADE_GEM_RATE`): 골드 500 · 치즈케이크 2 · 원석 5 · 스테미나 0.83 · 화석/호박석 300.
 * 흔한·좋은 등급도 던전 몇 판으로 대신할 수 없는 양으로 둔다(응태 2026-11-03 — "선택할 이유가 없다"), 흔한 등급에도 젬
 * 한 쌍을 두어 젬을 하나도 못 받는 판을 줄인다. 원석은 고고학이 주 수급처라 가장 흔한 등급에만 둔다(`rawStoneSupply.test`). 화석·호박석·젬 큰 몫은 모두가 노리는
 * 것이라 rare 이상에 두어 가장 어렵게 섞인다.
 */
export const HUNT_TREASURES: readonly HuntTreasure[] = [
  { id: "gold-s", tier: "common", currency: "gold", amount: 20_000, weight: 1 },
  { id: "cheesecake-s", tier: "common", currency: "cheesecake", amount: 20, weight: 1 },
  { id: "stamina-s", tier: "common", currency: "stamina", amount: 40, weight: 1 },
  { id: "stone-s", tier: "common", currency: "rawStone", amount: 8, weight: 1 },
  { id: "gems-xs", tier: "common", currency: "gems", amount: 30, weight: 1 },
  { id: "gold-m", tier: "fine", currency: "gold", amount: 60_000, weight: 1 },
  { id: "cheesecake-m", tier: "fine", currency: "cheesecake", amount: 60, weight: 1 },
  { id: "gems-s", tier: "fine", currency: "gems", amount: 80, weight: 1 },
  { id: "stamina-m", tier: "fine", currency: "stamina", amount: 120, weight: 1 },
  { id: "gems-m", tier: "rare", currency: "gems", amount: 150, weight: 3 },
  { id: "gems-l", tier: "rare", currency: "gems", amount: 250, weight: 2 },
  { id: "fossil", tier: "rare", currency: "fossil", amount: 1, weight: 2 },
  { id: "amber", tier: "rare", currency: "amber", amount: 1, weight: 2 },
  { id: "jackpot-1000", tier: "jackpot", currency: "gems", amount: 1_000, weight: 4 },
  { id: "jackpot-3000", tier: "jackpot", currency: "gems", amount: 3_000, weight: 1 },
];
export function huntTreasure(id: string): HuntTreasure | undefined { return HUNT_TREASURES.find((treasure) => treasure.id === id); }
export function huntTreasureGemValue(treasure: HuntTreasure): number { return chestCurrencyGemValue(treasure.currency) * treasure.amount; }

export type HuntDifficultyId = "easy" | "normal" | "hard";
export type HuntMoveStyle = "slide" | "arc" | "dive";

export interface HuntDifficulty {
  readonly id: HuntDifficultyId;
  /** 판을 여는 값(코인). */
  readonly entryCost: number;
  /** 놓이는 보물 쌍의 수. 카드는 이 수의 두 배다. */
  readonly pairs: number;
  /** 카드를 앞면으로 보여 주는 시간(ms). */
  readonly memorizeMs: number;
  /** 섞는 횟수(대박 카드가 더 움직이는 몫은 따로 더해진다). */
  readonly swaps: number;
  /** 한 번 자리를 바꾸는 시간(ms). */
  readonly moveMs: number;
  /** 두 쌍이 동시에 바뀌는 확률(대박 카드가 낀 움직임에는 쓰지 않는다). */
  readonly doubleChance: number;
  /** 곡선(arc)·뒤로 들어가기(dive)를 쓰는가. 쉬움은 곧게만 움직인다. */
  readonly arc: boolean;
  readonly dive: boolean;
  /** 대박 카드가 판에 있을 때 그 카드가 낀 움직임을 적어도 이만큼 보장한다. */
  readonly jackpotMoves: number;
  /** 보물 한 쌍을 뽑는 등급 가중치. 어려울수록 값진 쪽으로 기운다. */
  readonly tierWeights: Readonly<Record<HuntTier, number>>;
  /** 판마다 반드시 한 쌍 놓이는 맛있는 보물(가중치는 보물표의 `weight`). 나머지 쌍은 `tierWeights`로 뽑는다. */
  readonly guaranteed: readonly string[];
}

/**
 * 난이도 표(값은 여기 하나). 어려울수록 ① 쌍이 늘고 ② 더 많이, 더 빠르게 섞이며 ③ 값진 보물이 놓일 몫이 커진다.
 * 판에 놓이는 기대 총가치는 입장값에 비례한다 — 200은 100의 약 2배, 300은 약 3배(응태 2026-11-03: "300개는 확실히 3배치 보상").
 * `delophyHunt.test`가 정규 예산 안인지와 그 배수를 함께 잰다.
 */
export const HUNT_DIFFICULTIES: readonly HuntDifficulty[] = [
  { id: "easy", entryCost: 100, pairs: 3, memorizeMs: 4200, swaps: 10, moveMs: 440, doubleChance: 0.1, arc: false, dive: false, jackpotMoves: 0,
    tierWeights: { common: 58, fine: 42, rare: 0, jackpot: 0 }, guaranteed: ["gems-m"] },
  { id: "normal", entryCost: 200, pairs: 4, memorizeMs: 3800, swaps: 16, moveMs: 340, doubleChance: 0.3, arc: true, dive: false, jackpotMoves: 6,
    tierWeights: { common: 36, fine: 50, rare: 12, jackpot: 0.8 }, guaranteed: ["gems-m", "gems-l", "fossil", "amber"] },
  { id: "hard", entryCost: 300, pairs: 5, memorizeMs: 3400, swaps: 26, moveMs: 270, doubleChance: 0.5, arc: true, dive: true, jackpotMoves: 10,
    tierWeights: { common: 24, fine: 44, rare: 30, jackpot: 1.5 }, guaranteed: ["gems-m", "gems-l", "fossil", "amber"] },
];
export function huntDifficulty(id: unknown): HuntDifficulty | undefined { return HUNT_DIFFICULTIES.find((difficulty) => difficulty.id === id); }
/** 카드 한 줄에 놓이는 열 수 — 두 줄로 깔리도록 쌍의 수와 같다. */
export function huntBoardColumns(difficulty: HuntDifficulty): number { return difficulty.pairs; }

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
function randomInt(count: number, random: () => number): number { return Math.min(count - 1, Math.floor(clampRoll(random) * count)); }

/** 한 판에 놓일 보물 쌍을 뽑는다. 맛있는 보물 한 쌍(`guaranteed`)이 먼저 놓이고, 같은 보물은 한 판에 한 쌍만, 대박은 한 판에 한 쌍까지다. */
export function rollHuntPairs(difficulty: HuntDifficulty, random: () => number): string[] {
  const picked: HuntTreasure[] = [];
  const sure = HUNT_TREASURES.filter((treasure) => difficulty.guaranteed.includes(treasure.id));
  if (sure.length) picked.push(pickWeighted(sure.map((treasure) => [treasure, treasure.weight] as const), random));
  while (picked.length < difficulty.pairs) {
    const tiers = HUNT_TIER_ORDER.filter((tier) => difficulty.tierWeights[tier] > 0
      && !(tier === "jackpot" && picked.some((treasure) => treasure.tier === "jackpot"))
      && HUNT_TREASURES.some((treasure) => treasure.tier === tier && !picked.includes(treasure)));
    const tier = pickWeighted(tiers.map((entry) => [entry, difficulty.tierWeights[entry]] as const), random);
    const pool = HUNT_TREASURES.filter((treasure) => treasure.tier === tier && !picked.includes(treasure));
    picked.push(pickWeighted(pool.map((treasure) => [treasure, treasure.weight] as const), random));
  }
  return picked.map((treasure) => treasure.id);
}

/** 쌍을 카드 두 장씩 펼쳐 한 번 섞는다 — 앞면으로 보여 주는 처음 배치다. */
export function rollHuntLayout(pairs: readonly string[], random: () => number): string[] {
  const cards = pairs.flatMap((id) => [id, id]);
  for (let index = cards.length - 1; index > 0; index -= 1) {
    const other = randomInt(index + 1, random);
    [cards[index], cards[other]] = [cards[other], cards[index]];
  }
  return cards;
}

/** 자리 바꾸기 한 번. `swaps`는 서로 겹치지 않는 슬롯 쌍이며 둘이면 동시에 바뀐다. */
export interface HuntMove {
  readonly swaps: readonly (readonly [number, number])[];
  readonly style: HuntMoveStyle;
  /** 이 움직임이 걸리는 시간(ms). */
  readonly ms: number;
}

function treasureHeat(id: string): number {
  const treasure = huntTreasure(id);
  return treasure ? huntHeat(treasure.tier) : 1;
}

/**
 * 섞는 길. 카드가 서 있는 보물의 값이 클수록 그 카드가 고르는 자리에 자주 오르고(`heat²` 가중), 대박이 낀 움직임은
 * 가장 어려운 모양(dive — 다른 카드 뒤로 낮게 들어갔다 위로 나온다)이다. **난수는 이 함수 안에서만 쓰이고 결과는 그대로
 * 화면에 간다** — 눈으로 따라가면 닿는 길이며 숨은 가짜 움직임은 없다.
 */
export function rollHuntMoves(layout: readonly string[], difficulty: HuntDifficulty, random: () => number): HuntMove[] {
  const cards = [...layout];
  const slots = cards.map((_, index) => index);
  const moves: HuntMove[] = [];
  let last = "";
  const heatAt = (slot: number): number => treasureHeat(cards[slot]);
  const styleFor = (slotA: number, slotB: number): HuntMoveStyle => {
    const heat = Math.max(heatAt(slotA), heatAt(slotB));
    if (heat >= 4 && difficulty.dive) return "dive";
    if (heat >= 3 && difficulty.dive) return "arc";
    if (heat >= 2 && difficulty.arc) return "arc";
    return "slide";
  };
  const swapOnce = (first: number | undefined): void => {
    let a = first ?? pickWeighted(slots.map((slot) => [slot, heatAt(slot) ** 2] as const), random);
    let b = a;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidates = slots.filter((slot) => slot !== a);
      b = candidates[randomInt(candidates.length, random)];
      if (`${Math.min(a, b)}-${Math.max(a, b)}` !== last && cards[a] !== cards[b]) break;
    }
    if (a === b) a = (b + 1) % cards.length;
    const style = styleFor(a, b);
    const jackpotInvolved = Math.max(heatAt(a), heatAt(b)) >= 4;
    const swaps: [number, number][] = [[a, b]];
    if (!jackpotInvolved && clampRoll(random) < difficulty.doubleChance) {
      const rest = slots.filter((slot) => slot !== a && slot !== b);
      if (rest.length >= 2) {
        const c = rest[randomInt(rest.length, random)];
        const others = rest.filter((slot) => slot !== c);
        swaps.push([c, others[randomInt(others.length, random)]]);
      }
    }
    for (const [x, y] of swaps) [cards[x], cards[y]] = [cards[y], cards[x]];
    last = `${Math.min(a, b)}-${Math.max(a, b)}`;
    // 곡선과 뒤로 들어가기는 같은 길이를 더 오래 잡는다 — 높이가 바뀌는 만큼 눈이 따라갈 시간이 필요하다.
    const ms = Math.max(MIN_MOVE_MS, Math.round(difficulty.moveMs * (style === "dive" ? 1.25 : style === "arc" ? 1.1 : 1)));
    moves.push({ swaps, style, ms });
  };
  for (let index = 0; index < difficulty.swaps; index += 1) swapOnce(undefined);
  // 대박 카드는 판이 끝나도록 따라가야 하는 카드다 — 정해 둔 횟수만큼 더 움직인다.
  const jackpotSlots = (): number[] => slots.filter((slot) => heatAt(slot) >= 4);
  const jackpotIds = new Set(layout.filter((id) => treasureHeat(id) >= 4));
  if (jackpotIds.size > 0 && difficulty.jackpotMoves > 0) {
    const touched = (): number => {
      const replay = [...layout];
      let count = 0;
      for (const move of moves) {
        if (move.swaps.some(([x, y]) => jackpotIds.has(replay[x]) || jackpotIds.has(replay[y]))) count += 1;
        for (const [x, y] of move.swaps) [replay[x], replay[y]] = [replay[y], replay[x]];
      }
      return count;
    };
    let guard = 0;
    while (touched() < difficulty.jackpotMoves && guard < 40) {
      const owned = jackpotSlots();
      swapOnce(owned[randomInt(owned.length, random)]);
      guard += 1;
    }
  }
  return moves;
}
/** 움직임을 차례로 적용한 최종 배치. 서버는 이 결과를 정답으로 들고 있는다. */
export function applyHuntMoves(layout: readonly string[], moves: readonly HuntMove[]): string[] {
  const cards = [...layout];
  for (const move of moves) for (const [x, y] of move.swaps) [cards[x], cards[y]] = [cards[y], cards[x]];
  return cards;
}

/** 짝을 전부 맞췄을 때 받는 총가치(젬 환산) — 난이도 예산을 재는 기준이다. */
export function huntPairsGemValue(pairs: readonly string[]): number {
  return pairs.reduce((sum, id) => { const treasure = huntTreasure(id); return sum + (treasure ? huntTreasureGemValue(treasure) : 0); }, 0);
}

/** 정규 이벤트 예산 — 완벽한 판의 기대 총가치가 코인 100당 상한을 넘지 않는다. */
export const DELOPHY_HUNT_BUDGET = EVENT_REWARD_BUDGET.regular;

export interface HuntRun {
  difficulty: HuntDifficultyId;
  /** 놓인 보물 쌍. */
  pairs: string[];
  /** 섞인 뒤의 정답 배치 — 서버만 든다. 화면으로 내려가는 상태에는 없다(`huntPublicRun`). */
  layout: string[];
  /** 짝을 맞춘 슬롯. 맞출 때마다 둘씩 쌓인다. */
  found: number[];
  misses: number;
  /** 이번 짝의 첫 번째로 뒤집은 슬롯. 없으면 `null`. */
  first: number | null;
  /** 이 판에서 지금까지 받은 몫(상한에서 깎인 뒤). */
  collected: Partial<Record<ChestCardCurrency, number>>;
}

export interface HuntPublicRun {
  difficulty: HuntDifficultyId;
  pairs: string[];
  /** 맞춘 슬롯과 그 보물. */
  found: { slot: number; id: string }[];
  misses: number;
  first: { slot: number; id: string } | null;
  collected: HuntRun["collected"];
}

export function huntPublicRun(run: HuntRun): HuntPublicRun {
  return {
    difficulty: run.difficulty, pairs: [...run.pairs],
    found: run.found.map((slot) => ({ slot, id: run.layout[slot] })),
    misses: run.misses,
    first: run.first === null ? null : { slot: run.first, id: run.layout[run.first] },
    collected: { ...run.collected },
  };
}

/** 뒤집기 한 번의 결과. */
export interface HuntFlip {
  slot: number;
  /** 뒤집힌 카드의 보물. */
  id: string;
  /** 첫 번째 카드면 `first`, 두 번째 카드면 짝이 맞았는지(`match`)·틀렸는지(`miss`). */
  step: "first" | "match" | "miss";
  /** 두 번째 카드일 때 앞서 뒤집은 슬롯. */
  firstSlot?: number;
  misses: number;
  /** 이 뒤집기로 판이 끝났는가(세 번 틀렸거나 전부 맞췄다). */
  finished: boolean;
  cleared: boolean;
}

export class HuntFlipError extends Error {}

/** 순수 규칙 — 슬롯을 하나 뒤집는다. 보상 지급은 부르는 쪽(서버)이 맡는다. */
export function flipHuntSlot(run: HuntRun, slot: unknown): { run: HuntRun; flip: HuntFlip } {
  if (!Number.isInteger(slot) || (slot as number) < 0 || (slot as number) >= run.layout.length) throw new HuntFlipError("고를 수 없는 카드입니다.");
  const index = slot as number;
  if (run.found.includes(index) || run.first === index) throw new HuntFlipError("이미 뒤집은 카드입니다.");
  const id = run.layout[index];
  if (run.first === null) {
    return { run: { ...run, first: index }, flip: { slot: index, id, step: "first", misses: run.misses, finished: false, cleared: false } };
  }
  const firstSlot = run.first;
  const match = run.layout[firstSlot] === id;
  const found = match ? [...run.found, firstSlot, index] : [...run.found];
  const misses = run.misses + (match ? 0 : 1);
  const cleared = found.length >= run.layout.length;
  const finished = cleared || misses >= DELOPHY_HUNT.maxMisses;
  return {
    run: { ...run, found, misses, first: null },
    flip: { slot: index, id, step: match ? "match" : "miss", firstSlot, misses, finished, cleared },
  };
}

export interface DelophyHuntState {
  /** 아래 `spent`가 묶인 UTC 주(월요일 날짜). */
  weekKey: string;
  /** 이번 주에 판을 여느라 쓴 코인. */
  spent: number;
  /** 진행 중인 판. 없으면 `null`. */
  run: HuntRun | null;
}

export function createEmptyDelophyHuntState(): DelophyHuntState { return { weekKey: "", spent: 0, run: null }; }

const CURRENCIES: readonly ChestCardCurrency[] = ["gold", "cheesecake", "stamina", "rawStone", "gems", "fossil", "amber"];
function normalizeRun(value: unknown): HuntRun | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<Record<keyof HuntRun, unknown>>;
  const difficulty = huntDifficulty(source.difficulty);
  if (!difficulty) return null;
  const pairs = Array.isArray(source.pairs) ? source.pairs.filter((id): id is string => typeof id === "string" && !!huntTreasure(id)) : [];
  if (pairs.length !== difficulty.pairs || new Set(pairs).size !== pairs.length) return null;
  const layout = Array.isArray(source.layout) ? source.layout.filter((id): id is string => typeof id === "string") : [];
  if (layout.length !== pairs.length * 2 || !pairs.every((id) => layout.filter((card) => card === id).length === 2)) return null;
  const rawFound = Array.isArray(source.found) ? source.found : [];
  const found = rawFound.filter((slot): slot is number => Number.isInteger(slot) && (slot as number) >= 0 && (slot as number) < layout.length);
  if (found.length !== rawFound.length || found.length % 2 !== 0 || new Set(found).size !== found.length) return null;
  for (let index = 0; index < found.length; index += 2) if (layout[found[index]] !== layout[found[index + 1]]) return null;
  const misses = source.misses;
  if (!Number.isInteger(misses) || (misses as number) < 0 || (misses as number) >= DELOPHY_HUNT.maxMisses) return null;
  const first = source.first;
  if (first !== null && (!Number.isInteger(first) || (first as number) < 0 || (first as number) >= layout.length || found.includes(first as number))) return null;
  const collected: HuntRun["collected"] = {};
  const raw = (source.collected && typeof source.collected === "object" ? source.collected : {}) as Record<string, unknown>;
  for (const [currency, amount] of Object.entries(raw)) {
    if ((CURRENCIES as readonly string[]).includes(currency) && Number.isInteger(amount) && (amount as number) > 0) collected[currency as ChestCardCurrency] = amount as number;
  }
  return { difficulty: difficulty.id, pairs, layout, found, misses: misses as number, first: first as number | null, collected };
}

export function normalizeDelophyHuntState(value: unknown): DelophyHuntState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof DelophyHuntState, unknown>>;
  return {
    weekKey: typeof source.weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.weekKey) ? source.weekKey : "",
    spent: Number.isInteger(source.spent) && (source.spent as number) >= 0 ? source.spent as number : 0,
    run: normalizeRun(source.run),
  };
}

export function isValidDelophyHuntState(value: unknown): value is DelophyHuntState {
  return !!value && typeof value === "object" && JSON.stringify(normalizeDelophyHuntState(value)) === JSON.stringify(value);
}

/** 주가 바뀌었으면 쓴 코인을 비운다. 진행 중인 판은 남긴다. */
export function rollDelophyHuntWeek(state: DelophyHuntState, now: Date): DelophyHuntState {
  const { weeklyKey } = missionPeriodKeys(now);
  return state.weekKey === weeklyKey ? { ...state } : { weekKey: weeklyKey, spent: 0, run: state.run };
}

export interface DelophyHuntStatus {
  weekKey: string;
  /** 지금 쓸 수 있는 코인. */
  coins: number;
  /** 이번 주에 번 코인(= 이번 주에 쓴 스테미나). */
  earned: number;
  run: HuntPublicRun | null;
  /** 남은 코인이 사라지는 시각(다음 UTC 월요일 00:00). */
  resetsAt: string;
}

export function delophyHuntStatus(missions: MissionState, ledger: DelophyHuntState, now: Date): DelophyHuntStatus {
  const current = normalizeMissions(missions, now);
  const state = rollDelophyHuntWeek(ledger, now);
  const earned = current.weeklyStamina ?? 0;
  return {
    weekKey: state.weekKey, coins: Math.max(0, earned - state.spent), earned, run: state.run ? huntPublicRun(state.run) : null,
    resetsAt: new Date(Date.parse(`${state.weekKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString(),
  };
}
