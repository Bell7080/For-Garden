import { describe, expect, it } from "vitest";
import { BATTLE_CONTRIBUTION_LAYOUT as L, battleContributionBounds, boundsOverlap } from "../../src/ui/battleContributionLayout";

/** 순수 배치표가 1080×1920 전투 HUD의 예약 영역을 침범하지 않는지 고정한다. */
describe("battle contribution panel layout", () => {
  it("keeps collapsed and expanded bounds inside the reference viewport", () => {
    for (const bounds of [battleContributionBounds(false), battleContributionBounds(true)]) {
      expect(bounds.left).toBeGreaterThanOrEqual(0); expect(bounds.top).toBeGreaterThanOrEqual(0);
      expect(bounds.left + bounds.width).toBeLessThanOrEqual(1080); expect(bounds.top + bounds.height).toBeLessThanOrEqual(1920);
    }
    expect(battleContributionBounds(true).width).toBeGreaterThanOrEqual(320);
    expect(battleContributionBounds(true).width).toBeLessThanOrEqual(380);
    expect(battleContributionBounds(true).height).toBeLessThanOrEqual(760);
  });

  it("gives all three category chips at least 72px touch width", () => {
    expect(L.categories.itemWidth).toBeGreaterThanOrEqual(72);
    expect(L.categories.height).toBeGreaterThanOrEqual(72);
    expect(L.categories.itemWidth * 3).toBeLessThanOrEqual(L.categories.width);
  });

  it("fits five rows and avoids stage, boss HUD, and bottom profiles", () => {
    const panel = battleContributionBounds(true);
    const lastRowBottom = L.rows.top + (L.rows.count - 1) * (L.rows.height + L.rows.gap) + L.rows.height;
    expect(L.rows.count).toBe(5); expect(lastRowBottom).toBeLessThanOrEqual(panel.top + panel.height);
    expect(boundsOverlap(panel, L.protected.stage)).toBe(false);
    expect(boundsOverlap(panel, L.protected.bossHud)).toBe(false);
    expect(boundsOverlap(panel, L.protected.profiles)).toBe(false);
  });
});
