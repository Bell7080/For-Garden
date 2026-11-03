import { missionPeriodKeys, normalizeMissions, type MissionState } from "./missions";
import { EVENT_REWARD_BUDGET } from "./eventRewardBudget";

/**
 * 정기 이벤트 「보물상자」 — 코인을 내고 상자를 열면 **카드를 다섯 번 고른다**. 1~4번째는 세 장, 마지막은 네 장이
 * 앞면으로 놓이고, 하나를 골라 뒤집어 성공하면 그 보상을, 실패하면 **그 카드 한 장만** 놓친다. 모은 것은 지켜진다.
 * (예전 8단계 강화형은 4단계에서 멈추는 것이 늘 최선이라 "안정권에서 먹고 끝"이 정답이어서 걷어 냈다 — 응태 결정,
 * 2026-11-02. 카드형은 멈출 자리가 없고 매 장마다 안전·보통·도박 중 하나를 고르는 재미만 남는다.)
 *
 * **코인은 이번 주에 쓴 스테미나와 1:1이다.** 스테미나를 쓰는 모든 경계가 이미 지나는 임무 사건(`stamina_spent`)이
 * 이번 주 몫(`MissionState.weeklyStamina`)을 센다. 장부(`ChestForgeState`)는 이번 주에 **쓴** 코인과 진행 중인 상자만
 * 든다. 주가 바뀌면(UTC 월요일 00:00) 코인이 사라지지만, 진행 중인 상자는 이미 값을 치렀으므로 이어서 끝낼 수 있다.
 *
 * **보상은 반복 보상 승인선이 아니라 이벤트 보상 예산을 따른다**(`eventRewardBudget.ts`의 정규 이벤트 — 응태 결정,
 * 2026-11-02 "이벤트 보상은 말 그대로 이벤트니까 매력이 있어야 한다"). 카드 한 장의 수치는 화끈하게 두고, 그 카드가
 * **나오는 확률**로 총량을 묶는다(돌림판의 젬 1,000 칸과 같은 결).
 */
export const CHEST_FORGE = {
  id: "chest-forge",
  /** 상자 하나에서 고르는 횟수. */
  rounds: 5,
} as const;

/**
 * 상자 세 가지(응태 결정, 2026-11-03) — 100 코인 상자가 카드표 그대로이고, 200·300 코인 상자는 **모든 카드의 수량을
 * 키우는 대신 받을 확률을 조금 깎는다**(위험 대비 큰 보상). 기대값은 수량 배율 × 확률 배율이라 200은 약 2.2배, 300은
 * 약 3.4배 — 코인 하나당으로도 큰 상자일수록 낫다("300개는 확실히 3배치"). 카드 고르기·나오는 확률은 셋이 같다.
 */
export type ChestBoxId = "small" | "large" | "grand";
export interface ChestBox {
  readonly id: ChestBoxId;
  /** 상자 하나를 여는 값(코인). */
  readonly entryCost: number;
  /** 카드 수량 배율. */
  readonly reward: number;
  /** 받을 확률 배율(카드 앞면의 % 자체가 이 배율로 낮아진다). */
  readonly chance: number;
}
export const CHEST_BOXES: readonly ChestBox[] = [
  { id: "small", entryCost: 100, reward: 1, chance: 1 },
  { id: "large", entryCost: 200, reward: 2.4, chance: 0.92 },
  { id: "grand", entryCost: 300, reward: 4, chance: 0.85 },
];
export function chestBox(id: unknown): ChestBox | undefined { return CHEST_BOXES.find((box) => box.id === id); }
/** 진행 중인 상자의 종류 — 상자 종류가 생기기 전에 연 상자는 카드표 그대로였으므로 작은 상자로 읽는다. */
export function chestRunBox(run: { box?: ChestBoxId } | null | undefined): ChestBox { return chestBox(run?.box) ?? CHEST_BOXES[0]; }

