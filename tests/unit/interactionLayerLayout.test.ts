import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { INTERACTION_LAYER, interactionLayersHeight, interactionLayerSpot } from "../../src/ui/interactionLayerLayout";

const half = INTERACTION_LAYER.width / 2;

describe("교류 층 자리", () => {
  it("모든 층이 같은 x에 선다 — 좌우로 번갈아 서면 목록이 흩어진 카드로 읽힌다", () => {
    const xs = [0, 1, 2, 3].map((index) => interactionLayerSpot(index).x);
    expect(new Set(xs).size).toBe(1);
    expect(xs[0]).toBe(BASE_WIDTH / 2);
  });

  it("양 끝은 화면 밖으로 조금 넘친다", () => {
    const spot = interactionLayerSpot(0);
    expect(spot.x - half).toBeLessThan(0);
    expect(spot.x + half).toBeGreaterThan(BASE_WIDTH);
  });

  it("층은 위에서 아래로 같은 간격으로 쌓인다", () => {
    expect(interactionLayerSpot(1).y - interactionLayerSpot(0).y).toBe(INTERACTION_LAYER.step);
    expect(interactionLayerSpot(0).y).toBe(INTERACTION_LAYER.firstY);
  });

  it("층 사이가 두께보다 벌어져 서로 붙어 보이지 않는다", () => {
    expect(INTERACTION_LAYER.step).toBeGreaterThan(INTERACTION_LAYER.height);
  });

  it("원화와 여백이 층 안에 든다", () => {
    expect(INTERACTION_LAYER.artWidth + INTERACTION_LAYER.padding * 2).toBeLessThan(INTERACTION_LAYER.width);
    expect(INTERACTION_LAYER.padding * 2).toBeLessThan(INTERACTION_LAYER.height);
  });

  it("목록 높이는 층 수에서 나온다", () => {
    expect(interactionLayersHeight(0)).toBe(0);
    expect(interactionLayersHeight(1)).toBe(INTERACTION_LAYER.height);
    expect(interactionLayersHeight(3)).toBe(2 * INTERACTION_LAYER.step + INTERACTION_LAYER.height);
  });
});
