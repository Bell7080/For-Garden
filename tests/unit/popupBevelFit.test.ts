import { describe, expect, it } from "vitest";
import { fitsInsideBottomRightBevel, popupRightEdgeAt, POPUP_BODY_BEVEL_RATIO } from "../../src/ui/popupGeometry";
import { REROLL_AGAIN, REROLL_POPUP } from "../../src/ui/runeTraitRerollLayout";

describe("팝업 오른쪽 아래 깎임", () => {
  it("깎임은 얕게 유지된다", () => {
    expect(POPUP_BODY_BEVEL_RATIO).toBeLessThanOrEqual(0.08);
  });

  it("바닥에서 깎임 깊이 이상 올라가면 오른쪽 변은 곧고, 안에서는 대각선이다", () => {
    const bevel = 900 * POPUP_BODY_BEVEL_RATIO;
    expect(popupRightEdgeAt(900, 1200, 1200 - bevel - 1)).toBe(450);
    expect(popupRightEdgeAt(900, 1200, 1200)).toBeCloseTo(450 - bevel);
  });

  it("재해석 결과창의 긴 버튼은 깎임 안쪽에 16px 여유로 든다", () => {
    const { width, height } = REROLL_POPUP;
    const bottom = height / 2 - REROLL_AGAIN.fromBottom + REROLL_AGAIN.height / 2;
    expect(fitsInsideBottomRightBevel({ width, height }, { right: REROLL_AGAIN.width / 2, bottom: bottom + height / 2 }, 16)).toBe(true);
  });
});
