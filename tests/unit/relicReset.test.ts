import { describe, expect, it } from "vitest";
import { feedRelic, RELIC_MAX_LEVEL } from "../../src/core/relicProgression";
import { canResetRelic, relicInvestedCheesecake, relicResetLoss, relicResetRefund, resetRelicProgress, RELIC_RESET_FULL_REFUND_LEVEL } from "../../src/core/relicReset";
import type { RelicProgress } from "../../src/core/types";

const fresh = (breakthrough = 4): RelicProgress => ({ level: 1, exp: 0, breakthrough, bondLevel: 3, bondXp: 100, lastLobbyInteractionDate: "", heartGemSlots: ["a", null, null] });

describe("레벨 초기화", () => {
  it("먹인 치즈케이크는 경험치에서 정확히 되살아난다", () => {
    for (const feeds of [1, 3, 7, 50, 333, 1_000, 5_000]) {
      const result = feedRelic(fresh(), 10_000_000, feeds, RELIC_MAX_LEVEL);
      expect(relicInvestedCheesecake(result.progress)).toBe(10_000_000 - result.cheesecake);
    }
  });

  it("21레벨까지는 먹인 것을 100% 돌려받는다", () => {
    for (const level of [1, 5, 11, 20, RELIC_RESET_FULL_REFUND_LEVEL]) {
      const progress = { level, exp: 0 };
      expect(relicResetRefund(progress)).toBe(relicInvestedCheesecake(progress));
      expect(relicResetLoss(progress)).toBe(0);
    }
  });

  it("21레벨을 넘긴 몫만 90%로 돌려받는다 — 21과 22 사이에 낭떠러지가 없다", () => {
    const safe = relicInvestedCheesecake({ level: RELIC_RESET_FULL_REFUND_LEVEL, exp: 0 });
    for (const level of [22, 25, 31, 41, 60, 100]) {
      const progress = { level, exp: 0 };
      const over = relicInvestedCheesecake(progress) - safe;
      expect(relicResetRefund(progress)).toBe(safe + Math.floor(over * 0.9));
      expect(relicResetLoss(progress)).toBeGreaterThan(0);
      expect(relicResetLoss(progress)).toBeLessThanOrEqual(Math.ceil(over * 0.1));
    }
    // 레벨이 오를수록 돌려받는 양은 줄지 않는다.
    let last = 0;
    for (let level = 1; level <= 100; level += 1) {
      const refund = relicResetRefund({ level, exp: 0 });
      expect(refund).toBeGreaterThanOrEqual(last);
      last = refund;
    }
  });

  it("레벨·경험치만 되돌리고 돌파·유대·룬은 그대로 둔다", () => {
    const fed = feedRelic(fresh(), 10_000_000, 400, RELIC_MAX_LEVEL).progress;
    expect(canResetRelic(fed)).toBe(true);
    const reset = resetRelicProgress(fed);
    expect(reset).toEqual({ ...fed, level: 1, exp: 0 });
    expect(canResetRelic(reset)).toBe(false);
  });
});
