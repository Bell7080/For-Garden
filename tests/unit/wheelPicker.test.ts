import { describe, expect, it } from "vitest";
import { joinClockChoice, splitClockChoices, wheelSlotStyle, wheelSnapTarget, wrapIndex } from "../../src/core/wheelPicker";

describe("시간 바퀴", () => {
  it("끝없이 돈다 — 0시 앞은 23시다", () => {
    expect(wrapIndex(-1, 24)).toBe(23);
    expect(wrapIndex(25, 24)).toBe(1);
  });

  it("손을 떼면 가장 가까운 칸에 붙고, 튕기면 더 굴러가되 한계가 있다", () => {
    expect(wheelSnapTarget(3.4, 0)).toBe(3);
    expect(wheelSnapTarget(3.6, 0)).toBe(4);
    expect(wheelSnapTarget(3, 20)).toBeGreaterThan(5);
    expect(wheelSnapTarget(3, 1000)).toBe(11);
  });

  it("가운데 칸이 가장 진하고 크다", () => {
    expect(wheelSlotStyle(0)).toEqual({ alpha: 1, scale: 1 });
    expect(wheelSlotStyle(1).alpha).toBeLessThan(1);
    expect(wheelSlotStyle(3).alpha).toBe(0);
  });

  it("30분 간격 목록을 시·분으로 가르고 다시 잇는다", () => {
    const choices = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);
    const { hours, minutes } = splitClockChoices(choices);
    expect(hours).toHaveLength(24);
    expect(minutes).toEqual(["00", "30"]);
    expect(joinClockChoice(choices, "07", "30")).toBe("07:30");
    expect(joinClockChoice(["08:00", "09:00"], "08", "30")).toBe("08:00");
  });
});
