import { describe, expect, it } from "vitest";
import { LONG_PRESS, longPressProgress } from "../../src/ui/longPressGauge";

describe("꾹 누름 게이지", () => {
  it("누른 시간에 비례해 0에서 1까지 찬다", () => {
    expect(longPressProgress(0)).toBe(0);
    expect(longPressProgress(LONG_PRESS.ms / 2)).toBeCloseTo(0.5, 5);
    expect(longPressProgress(LONG_PRESS.ms)).toBe(1);
  });

  it("범위를 벗어난 시간도 0~1 안에 머문다 — 게이지가 한 바퀴를 넘어 돌지 않는다", () => {
    expect(longPressProgress(-100)).toBe(0);
    expect(longPressProgress(LONG_PRESS.ms * 3)).toBe(1);
  });

  it("게이지가 다 차는 시간이 곧 짧은 탭과 갈리는 경계다", () => {
    expect(longPressProgress(LONG_PRESS.ms - 1)).toBeLessThan(1);
    expect(LONG_PRESS.ms).toBeGreaterThan(0);
    // 손가락이 밀린 거리로 스크롤과 가르므로 여유는 있으되 카드 폭보다는 훨씬 작아야 한다.
    expect(LONG_PRESS.moveSlop).toBeGreaterThan(0);
    expect(LONG_PRESS.moveSlop).toBeLessThan(60);
  });
});