export type ChestCardTier = "safe" | "mid" | "risk" | "big" | "jackpot";
export type ChestCardCurrency = "gold" | "cheesecake" | "stamina" | "rawStone" | "gems" | "fossil" | "amber";
export interface ChestCard {
  readonly id: string;
  readonly tier: ChestCardTier;
  readonly currency: ChestCardCurrency;
  readonly amount: number;
  /** 뒤집었을 때 받을 확률(%). 카드 앞면에 그대로 적힌다. */
  readonly chance: number;
}

/**
 * 카드표(응태 결정, 2026-11-02 · 2026-11-03 상자 값 300 → 200, 골드·치즈케이크·원석 상향). 젬 환산(`TRADE_GEM_RATE`): 골드 500 · 치즈케이크 2 · 원석 5 · 스테미나 0.83 · 화석/호박석 300.
 * 원석은 고고학이 주 수급처라 안전 카드에만 둔다(`rawStoneSupply.test`).
 */
export const CHEST_CARDS: readonly ChestCard[] = [
  { id: "safe-gold", tier: "safe", currency: "gold", amount: 15_000, chance: 95 },
  { id: "safe-cheesecake", tier: "safe", currency: "cheesecake", amount: 15, chance: 95 },
  { id: "safe-stamina", tier: "safe", currency: "stamina", amount: 20, chance: 95 },
  { id: "safe-stone", tier: "safe", currency: "rawStone", amount: 15, chance: 95 },
  { id: "mid-gold", tier: "mid", currency: "gold", amount: 45_000, chance: 80 },
  { id: "mid-cheesecake", tier: "mid", currency: "cheesecake", amount: 45, chance: 80 },
  { id: "mid-gems", tier: "mid", currency: "gems", amount: 30, chance: 80 },
  { id: "mid-stamina", tier: "mid", currency: "stamina", amount: 60, chance: 80 },
  { id: "risk-gems", tier: "risk", currency: "gems", amount: 100, chance: 60 },
  { id: "risk-cheesecake", tier: "risk", currency: "cheesecake", amount: 85, chance: 60 },
  { id: "risk-gold", tier: "risk", currency: "gold", amount: 85_000, chance: 60 },
  { id: "big-gems", tier: "big", currency: "gems", amount: 300, chance: 30 },
  { id: "big-fossil", tier: "big", currency: "fossil", amount: 1, chance: 35 },
  { id: "big-amber", tier: "big", currency: "amber", amount: 1, chance: 35 },
  { id: "jackpot-gems", tier: "jackpot", currency: "gems", amount: 1_000, chance: 30 },
  { id: "jackpot-gems-max", tier: "jackpot", currency: "gems", amount: 3_000, chance: 10 },
];

/**
 * 한 번 고를 때 놓이는 자리와 자리마다 나오는 등급의 가중치. 1~4번째는 [안전][보통][도박] 세 장이고, 도박 자리의
 * 10%는 대형이다. 마지막에는 네 번째 자리가 더해져 대형 90% · 대박 10%다. 같은 등급 안에서는 카드가 고르게 나온다.
 */
const SLOT: Record<"safe" | "mid" | "spicy" | "special", readonly (readonly [ChestCardTier, number])[]> = {
  safe: [["safe", 1]], mid: [["mid", 1]], spicy: [["risk", 90], ["big", 10]], special: [["big", 90], ["jackpot", 10]],
};
export function chestOfferSlots(round: number): readonly (readonly (readonly [ChestCardTier, number])[])[] {
  return round >= CHEST_FORGE.rounds - 1 ? [SLOT.safe, SLOT.mid, SLOT.spicy, SLOT.special] : [SLOT.safe, SLOT.mid, SLOT.spicy];
}

