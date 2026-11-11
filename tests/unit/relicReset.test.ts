import { describe, expect, it } from "vitest";
import { feedRelic } from "../../src/core/relicProgression";
import { canResetRelic, relicResetGemCost, relicResetRefund, resetRelicProgress, RELIC_RESET_FREE_MAX_LEVEL } from "../../src/core/relicReset";
import type { RelicProgress } from "../../src/core/types";

const fresh = (breakthrough = 4): RelicProgress => ({ level: 1, exp: 0, breakthrough, bondLevel: 3, bondXp: 100, lastLobbyInteractionDate: "", heartGemSlots: ["a", null, null] });

describe("레벨 초기화", () => {
  it("돌려받는 치즈케이크는 급여로 쓴 치즈케이크와 정확히 같다(회수율 100%)", () => {
    for (const feeds of [1, 3, 7, 50, 333, 1_000, 5_000]) {
      const result = feedRelic(fresh(), 10_000_000, feeds);
      expect(relicResetRefund(result.progress)).toBe(10_000_000 - result.cheesecake);
    }
  });

  it("20레벨까지는 무료이고 그 뒤로 10레벨 구간마다 젬 100이 오른다", () => {
    expect(relicResetGemCost(1)).toBe(0);
    expect(relicResetGemCost(RELIC_RESET_FREE_MAX_LEVEL)).toBe(0);
    expect([21, 30, 31, 40, 41, 50, 51, 60].map(relicResetGemCost)).toEqual([100, 100, 200, 200, 300, 300, 400, 400]);
  });

  it("레벨·경험치만 되돌리고 돌파·유대·룬은 그대로 둔다", () => {
    const fed = feedRelic(fresh(), 10_000_000, 400).progress;
    expect(canResetRelic(fed)).toBe(true);
    const reset = resetRelicProgress(fed);
    expect(reset).toEqual({ ...fed, level: 1, exp: 0 });
    expect(canResetRelic(reset)).toBe(false);
  });
});
