import { describe, expect, it } from "vitest";
import { emptySlotOrder, nextEmptySlot, RUNE_SELECT, runeSelectFooterXs, runeSelectRows } from "../../src/ui/runeSelectLayout";
import { RUNE_LIST_CONTROLS } from "../../src/ui/runeListControlsLayout";
import { RUNE_PICK_GRID } from "../../src/ui/runePickerLayout";

describe("룬 고르기 판(눌러 보고 → 선택)", () => {
  it("정보 판 → 조작 줄 → 목록 → 선택 줄이 겹치지 않고 위에서 아래로 쌓인다", () => {
    for (const total of [1, 5, 12, 80]) {
      const rows = runeSelectRows(total);
      const top = -rows.height / 2;
      const infoBottom = rows.infoTop + RUNE_SELECT.infoHeight;
      const controlsTop = rows.gridTop + RUNE_PICK_GRID.controlsY - RUNE_LIST_CONTROLS.rowHeight / 2;
      expect(rows.infoTop).toBeGreaterThan(top + 60);
      expect(controlsTop).toBeGreaterThan(infoBottom);
      expect(rows.listBottom).toBeGreaterThan(controlsTop + RUNE_LIST_CONTROLS.height);
      expect(rows.footerY - RUNE_SELECT.button.height / 2).toBeGreaterThan(rows.listBottom);
      expect(rows.footerY + RUNE_SELECT.button.height / 2).toBeLessThan(rows.height / 2);
      // 판 밖 뒤로가기와 상단 줄 사이에 든다(1920 세로 화면).
      expect(rows.height).toBeLessThan(1500);
    }
  });

  it("칸이 여럿이면 칸 줄은 왼쪽, 「선택」은 오른쪽에 서고 서로 겹치지 않는다", () => {
    const { width } = runeSelectRows(10);
    const one = runeSelectFooterXs(width, 1);
    expect(one).toEqual({ button: 0, slots: [] });
    const three = runeSelectFooterXs(width, 3);
    const lastRight = three.slots[2] + RUNE_SELECT.slot.size / 2;
    expect(lastRight).toBeLessThan(three.button - RUNE_SELECT.button.width / 2);
    expect(three.button + RUNE_SELECT.button.width / 2).toBeLessThanOrEqual(width / 2);
  });

  it("넣은 뒤 다음 빈 칸으로 이어지고, 다 차면 -1이다", () => {
    expect(nextEmptySlot([true, false, false], 0)).toBe(1);
    expect(nextEmptySlot([true, true, false], 1)).toBe(2);
    // 뒤가 다 찼으면 앞의 빈 칸으로 돌아간다(가운데 칸을 갈아 끼운 경우).
    expect(nextEmptySlot([false, true, true], 1)).toBe(0);
    expect(nextEmptySlot([true, true, true], 2)).toBe(-1);
  });

  it("「한 번에 선택」 토글은 목록과 「선택」 사이, 「선택」 오른쪽 끝에 맞춰 선다", () => {
    for (const total of [1, 12, 80]) {
      const single = runeSelectRows(total);
      expect(single.toggleY).toBeUndefined();
      const rows = runeSelectRows(total, true);
      const T = RUNE_SELECT.toggle;
      expect(rows.toggleY! - T.height / 2).toBeGreaterThan(rows.listBottom);
      expect(rows.toggleY! + T.height / 2).toBeLessThan(rows.footerY - RUNE_SELECT.button.height / 2);
      expect(rows.footerY + RUNE_SELECT.button.height / 2).toBeLessThan(rows.height / 2 - 30);
      // 판은 조금만 길어진다.
      expect(rows.height - single.height).toBeLessThan(60);
      expect(rows.height).toBeLessThan(1500);
    }
    const { width } = runeSelectRows(10, true);
    const footer = runeSelectFooterXs(width, 3);
    const right = footer.button + RUNE_SELECT.button.width / 2;
    expect(right - RUNE_SELECT.toggle.width).toBeGreaterThan(footer.slots[2] + RUNE_SELECT.slot.size / 2);
  });

  it("한 번에 고른 룬은 지금 칸부터 빈 칸 차례로 들어간다", () => {
    expect(emptySlotOrder([false, false, false], 0)).toEqual([0, 1, 2]);
    expect(emptySlotOrder([false, true, false], 1)).toEqual([2, 0]);
    expect(emptySlotOrder([false, false, true], 1)).toEqual([1, 0]);
    expect(emptySlotOrder([true, true, true], 0)).toEqual([]);
  });
});
