import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { INTERACTION_LAYER, interactionLayersHeight, interactionLayerSpot } from "../../src/ui/interactionLayerLayout";

const half = INTERACTION_LAYER.width / 2;

describe("교류 층 자리", () => {
  it("뻗어 나온 쪽 끝은 화면 밖에 남는다", () => {
    const left = interactionLayerSpot(0);
    expect(left.fromLeft).toBe(true);
    expect(left.x - half).toBeLessThan(0);
    const right = interactionLayerSpot(1);
    expect(right.fromLeft).toBe(false);
    expect(right.x + half).toBeGreaterThan(BASE_WIDTH);
  });

  it("반대쪽 끝은 화면 안 같은 깊이까지만 들어온다", () => {
    expect(interactionLayerSpot(0).x + half).toBe(BASE_WIDTH - INTERACTION_LAYER.inset);
    expect(interactionLayerSpot(1).x - half).toBe(INTERACTION_LAYER.inset);
  });

  it("층은 위에서 아래로 같은 간격으로 쌓인다", () => {
    expect(interactionLayerSpot(1).y - interactionLayerSpot(0).y).toBe(INTERACTION_LAYER.step);
    expect(interactionLayerSpot(0).y).toBe(INTERACTION_LAYER.firstY);
  });

  it("층 사이가 벌어져 서로 겹치지 않는다", () => {
    expect(INTERACTION_LAYER.step).toBeGreaterThan(INTERACTION_LAYER.height);
  });

  it("목록 높이는 층 수에서 나온다", () => {
    expect(interactionLayersHeight(0)).toBe(0);
    expect(interactionLayersHeight(1)).toBe(INTERACTION_LAYER.height);
    expect(interactionLayersHeight(3)).toBe(2 * INTERACTION_LAYER.step + INTERACTION_LAYER.height);
  });
});
