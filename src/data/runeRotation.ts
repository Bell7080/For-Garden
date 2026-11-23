import type { RotationSlot } from "../core/shopRotation";

/**
 * 룬이 나오는 칸. 어느 상품이 후보인지는 여기가 갖고, 상품은 `rotationSlot`으로 칸을 가리킨다.
 *
 * 룬은 어디서 사든 같은 룬이다. 주 무대는 고고학이라 그쪽이 더 자주 열리고 더 싸며, 일반·전리품은
 * 드물게 조금 더 비싸게 판다. 지정 영웅은 4주 연속 닫히면 다음 주에 확정으로 열린다.
 */
export const ROTATION_SLOTS: readonly RotationSlot[] = [
  { id: "arch-daily", period: "daily", chancePercent: 60, candidates: ["arch-rune-daily-uncommon", "arch-rune-daily-rare"] },
  { id: "arch-weekly-a", period: "weekly", chancePercent: 70, candidates: ["arch-rune-weekly-epic", "arch-rune-pick-rare"] },
  { id: "arch-weekly-b", period: "weekly", chancePercent: 20, pityAfterMisses: 4, candidates: ["arch-rune-pick-epic"] },
  { id: "shop-weekly", period: "weekly", chancePercent: 25, candidates: ["shop-rune-weekly"] },
  { id: "raid-weekly", period: "weekly", chancePercent: 30, candidates: ["raid-rune-weekly"] },
  { id: "loot-weekly", period: "weekly", chancePercent: 30, candidates: ["loot-rune-weekly"] },
  // 무역 전시대 — 룬이 아니라 재화 묶음이 돈다(`tradePackages.ts`). 셋은 늘 열리고 후보만 바뀌며,
  // 연구 칸(화석·호박석)만 가끔 열리되 4주 연속 닫히면 다음 주는 확정이다(응태 승인 2026-11-23).
  { id: "trade-weekly-supply", period: "weekly", chancePercent: 100, candidates: ["trade-cheesecake-supply", "trade-cheesecake-bulk"] },
  { id: "trade-weekly-funds", period: "weekly", chancePercent: 100, candidates: ["trade-research-grant", "trade-gold-vault"] },
  { id: "trade-weekly-research", period: "weekly", chancePercent: 35, pityAfterMisses: 4, candidates: ["trade-fossil-case", "trade-amber-case"] },
  { id: "trade-daily", period: "daily", chancePercent: 100, candidates: ["trade-daily-bundle", "trade-gold-bundle", "trade-cheesecake-bundle"] },
];

export function rotationSlot(id: string): RotationSlot | undefined {
  return ROTATION_SLOTS.find((slot) => slot.id === id);
}
