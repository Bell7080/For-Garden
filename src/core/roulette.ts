/** 서버와 화면이 함께 읽는 일일 돌림판 규칙. 추첨은 서버만 실행한다. */
export const ROULETTE = {
  id: "research-roulette", adSlot: "roulette-chances", counter: "roulette-spins",
  free: 1, adBonus: 3, limit: 4,
  startsAt: "2026-09-01T00:00:00+09:00", endsAt: "2026-12-31T23:59:59+09:00",
} as const;
export const ROULETTE_REWARDS = [
  { currency: "gold", amount: 5000 }, { currency: "cheesecake", amount: 30 },
  { currency: "stamina", amount: 20 }, { currency: "gems", amount: 20 },
  { currency: "rawStone", amount: 50 }, { currency: "gold", amount: 10000 },
] as const;
export type RouletteReward = (typeof ROULETTE_REWARDS)[number];
export interface RouletteStatus {
  date: string; active: boolean; used: number; remaining: number; bonusAvailable: boolean;
  adFree: boolean; resetsAt: string;
}
export function rouletteStatus(ledger: { date: string; claimsBySlot: Record<string, number> }, now: Date, adFree = false): RouletteStatus {
  const date = now.toISOString().slice(0, 10);
  const counts = ledger.date === date ? ledger.claimsBySlot : {};
  const used = counts[ROULETTE.counter] ?? 0;
  const bonus = (counts[ROULETTE.adSlot] ?? 0) > 0;
  return { date, active: now.getTime() >= Date.parse(ROULETTE.startsAt) && now.getTime() < Date.parse(ROULETTE.endsAt),
    used, remaining: Math.max(0, ROULETTE.free + (bonus ? ROULETTE.adBonus : 0) - used),
    bonusAvailable: !bonus, adFree, resetsAt: new Date(Date.parse(date) + 86400000).toISOString() };
}
/** 같은 크기의 여섯 칸은 같은 확률이다. 임의의 난수 입력도 인덱스 범위로 제한한다. */
export function rouletteIndex(random: () => number): number {
  const roll = random();
  return Math.min(ROULETTE_REWARDS.length - 1, Math.max(0, Math.floor((Number.isFinite(roll) ? roll : 0) * ROULETTE_REWARDS.length)));
}
