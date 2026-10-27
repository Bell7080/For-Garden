/** 서버와 화면이 함께 읽는 일일 돌림판 규칙. 추첨은 서버만 실행한다. */
export const ROULETTE = {
  id: "research-roulette", adSlot: "roulette-spin", legacyAdSlot: "roulette-chances", counter: "roulette-spins",
  free: 1, adBonus: 1, adLimit: 3, limit: 4,
  startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-12-31T23:59:59+09:00",
} as const;
/**
 * 여덟 칸의 지급표. **칸 크기는 같지만 확률은 칸마다 다르다** — 확률은 `weight`(1,000분율)가 정하고, 화면의
 * 확률 정보 창이 같은 값을 그대로 적는다.
 *
 * 값의 근거(젬 환산 — `TRADE_GEM_RATE`: 골드 500 · 치즈케이크 2 · 원석 5 · 스테미나 0.83/개):
 *   골드 1만 20 · 치즈케이크 50 25 · 스테미나 30 25 · 원석 100 20 · 골드 2만 40 · 젬 100/300/1,000
 * 한 번의 기대값은 젬 약 42.8(그중 젬 직접 21.5)이다. 예전 여섯 칸 균등(젬 50 포함)이 약 30이라 하루
 * 네 번이면 젬 50 남짓 더 얹힌다 — 젬 1,000은 한 번에 0.5%, 하루 네 번을 다 돌려도 2% 남짓이라 기대값을
 * 끌어올리지 않고 "터질지도 모른다"만 남긴다. 가장 흔한 칸(골드 1만, 30%)이 사실상 꽝 자리다.
 *
 * 순서가 곧 바퀴 위의 차례다(12시에서 시계 방향). 큰 칸과 작은 칸을 번갈아 세워 한쪽에 몰리지 않게 한다.
 * 첫 칸은 가장 흔한 골드 1만이다 — 난수 0이 그 칸을 고른다.
 */
export const ROULETTE_REWARDS = [
  { currency: "gold", amount: 10000, weight: 300, tier: "common" },
  { currency: "gems", amount: 100, weight: 90, tier: "rare" },
  { currency: "cheesecake", amount: 50, weight: 180, tier: "common" },
  { currency: "gems", amount: 1000, weight: 5, tier: "jackpot" },
  { currency: "stamina", amount: 30, weight: 150, tier: "common" },
  { currency: "gold", amount: 20000, weight: 100, tier: "common" },
  { currency: "rawStone", amount: 100, weight: 150, tier: "common" },
  { currency: "gems", amount: 300, weight: 25, tier: "rare" },
] as const;
/** 가중치의 합 — 확률은 `weight / ROULETTE_WEIGHT_TOTAL`이다. */
export const ROULETTE_WEIGHT_TOTAL = ROULETTE_REWARDS.reduce((sum, reward) => sum + reward.weight, 0);
export type RouletteReward = (typeof ROULETTE_REWARDS)[number];
export interface RouletteStatus {
  date: string; active: boolean; used: number; remaining: number; bonusAvailable: boolean;
  bonusRemaining: number; adFree: boolean; resetsAt: string;
}
export function rouletteStatus(ledger: { date: string; claimsBySlot: Record<string, number> }, now: Date, adFree = false): RouletteStatus {
  const date = now.toISOString().slice(0, 10);
  const counts = ledger.date === date ? ledger.claimsBySlot : {};
  const used = counts[ROULETTE.counter] ?? 0;
  // v0.324의 슬롯은 광고 한 번이 추가 세 번 전체를 열었다. 당일 장부가 남은 채 배포되어도 이미 본 광고를
  // 다시 요구하거나 네 번을 넘겨 주지 않도록, 예전 키 한 건은 그날의 세 번을 모두 연 것으로 읽는다.
  const legacyBonusClaims = (counts[ROULETTE.legacyAdSlot] ?? 0) > 0 ? ROULETTE.adLimit : 0;
  const bonusClaims = Math.min(ROULETTE.adLimit, Math.max(legacyBonusClaims, counts[ROULETTE.adSlot] ?? 0));
  const bonusRemaining = ROULETTE.adLimit - bonusClaims;
  return { date, active: now.getTime() >= Date.parse(ROULETTE.startsAt) && now.getTime() < Date.parse(ROULETTE.endsAt),
    used, remaining: Math.max(0, ROULETTE.free + bonusClaims * ROULETTE.adBonus - used),
    bonusAvailable: bonusRemaining > 0, bonusRemaining, adFree, resetsAt: new Date(Date.parse(date) + 86400000).toISOString() };
}
/** 칸 하나의 확률(0~1). 화면의 확률 정보가 읽는다. */
export function rouletteRate(index: number): number {
  return (ROULETTE_REWARDS[index]?.weight ?? 0) / ROULETTE_WEIGHT_TOTAL;
}
/** 가중치를 누적해 칸을 고른다. 임의의 난수 입력도 [0, 1) 안으로 제한해 인덱스 범위를 벗어나지 않는다. */
export function rouletteIndex(random: () => number): number {
  const raw = random();
  const roll = Math.min(1 - Number.EPSILON, Math.max(0, Number.isFinite(raw) ? raw : 0)) * ROULETTE_WEIGHT_TOTAL;
  let cumulative = 0;
  for (let index = 0; index < ROULETTE_REWARDS.length; index += 1) {
    cumulative += ROULETTE_REWARDS[index].weight;
    if (roll < cumulative) return index;
  }
  return ROULETTE_REWARDS.length - 1;
}
/** 확률표에 서는 차례 — 귀한 칸부터. 바퀴 위의 차례가 아니라 확률이 낮은 순이라 무엇이 대박인지 먼저 읽힌다. */
export function rouletteRateOrder(): number[] {
  return ROULETTE_REWARDS.map((_, index) => index).sort((a, b) => ROULETTE_REWARDS[a].weight - ROULETTE_REWARDS[b].weight || a - b);
}
/** 바늘(12시) 아래에 지금 선 칸. 바퀴 각도(도, 시계 방향이 +)에서 구한다 — 첫 칸이 각도 0에서 12시에 선다. */
export function rouletteIndexAtPointer(wheelAngle: number): number {
  const count = ROULETTE_REWARDS.length;
  const step = 360 / count;
  const local = ((-wheelAngle % 360) + 360 + step / 2) % 360;
  return Math.floor(local / step) % count;
}
