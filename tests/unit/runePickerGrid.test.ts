import { describe, expect, it } from "vitest";
import { RUNE_PICK_GRID, runePickerListTop, runePickerMinScroll, runePickerSize } from "../../src/ui/runePickerLayout";
import { RUNE_LIST_CONTROLS } from "../../src/ui/runeListControlsLayout";
import { BASE_HEIGHT } from "../../src/config/gameConfig";

describe("룬 고르기 가방 크기", () => {
  it("룬이 아무리 많아도 보이는 줄 수에서 끊고 화면을 넘지 않는다", () => {
    const many = runePickerSize(500);
    expect(many.viewHeight).toBe(RUNE_PICK_GRID.maxRows * RUNE_PICK_GRID.cellHeight);
    expect(many.height).toBeLessThan(BASE_HEIGHT - 400);
    expect(runePickerSize(9999).height).toBe(many.height);
  });
  it("룬이 적으면 판도 그 줄 수만큼만 높다", () => {
    expect(runePickerSize(4).height).toBeLessThan(runePickerSize(5).height);
    expect(runePickerSize(16).height).toBe(runePickerSize(17).height);
  });
  it("목록은 조작 두 줄 아래에서 시작한다", () => {
    const controlsBottom = RUNE_PICK_GRID.controlsY - RUNE_LIST_CONTROLS.rowHeight / 2 + RUNE_LIST_CONTROLS.height;
    expect(runePickerListTop()).toBeGreaterThan(controlsBottom);
  });
  it("세로로 흐르는 한도는 넘친 줄만큼이다", () => {
    const { viewHeight } = runePickerSize(500);
    expect(runePickerMinScroll(16, viewHeight)).toBe(0);
    expect(runePickerMinScroll(17, viewHeight)).toBe(-RUNE_PICK_GRID.cellHeight);
  });
});
