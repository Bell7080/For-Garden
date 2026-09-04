import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { INTERACTION_LAYER, interactionLayersHeight, interactionLayerSpot } from "../../src/ui/interactionLayerLayout";
import { autoAssignInteractionParty } from "../../src/ui/interactionLayerModel";

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

  it("글 시작선이 화면 안으로 들어온다", () => {
    // 층이 화면보다 넓어 판 왼쪽 변은 화면 밖이다. 변에 붙여 시작하면 이름이 잘려 나간다.
    const leftEdgeOnScreen = BASE_WIDTH / 2 - INTERACTION_LAYER.width / 2;
    expect(leftEdgeOnScreen).toBeLessThan(0);
    expect(leftEdgeOnScreen + INTERACTION_LAYER.padding + INTERACTION_LAYER.textInset).toBeGreaterThan(0);
    expect(INTERACTION_LAYER.padding * 2).toBeLessThan(INTERACTION_LAYER.height);
  });

  it("목록 높이는 층 수에서 나온다", () => {
    expect(interactionLayersHeight(0)).toBe(0);
    expect(interactionLayersHeight(1)).toBe(INTERACTION_LAYER.height);
    expect(interactionLayersHeight(3)).toBe(2 * INTERACTION_LAYER.step + INTERACTION_LAYER.height);
  });
});

describe("교류 자동 배치", () => {
  const CANDIDATES = [
    { id: "anky", power: 2200 },
    { id: "rex", power: 2400 },
    { id: "dodo", power: 2100 },
    { id: "keris", power: 2400 },
  ];

  it("는 전투력이 높은 순서로 채운다", () => {
    // 교류에는 발굴의 생산 특화 같은 개체별 기준이 없어 비교 가능한 값이 전투력뿐이다.
    expect(autoAssignInteractionParty(CANDIDATES, 3)).toEqual(["keris", "rex", "anky"]);
  });

  it("는 동률을 ID 순으로 끊어 늘 같은 편성을 만든다", () => {
    // 누를 때마다 순서가 바뀌면 자동이 아니라 난수다.
    const once = autoAssignInteractionParty(CANDIDATES, 3);
    expect(autoAssignInteractionParty([...CANDIDATES].reverse(), 3)).toEqual(once);
  });

  it("는 모자라면 빈 자리를 남긴다", () => {
    expect(autoAssignInteractionParty([{ id: "anky", power: 1 }], 3)).toEqual(["anky", null, null]);
  });
});