const GEM_VALUE: Record<ChestCardCurrency, number> = { gold: 1 / 500, cheesecake: 2, stamina: 0.83, rawStone: 5, gems: 1, fossil: 300, amber: 300 };
/** 재화 한 단위의 젬 환산값 — 다른 정규 이벤트의 공급 상한도 같은 시세를 읽는다. */
export function chestCurrencyGemValue(currency: ChestCardCurrency): number { return GEM_VALUE[currency]; }
export function chestCardGemValue(card: ChestCard): number { return GEM_VALUE[card.currency] * card.amount; }
export function chestCard(id: string, box: ChestBox = CHEST_BOXES[0]): ChestCard | undefined {
  const card = CHEST_CARDS.find((entry) => entry.id === id);
  return card ? chestBoxCard(card, box) : undefined;
}
/** 상자 종류가 적용된 카드 — 수량은 깔끔한 단위로(골드 1,000 · 나머지 정수), 확률은 정수 %로 반올림한다. */
export function chestBoxCard(card: ChestCard, box: ChestBox): ChestCard {
  if (box.reward === 1 && box.chance === 1) return card;
  const raw = card.amount * box.reward;
  const amount = card.currency === "gold" ? Math.round(raw / 1_000) * 1_000 : Math.max(1, Math.round(raw));
  return { ...card, amount, chance: Math.max(1, Math.round(card.chance * box.chance)) };
}

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

/** `round`번째(0부터) 고르기에 놓일 카드들. 난수는 서버만 굴린다. */
export function rollChestOffer(round: number, random: () => number): string[] {
  return chestOfferSlots(round).map((slot) => {
    const tier = pickWeighted(slot, random);
    const cards = CHEST_CARDS.filter((card) => card.tier === tier);
    return cards[Math.min(cards.length - 1, Math.floor(clampRoll(random) * cards.length))].id;
  });
}

/** 뒤집기 한 번. 난수가 확률 아래면 성공이다. */
export function rollChestCard(card: ChestCard, random: () => number): boolean {
  return clampRoll(random) < card.chance / 100;
}

/**
 * 상자 하나의 기대값(젬 환산). `pick`이 놓인 카드 중 무엇을 고를지 정한다 — 기본은 기대값이 가장 큰 카드라
 * 공급의 위쪽 끝이다. 자리는 서로 독립이라 모든 조합을 그대로 센다.
 */
export function chestBoxExpectedValue(pick: (cards: readonly ChestCard[]) => ChestCard = bestCard, box: ChestBox = CHEST_BOXES[0]): number {
  let total = 0;
  for (let round = 0; round < CHEST_FORGE.rounds; round += 1) {
    let combos: { cards: ChestCard[]; p: number }[] = [{ cards: [], p: 1 }];
    for (const slot of chestOfferSlots(round)) {
      const weightTotal = slot.reduce((sum, [, weight]) => sum + weight, 0);
      const options = slot.flatMap(([tier, weight]) => {
        const cards = CHEST_CARDS.filter((card) => card.tier === tier);
        return cards.map((card) => ({ card: chestBoxCard(card, box), p: weight / weightTotal / cards.length }));
      });
      combos = combos.flatMap((combo) => options.map((option) => ({ cards: [...combo.cards, option.card], p: combo.p * option.p })));
    }
    for (const combo of combos) { const card = pick(combo.cards); total += combo.p * chestCardGemValue(card) * card.chance / 100; }
  }
  return total;
}
function bestCard(cards: readonly ChestCard[]): ChestCard {
  return cards.reduce((best, card) => (chestCardGemValue(card) * card.chance > chestCardGemValue(best) * best.chance ? card : best));
}

/** 놓인 카드 중 기대값(젬 환산 × 확률)이 가장 큰 카드. 공급 상한과 상자 등급 문턱을 재는 기준 선택이다. */
export function chestBestCard(cards: readonly ChestCard[]): ChestCard { return bestCard(cards); }

/** 등급의 차례 — 아래일수록 흔하고 위일수록 값이 크다. 카드가 상자에 들어가는 연출의 화려함이 이 차례를 그대로 쓴다. */
export const CHEST_TIER_ORDER: readonly ChestCardTier[] = ["safe", "mid", "risk", "big", "jackpot"];
export function chestCardFlair(card: ChestCard): number { return Math.max(0, CHEST_TIER_ORDER.indexOf(card.tier)); }

