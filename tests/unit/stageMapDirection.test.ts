import { describe, expect, it } from "vitest";
import { stageMapRow } from "../../src/core/stageMapDirection";

describe("장별 지도 진행 방향", () => {
  it("감금동으로 내려가는 5·6장은 첫 관문이 위, 마지막 관문이 아래다", () => {
    for (const chapter of [5, 6]) {
      const y = Array.from({ length: 10 }, (_, row) => -stageMapRow(chapter, row, 10) * 230);
      expect(y[0]).toBe(-2070);
      expect(y[9]).toBeCloseTo(0);
      expect(y.every((value, index) => index === 0 || value > y[index - 1])).toBe(true);
    }
  });

  it("다른 장은 기존 아래→위 진행을 유지한다", () => {
    for (const chapter of [1, 2, 3, 4, 7]) {
      expect(stageMapRow(chapter, 0, 10)).toBe(0);
      expect(stageMapRow(chapter, 9, 10)).toBe(9);
    }
  });
});
