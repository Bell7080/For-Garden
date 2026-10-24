import { describe, expect, it } from "vitest";
import { ancientBlockBackdrop, ancientBlockFloors, ancientBlockOf, isAncientGate } from "../../src/core/ancientStrata";
import { ANCIENT_MAP, ancientMapHeight, ancientNodeOffset, ancientNodePoint, ancientScrollLimits } from "../../src/ui/ancientStrataLayout";

describe("고대 지층 구간 규칙", () => {
  it("열 층마다 한 구간이다", () => {
    expect(ancientBlockOf(1)).toBe(0);
    expect(ancientBlockOf(10)).toBe(0);
    expect(ancientBlockOf(11)).toBe(1);
    expect(ancientBlockOf(100)).toBe(9);
    expect(ancientBlockFloors(2)).toEqual({ first: 21, last: 30 });
  });

  it("입구 다음에는 반복 원화가 1 → 3 → 2 순으로 돈다", () => {
    const order = Array.from({ length: 8 }, (_, block) => ancientBlockBackdrop(block));
    expect(order).toEqual(["entry", "loopA", "loopB", "loopC", "loopA", "loopB", "loopC", "loopA"]);
  });

  it("같은 원화가 연달아 나오지 않는다", () => {
    for (let block = 0; block < 60; block += 1) expect(ancientBlockBackdrop(block)).not.toBe(ancientBlockBackdrop(block + 1));
  });

  it("관문은 구간의 마지막 층이다", () => {
    expect([9, 10, 11, 20].map(isAncientGate)).toEqual([false, true, false, true]);
  });
});

describe("고대 지층 지도 배치", () => {
  it("노드가 가운데 축 양옆을 번갈아 오가고 관문은 가운데에 선다", () => {
    for (let index = 0; index < 9; index += 1) {
      expect(Math.sign(ancientNodeOffset(index))).toBe(index % 2 === 0 ? -1 : 1);
    }
    expect(ancientNodeOffset(9)).toBe(0);
  });

  it("노드가 화면 폭 안에 들고 옆 층과 겹치지 않는다", () => {
    for (let index = 0; index < 9; index += 1) {
      const point = ancientNodePoint(index, 540);
      expect(point.x - ANCIENT_MAP.node / 2).toBeGreaterThan(0);
      expect(point.x + ANCIENT_MAP.node / 2).toBeLessThan(1080);
      expect(ancientNodePoint(index + 1, 540).y - point.y).toBe(ANCIENT_MAP.gap);
    }
    expect(ancientMapHeight()).toBe(9 * ANCIENT_MAP.gap);
  });

  it("스크롤 끝에서도 원화가 화면을 다 덮는다", () => {
    const { min, max, artTop, artHeight } = ancientScrollLimits();
    expect(min).toBeLessThan(max);
    for (const scroll of [min, max]) {
      expect(artTop + scroll).toBeLessThanOrEqual(0);
      expect(artTop + artHeight + scroll).toBeGreaterThanOrEqual(1920);
    }
  });
});
