import { describe, expect, it } from "vitest";
import { PVP_MODES } from "../../src/data/pvpModes";
import { pvpGridCell, PVP_GRID, PVP_RETURN_SCENE } from "../../src/ui/pvpLayout";

/** Phaser를 띄우지 않고 PvP 정적 계약과 모바일 입력 배치를 고정한다. */
describe("PvP selection contract", () => {
  it("keeps four modes in reading order with unique ids", () => {
    expect(PVP_MODES.map(({ label }) => label)).toEqual(["결투장", "우두머리\n결정전", "대난투", "연습 훈련"]);
    expect(new Set(PVP_MODES.map(({ id }) => id)).size).toBe(4);
  });

  it("places square hit areas in a two by two grid", () => {
    const cells = PVP_MODES.map((_, index) => pvpGridCell(index));
    expect({ columns: PVP_GRID.columns, rows: PVP_GRID.rows }).toEqual({ columns: 2, rows: 2 });
    expect(cells.map(({ x, y }) => [x, y])).toEqual([[318, 718], [762, 718], [318, 1162], [762, 1162]]);
    expect(cells.every(({ width, height }) => width === height && width === PVP_GRID.cellSize)).toBe(true);
  });

  it("returns preview to selection and selection to lobby", () => {
    expect(PVP_RETURN_SCENE).toEqual({ selection: "lobby", preview: "pvp" });
  });
});
