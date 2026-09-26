import { describe, expect, it } from "vitest";
import { CONFIRM_DIALOG, confirmButtonXs, confirmDialogHeight, confirmPlateHeight } from "../../src/ui/confirmDialogLayout";

describe("확인 창 한 벌", () => {
  const plain = { messageHeight: 84, costs: false, balance: false };
  const rich = { messageHeight: 84, costs: true, balance: true };

  it("창 높이는 쌓인 내용에서 거꾸로 구한다 — 값 줄·곁말이 서면 그만큼 자란다", () => {
    const L = CONFIRM_DIALOG;
    expect(confirmPlateHeight(rich) - confirmPlateHeight(plain)).toBe(L.costGap + L.costIcon + L.balanceGap + L.balanceHeight);
    expect(confirmDialogHeight(rich) - confirmDialogHeight(plain)).toBe(confirmPlateHeight(rich) - confirmPlateHeight(plain));
  });

  it("버튼은 안쪽 판 안에서 끝나고 몸판 아랫변 위에 선다", () => {
    const L = CONFIRM_DIALOG;
    const plateHalf = (L.width - L.plateInset * 2) / 2;
    const [left, right] = confirmButtonXs(2);
    expect(left - L.button.width / 2).toBeGreaterThanOrEqual(-plateHalf);
    expect(right + L.button.width / 2).toBeLessThanOrEqual(plateHalf);
    expect(right - left - L.button.width).toBe(L.button.gap);
    expect(confirmButtonXs(1)).toEqual([0]);
    for (const content of [plain, rich]) {
      const height = confirmDialogHeight(content);
      const buttonBottom = -height / 2 + L.topRoom + confirmPlateHeight(content) + L.buttonRoom + L.button.height / 2;
      expect(height / 2 - buttonBottom).toBe(L.bottomPad);
    }
  });
});
