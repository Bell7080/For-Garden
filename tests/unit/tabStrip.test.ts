import { describe, expect, it } from "vitest";
import { hiddenDotSides, nearestHiddenDot, tabStripMinScroll, tabStripScrollFor, tabStripSpotX, type TabStripSpec } from "../../src/core/tabStrip";
import { PREMIUM_TAB_ROW, premiumTabScrollFor, premiumTabSpot, premiumTabStrip } from "../../src/ui/premiumLayout";

const spec: TabStripSpec = { left: 0, right: 500, width: 200, gap: 10, count: 6 };

describe("흐르는 탭 줄", () => {
  it("은 첫 칸을 창 왼쪽에 붙이고 고른 칸을 가운데로 모으되 끝에서 멈춘다", () => {
    expect(tabStripSpotX(spec, 0)).toBe(100);
    expect(tabStripMinScroll(spec)).toBe(500 - (6 * 200 + 5 * 10));
    expect(tabStripScrollFor(spec, 0)).toBe(0);
    expect(tabStripScrollFor(spec, 2)).toBe(250 - tabStripSpotX(spec, 2));
    expect(tabStripScrollFor(spec, 5)).toBe(tabStripMinScroll(spec));
  });

  it("은 프리미엄 상점의 셈과 같다", () => {
    const strip = premiumTabStrip();
    const premium: TabStripSpec = { left: strip.left, right: strip.right, width: PREMIUM_TAB_ROW.width, gap: PREMIUM_TAB_ROW.gap, count: 8 };
    for (let index = 0; index < 8; index += 1) {
      expect(tabStripSpotX(premium, index)).toBe(premiumTabSpot(index).x);
      expect(tabStripScrollFor(premium, index)).toBe(premiumTabScrollFor(index, 8));
    }
  });

  it("의 끝 발광은 창 밖에 가려진 붉은 점이 있는 쪽에만 선다", () => {
    const dotted = [false, false, false, false, false, true];
    expect(hiddenDotSides(spec, 0, dotted)).toEqual({ left: false, right: true });
    expect(hiddenDotSides(spec, tabStripMinScroll(spec), dotted)).toEqual({ left: false, right: false });
    const first = [true, false, false, false, false, false];
    expect(hiddenDotSides(spec, tabStripMinScroll(spec), first)).toEqual({ left: true, right: false });
    expect(hiddenDotSides(spec, 0, first)).toEqual({ left: false, right: false });
  });

  it("의 끝 발광을 누르면 창에 가장 가까운 가려진 칸으로 간다", () => {
    const dotted = [false, false, false, true, true, true];
    expect(nearestHiddenDot(spec, 0, dotted, "right")).toBe(3);
    expect(nearestHiddenDot(spec, 0, dotted, "left")).toBeUndefined();
  });
});

describe("화면 밖으로 나가는 하단 탭 줄", () => {
  it("은 프리미엄·업적·패스 모두 끌어 넘기고 끝 발광을 단다", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["src/scenes/PremiumScene.ts", "src/ui/AchievementsPopup.ts", "src/ui/PassPopup.ts"]) {
      const source = readFileSync(file, "utf8");
      expect(source, file).toContain("new TabStripEdgeHint(");
      // 끌다 놓은 손이 탭을 고르지 않는다.
      expect(source, file).toMatch(/dragging\(\)\) (return|this\.select|goPass)|!drag\??\.dragging\(\)|!strip\.dragging\(\)/);
    }
  });
});
