import { describe, expect, it } from "vitest";
import { TUTORIAL_SKIP_CHIP, tutorialSkipSpot } from "../../src/ui/tutorialSkipLayout";
import { BASE_WIDTH } from "../../src/config/gameConfig";

/** 상단 재화 줄(TopBar y 40)의 경계선은 y 136이다. 칩은 그 아래에서만 선다. */
const TOP_BAR_BOTTOM = 40 + 96;

describe("튜토리얼 건너뛰기 칩", () => {
  it("상단 재화 줄 아래, 오른쪽에 선다", () => {
    const spot = tutorialSkipSpot(110, [{ x: 300, y: 900, width: 400, height: 200 }]);
    expect(spot.side).toBe("right");
    expect(spot.y - spot.height / 2).toBeGreaterThan(TOP_BAR_BOTTOM);
    expect(spot.x + spot.width / 2).toBeLessThanOrEqual(BASE_WIDTH - TUTORIAL_SKIP_CHIP.margin);
  });

  it("구멍이 오른쪽 자리를 덮으면 왼쪽으로 비켜 선다", () => {
    const spot = tutorialSkipSpot(110, [{ x: 800, y: 150, width: 260, height: 120 }]);
    expect(spot.side).toBe("left");
  });

  it("안내 글이 막아도 구멍을 덮지 않는 쪽을 먼저 지킨다", () => {
    const hole = { x: 0, y: 150, width: 300, height: 120 };
    const label = { x: 700, y: 170, width: 380, height: 40 };
    expect(tutorialSkipSpot(110, [hole, label]).side).toBe("right");
  });

  it("글이 길면 칩이 넓어진다", () => {
    expect(tutorialSkipSpot(300, []).width).toBe(300 + TUTORIAL_SKIP_CHIP.paddingX * 2);
    expect(tutorialSkipSpot(40, []).width).toBe(TUTORIAL_SKIP_CHIP.minWidth);
  });
});
