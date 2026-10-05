import { describe, expect, it } from "vitest";
import { nextStaminaGemCost, nextUtcMidnight, staminaGemDayKey } from "../../src/core/staminaGemPricing";

describe("젬 충전 누진 가격", () => {
  it("1~5번째는 50, 6~10번째는 100, 11번째부터 150으로 5번마다 50씩 오른다", () => {
    expect([0, 4].map(nextStaminaGemCost)).toEqual([50, 50]);
    expect([5, 9].map(nextStaminaGemCost)).toEqual([100, 100]);
    expect([10, 14].map(nextStaminaGemCost)).toEqual([150, 150]);
    expect(nextStaminaGemCost(15)).toBe(200);
  });

  it("초기화 시각은 다음 UTC 자정이다", () => {
    const now = new Date("2026-10-05T18:30:00Z");
    expect(staminaGemDayKey(now)).toBe("2026-10-05");
    expect(nextUtcMidnight(now).toISOString()).toBe("2026-10-06T00:00:00.000Z");
  });
});
