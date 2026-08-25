import { describe, expect, it } from "vitest";
import { EXCAVATION_DISPLAY_LAYOUT, excavationDisplayModel } from "../../src/ui/excavationDisplayModel";

/** 테스트 입력을 짧게 유지하면서 네 재화 키 누락을 타입 단계에서 막는다. */
const amounts = (gold = 0, cheesecake = 0, fossil = 0, gems = 0) => ({ gold, cheesecake, fossil, gems });

describe("excavationDisplayModel", () => {
  it("획득도 생산도 없는 재화는 숨긴다", () => {
    expect(excavationDisplayModel(amounts(3), amounts()).map((item) => item.currency)).toEqual(["gold"]);
  });

  it("누적 이력이 없어도 현재 생산 중인 재화는 표시한다", () => {
    expect(excavationDisplayModel(amounts(), amounts(0, 0, 7)).map((item) => item.currency)).toEqual(["fossil"]);
  });

  it("네 항목을 공용 순서와 안전 폭 안에서 중앙 정렬한다", () => {
    const model = excavationDisplayModel(amounts(1, 1, 1, 1), amounts());
    expect(model.map((item) => item.x)).toEqual([-282, -94, 94, 282]);
    expect(model[0].x - EXCAVATION_DISPLAY_LAYOUT.itemWidth / 2).toBeGreaterThanOrEqual(-EXCAVATION_DISPLAY_LAYOUT.safeWidth / 2);
    expect(model[3].x + EXCAVATION_DISPLAY_LAYOUT.itemWidth / 2).toBeLessThanOrEqual(EXCAVATION_DISPLAY_LAYOUT.safeWidth / 2);
  });
});
