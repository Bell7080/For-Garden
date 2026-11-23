import { describe, expect, it } from "vitest";
import { LONG_PRESS, longPressProgress, longPressRingProgress } from "../../src/ui/longPressGauge";

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

describe("꾹 누름 게이지 유예", () => {
  it("톡 치는 동안(유예 안)에는 게이지를 세우지 않는다", () => {
    expect(longPressRingProgress(0)).toBeNull();
    expect(longPressRingProgress(LONG_PRESS.graceMs - 1)).toBeNull();
    expect(LONG_PRESS.graceMs).toBeGreaterThanOrEqual(120);
    expect(LONG_PRESS.graceMs).toBeLessThan(LONG_PRESS.ms / 2);
  });
  it("유예를 넘기면 0에서 시작해 꾹 누름이 열리는 시각에 다 찬다", () => {
    expect(longPressRingProgress(LONG_PRESS.graceMs)).toBe(0);
    expect(longPressRingProgress(LONG_PRESS.ms)).toBe(1);
    expect(longPressRingProgress(LONG_PRESS.ms - 1)!).toBeLessThan(1);
    expect(longPressRingProgress(900, 900)).toBe(1);
  });
});