/**
 * 상자 등급 문턱 — 이 상자에서 **지금까지 모은 몫**의 젬 환산 가치가 넘을 때마다 상자가 한 단계 화려해진다.
 * 기대값이 가장 큰 카드를 고르는 상자 20만 번 모의의 최종 가치 분포에서 잡았다: 180은 열에 아홉이 닿는 첫 단계,
 * 380은 중앙값 조금 아래, 640은 상위 4분의 1, 920은 상위 4% 남짓(사실상 대형 둘이나 대박)이다.
 * 모은 몫은 줄지 않으므로 등급도 내려가지 않는다. 값을 바꾸면 `chestForge.test`의 분포 띠를 함께 다시 잰다.
 */
export const CHEST_GRADE_THRESHOLDS = [180, 380, 640, 920] as const;
export const CHEST_GRADE_MAX = CHEST_GRADE_THRESHOLDS.length;
export function chestCollectedValue(collected: Partial<Record<ChestCardCurrency, number>>): number {
  return (Object.entries(collected) as [ChestCardCurrency, number | undefined][])
    .reduce((sum, [currency, amount]) => sum + (GEM_VALUE[currency] ?? 0) * Math.max(0, amount ?? 0), 0);
}
/** 상자 종류에 맞춘 문턱 — 기대값이 늘어난 만큼(수량 × 확률 배율) 문턱도 함께 늘어 큰 상자도 같은 비율로 화려해진다. */
export function chestGradeThresholds(box: ChestBox = CHEST_BOXES[0]): readonly number[] {
  const scale = box.reward * box.chance;
  return CHEST_GRADE_THRESHOLDS.map((threshold) => Math.round(threshold * scale));
}
export function chestGrade(value: number, box: ChestBox = CHEST_BOXES[0]): number {
  return chestGradeThresholds(box).filter((threshold) => value >= threshold).length;
}
/** 상자 아래 게이지 — 지금 등급과 다음 문턱까지 찬 비율(0~1). 마지막 등급이면 1이다. */
export function chestGradeProgress(value: number, box: ChestBox = CHEST_BOXES[0]): { grade: number; ratio: number } {
  const thresholds = chestGradeThresholds(box);
  const grade = chestGrade(value, box);
  if (grade >= CHEST_GRADE_MAX) return { grade, ratio: 1 };
  const from = grade === 0 ? 0 : thresholds[grade - 1];
  const to = thresholds[grade];
  return { grade, ratio: Math.max(0, Math.min(1, (value - from) / (to - from))) };
}

/** 정규 이벤트 예산 — 상자 하나의 최선 기대값이 코인(= 스테미나) 100당 상한을 넘지 않는다. */
export const CHEST_FORGE_BUDGET = EVENT_REWARD_BUDGET.regular;

export interface ChestForgeRun {
  /** 상자 종류. 없으면 작은 상자다(종류가 생기기 전에 연 상자). */
  box?: ChestBoxId;
  /** 지금 고르는 차례(0부터). */
  round: number;
  /** 지금 놓인 카드(`CHEST_CARDS`의 ID). */
  offer: string[];
  /** 이 상자에서 지금까지 받은 몫(상한에서 깎인 뒤). */
  collected: Partial<Record<ChestCardCurrency, number>>;
}

export interface ChestForgeState {
  /** 아래 `spent`가 묶인 UTC 주(월요일 날짜). */
  weekKey: string;
  /** 이번 주에 상자를 여느라 쓴 코인. */
  spent: number;
  /** 진행 중인 상자. 없으면 `null`. */
  run: ChestForgeRun | null;
}

export function createEmptyChestForgeState(): ChestForgeState { return { weekKey: "", spent: 0, run: null }; }

