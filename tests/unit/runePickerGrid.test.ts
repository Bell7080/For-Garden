import { describe, expect, it } from "vitest";
import { RUNE_PICK_GRID, runePickerSize } from "../../src/ui/runePickerLayout";
import { BASE_HEIGHT } from "../../src/config/gameConfig";

describe("룬 고르기 가방 크기", () => {
  it("룬이 아무리 많아도 한 쪽 높이로 끊고 화면을 넘지 않는다", () => {
    const many = runePickerSize(500);
    expect(many.perPage).toBe(RUNE_PICK_GRID.columns * RUNE_PICK_GRID.rowsPerPage);
    expect(many.height).toBeLessThan(BASE_HEIGHT - 400);
    expect(runePickerSize(9999).height).toBe(many.height);
  });
  it("한 쪽에 들면 쪽 넘김 띠를 세우지 않아 더 낮다", () => {
    expect(runePickerSize(16).height).toBeLessThan(runePickerSize(17).height);
  });
});
