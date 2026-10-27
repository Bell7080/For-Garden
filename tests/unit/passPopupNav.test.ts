import { describe, expect, it } from "vitest";
import { PASS_POPUP, passPopupArrowSpot, passPopupCanStep, passPopupPassFollow, passPopupPassMinScroll, passPopupPassTabs, passPopupPassVisibleWidth } from "../../src/ui/passPopupLayout";

describe("패스 창 넘김", () => {
  it("맨 앞·맨 뒤에서는 그쪽으로 넘기지 못하고 순환하지 않는다", () => {
    expect(passPopupCanStep(0, 4, -1)).toBe(false);
    expect(passPopupCanStep(0, 4, 1)).toBe(true);
    expect(passPopupCanStep(3, 4, 1)).toBe(false);
    expect(passPopupCanStep(3, 4, -1)).toBe(true);
    expect(passPopupCanStep(0, 1, 1)).toBe(false);
  });

  it("화살표는 창 좌우 가장자리에 서고 창 밖으로 나가지 않는다", () => {
    const left = passPopupArrowSpot(-1);
    const right = passPopupArrowSpot(1);
    expect(left.x).toBe(-right.x);
    expect(right.x + PASS_POPUP.arrow.width / 2).toBeLessThanOrEqual(PASS_POPUP.width / 2);
    expect(left.y).toBe(right.y);
  });

  it("탭 줄은 고른 탭을 가운데로 모으며 첫 칸을 넘겨도 흐르고 끝을 넘지 않는다", () => {
    // 깎임을 얕게 한 뒤 보이는 폭이 넓어져 네 칸은 한 번에 보인다 — 흐름은 여섯 칸으로 본다.
    const count = 6;
    const picks = [0, 2, 3, 5];
    const min = passPopupPassMinScroll(count);
    const { xs } = passPopupPassTabs(count);
    const visible = passPopupPassVisibleWidth();
    const scrolls = picks.map((index) => passPopupPassFollow(index, count));
    expect(scrolls[0]).toBe(0);
    for (const scroll of scrolls) {
      expect(scroll).toBeGreaterThanOrEqual(min);
      expect(scroll).toBeLessThanOrEqual(0);
    }
    // 한 칸 넘길 때마다 줄이 왼쪽으로 더 흐르고, 끝에서는 한계에 닿는다.
    expect(scrolls[1]).toBeLessThan(scrolls[0]!);
    expect(scrolls[2]).toBeLessThan(scrolls[1]!);
    expect(scrolls[3]).toBe(min);
    // 고른 탭은 늘 보이는 폭 안에 있다.
    scrolls.forEach((scroll, index) => {
      expect(xs[picks[index]!]! + scroll).toBeGreaterThan(0);
      expect(xs[picks[index]!]! + scroll).toBeLessThan(visible);
    });
  });
});
