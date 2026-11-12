import { describe, expect, it } from "vitest";
import { relicLevelCap } from "../../src/core/relicProgression";
import { LEVEL_UP_POPUP, levelUpPopupHeight, levelUpRewardHeight } from "../../src/ui/levelUpPopupLayout";
import { playerLevelMilestones } from "../../src/ui/playerLevelTreeModel";

describe("레벨업 판·레벨 나무의 렐릭 레벨 상한 표기", () => {
  it("상한을 연 레벨업만 판에 「LV.a → LV.b」 한 줄을 더 세운다", () => {
    expect(levelUpRewardHeight(true) - levelUpRewardHeight(false)).toBe(LEVEL_UP_POPUP.reward.rangeLine);
    expect(levelUpPopupHeight([], true)).toBeGreaterThan(levelUpPopupHeight([], false));
    // 연구원 5 → 6은 상한을 열고(20 → 25), 6 → 7은 열지 않는다.
    expect(relicLevelCap(6)).toBeGreaterThan(relicLevelCap(5));
    expect(relicLevelCap(7)).toBe(relicLevelCap(6));
  });

  it("나무의 상한 잎은 그 레벨 바로 전 상한에서 출발한다", () => {
    const leaves = playerLevelMilestones().filter((milestone) => milestone.relicCap !== undefined);
    expect(leaves.length).toBeGreaterThan(0);
    for (const leaf of leaves) {
      expect(leaf.relicCapFrom).toBe(relicLevelCap(leaf.level - 1));
      expect(leaf.relicCap).toBe(relicLevelCap(leaf.level));
      expect(leaf.relicCap!).toBeGreaterThan(leaf.relicCapFrom!);
    }
  });
});
