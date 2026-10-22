/** 서버와 화면이 함께 읽는 일일 돌림판 규칙. 추첨은 서버만 실행한다. */
export const ROULETTE = {
  id: "research-roulette", adSlot: "roulette-spin", legacyAdSlot: "roulette-chances", counter: "roulette-spins",
  free: 1, adBonus: 1, adLimit: 3, limit: 4,
  startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-12-31T23:59:59+09:00",
} as const;
export const ROULETTE_REWARDS = [
  { currency: "gold", amount: 10000 }, { currency: "cheesecake", amount: 50 },
  { currency: "stamina", amount: 30 }, { currency: "gems", amount: 50 },
  { currency: "rawStone", amount: 100 }, { currency: "gold", amount: 20000 },
] as const;
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
/** 같은 크기의 여섯 칸은 같은 확률이다. 임의의 난수 입력도 인덱스 범위로 제한한다. */
export function rouletteIndex(random: () => number): number {
  const roll = random();
  return Math.min(ROULETTE_REWARDS.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * ROULETTE_REWARDS.length)));
}
