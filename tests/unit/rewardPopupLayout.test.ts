import { describe, expect, it } from "vitest";
import { REWARD_POPUP_GRID, rewardGridLayout } from "../../src/ui/rewardPopupLayout";

describe("보상 영수증 칸 배치", () => {
  it("네 칸까지는 한 줄이고 판 높이가 기본값이다", () => {
    for (const count of [1, 2, 3, 4]) {
      const layout = rewardGridLayout(count);
      expect(layout.rows).toBe(1);
      expect(layout.height).toBe(REWARD_POPUP_GRID.baseHeight);
    }
  });

  it("다섯 칸부터 줄이 늘고 마지막 줄은 가운데에 선다", () => {
    const layout = rewardGridLayout(5);
    expect(layout.rows).toBe(2);
    expect(layout.height).toBe(REWARD_POPUP_GRID.baseHeight + REWARD_POPUP_GRID.rowPitch);
    expect(layout.cells[4]?.x).toBe(0);
    expect(layout.cells[4]?.y).toBeGreaterThan(layout.cells[0]!.y);
  });

  it("16칸은 4줄, 17칸 이상은 5줄이며 줄은 위에서 아래로 쌓인다", () => {
    expect(rewardGridLayout(16).rows).toBe(4);
    const wide = rewardGridLayout(17);
    expect(wide.rows).toBe(5);
    expect(wide.columns).toBe(4);
    expect(rewardGridLayout(25).rows).toBe(5);
    const ys = wide.cells.map((cell) => cell.row);
    expect(ys).toEqual([...ys].sort((a, b) => a - b));
  });

  it("칸 수가 많아져도 모든 칸이 폭 안에 들고 서로 겹치지 않는다", () => {
    for (const count of [1, 4, 8, 16, 17, 21, 25]) {
      const layout = rewardGridLayout(count);
      for (const cell of layout.cells) {
        expect(Math.abs(cell.x) + REWARD_POPUP_GRID.frame / 2).toBeLessThanOrEqual(REWARD_POPUP_GRID.viewport / 2 + 0.001);
      }
      layout.cells.forEach((a, i) => layout.cells.slice(i + 1).forEach((b) => {
        const apart = Math.abs(a.x - b.x) >= REWARD_POPUP_GRID.frame || Math.abs(a.y - b.y) >= REWARD_POPUP_GRID.frame;
        expect(apart).toBe(true);
      }));
    }
  });
});