const CURRENCIES: readonly ChestCardCurrency[] = ["gold", "cheesecake", "stamina", "rawStone", "gems", "fossil", "amber"];
function normalizeRun(value: unknown): ChestForgeRun | null {
  if (!value || typeof value !== "object") return null;
  const source = value as Partial<Record<keyof ChestForgeRun, unknown>>;
  const round = source.round;
  if (!Number.isInteger(round) || (round as number) < 0 || (round as number) >= CHEST_FORGE.rounds) return null;
  const offer = Array.isArray(source.offer) ? source.offer.filter((id): id is string => typeof id === "string" && !!chestCard(id)) : [];
  if (offer.length !== chestOfferSlots(round as number).length) return null;
  const collected: ChestForgeRun["collected"] = {};
  const raw = (source.collected && typeof source.collected === "object" ? source.collected : {}) as Record<string, unknown>;
  // 받은 차례대로 쌓이므로 원래 키 순서를 지킨다 — 저장 검증이 정규화한 값과 그대로 견준다.
  for (const [currency, amount] of Object.entries(raw)) {
    if ((CURRENCIES as readonly string[]).includes(currency) && Number.isInteger(amount) && (amount as number) > 0) collected[currency as ChestCardCurrency] = amount as number;
  }
  const box = chestBox(source.box);
  return { ...(box ? { box: box.id } : {}), round: round as number, offer, collected };
}

/** 예전 강화형 장부(`stage`)는 진행 중인 상자 없이 읽는다 — 그 상자는 이번 주 코인만 쓴 채 끝난다. */
export function normalizeChestForgeState(value: unknown): ChestForgeState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<Record<keyof ChestForgeState, unknown>>;
  return {
    weekKey: typeof source.weekKey === "string" && /^\d{4}-\d{2}-\d{2}$/.test(source.weekKey) ? source.weekKey : "",
    spent: Number.isInteger(source.spent) && (source.spent as number) >= 0 ? source.spent as number : 0,
    run: normalizeRun(source.run),
  };
}

export function isValidChestForgeState(value: unknown): value is ChestForgeState {
  return !!value && typeof value === "object" && JSON.stringify(normalizeChestForgeState(value)) === JSON.stringify(value);
}

/** 주가 바뀌었으면 쓴 코인을 비운다. 진행 중인 상자는 남긴다. */
export function rollChestForgeWeek(state: ChestForgeState, now: Date): ChestForgeState {
  const { weeklyKey } = missionPeriodKeys(now);
  return state.weekKey === weeklyKey ? { ...state } : { weekKey: weeklyKey, spent: 0, run: state.run };
}

export interface ChestForgeStatus {
  weekKey: string;
  /** 지금 쓸 수 있는 코인. */
  coins: number;
  /** 이번 주에 번 코인(= 이번 주에 쓴 스테미나). */
  earned: number;
  run: ChestForgeRun | null;
  /** 남은 코인이 사라지는 시각(다음 UTC 월요일 00:00). */
  resetsAt: string;
}

/** 지금 상자를 열 수 있는가 — 진행 중인 상자가 있거나 코인이 한 번 값 이상이다(로비 이벤트 점·정렬). */
export function chestForgePlayable(status: Pick<ChestForgeStatus, "coins" | "run">): boolean {
  return status.run !== null || status.coins >= Math.min(...CHEST_BOXES.map((box) => box.entryCost));
}

export function chestForgeStatus(missions: MissionState, ledger: ChestForgeState, now: Date): ChestForgeStatus {
  const current = normalizeMissions(missions, now);
  const state = rollChestForgeWeek(ledger, now);
  const earned = current.weeklyStamina ?? 0;
  return {
    weekKey: state.weekKey, coins: Math.max(0, earned - state.spent), earned, run: state.run ? structuredClone(state.run) : null,
    resetsAt: new Date(Date.parse(`${state.weekKey}T00:00:00.000Z`) + 7 * 86_400_000).toISOString(),
  };
}
