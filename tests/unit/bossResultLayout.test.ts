import { describe, expect, it } from "vitest";
import { BOSS_RESULT_LAYOUT as L, bossResultBoundsOverlap, bossResultUtilityBounds, type BossResultBounds } from "../../src/ui/bossResultLayout";

/** 1080×1920 폰토스 결과 화면에서 점수와 세 조작의 실제 bounds를 회귀 테스트로 고정한다. */
describe("boss result layout", () => {
  const score: BossResultBounds = L.score;
  const lobby: BossResultBounds = L.lobby;
  const utilities = bossResultUtilityBounds();

  it("fixes the score, weekly record, contribution, and lobby bounds", () => {
    expect(score).toEqual({ left: 90, top: 790, width: 900, height: 500 });
    expect(utilities).toEqual([
      { left: 196, top: 1406, width: 330, height: 88 },
      { left: 554, top: 1406, width: 330, height: 88 },
    ]);
    expect(lobby).toEqual({ left: 230, top: 1640, width: 620, height: 112 });
  });

  it("keeps every requested region inside the viewport and mutually separate", () => {
    const bounds = [score, ...utilities, lobby];
    for (const item of bounds) {
      expect(item.left).toBeGreaterThanOrEqual(0); expect(item.top).toBeGreaterThanOrEqual(0);
      expect(item.left + item.width).toBeLessThanOrEqual(L.viewport.width);
      expect(item.top + item.height).toBeLessThanOrEqual(L.viewport.height);
    }
    for (let left = 0; left < bounds.length; left += 1) {
      for (let right = left + 1; right < bounds.length; right += 1) expect(bossResultBoundsOverlap(bounds[left], bounds[right])).toBe(false);
    }
  });
});
