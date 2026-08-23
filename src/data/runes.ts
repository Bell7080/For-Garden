import type { RuneRarity } from "../core/runes";

/** 희귀도와 누적 시도 번호별 골드 비용표다. 운영 수치는 이 표에서만 조정한다. */
export const RUNE_ENHANCEMENT_GOLD_COSTS: Readonly<Record<RuneRarity, readonly number[]>> = {
  uncommon: [100, 150, 200, 250, 300, 350],
  rare: [200, 250, 300, 350, 400, 450, 500, 550, 600],
  epic: [400, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500],
  legendary: [800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400, 2600, 2800, 3000, 3200, 3400, 3600],
};

/** 다음 시도의 누적 인덱스로 골드 비용을 조회하며 완료 후 요청은 거부한다. */
export function runeEnhancementGoldCost(rarity: RuneRarity, completedAttempts: number): number {
  if (!Number.isInteger(completedAttempts) || completedAttempts < 0) throw new RangeError("누적 강화 횟수는 0 이상의 정수여야 합니다.");
  const cost = RUNE_ENHANCEMENT_GOLD_COSTS[rarity][completedAttempts];
  if (cost === undefined) throw new RangeError("모든 강화를 마친 룬에는 다음 비용이 없습니다.");
  return cost;
}
