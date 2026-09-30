import { describe, expect, it } from "vitest";
import { PICKAXE_ANGLE, PICKAXE_ART, pickaxePoses, pickaxeTipOffset } from "../../src/ui/pickaxeSwing";

describe("곡괭이 후려치기", () => {
  it("는 내려꽂는 순간 날 끝이 칸 가운데에 정확히 닿는다", () => {
    const center = { x: 500, y: 700 };
    for (const cell of [140, 168]) {
      const display = cell * 1.05;
      const { strike } = pickaxePoses(center, cell, display);
      const tip = pickaxeTipOffset(display, strike.angle);
      expect(strike.x + tip.x).toBeCloseTo(center.x, 6);
      expect(strike.y + tip.y).toBeCloseTo(center.y, 6);
    }
  });

  it("는 손이 날 끝보다 위·오른쪽에 있어 칸 안이 아니라 곁에서 후려친다", () => {
    const display = 168 * 1.05;
    const tip = pickaxeTipOffset(display, PICKAXE_ANGLE.strike);
    // 날 끝은 손의 왼쪽(x<0)이고 손보다 아래(y>0)라 자루가 위에서 내려온다.
    expect(tip.x).toBeLessThan(0);
    expect(tip.y).toBeGreaterThan(0);
  });

  it("는 젖힌 자세에서 후려치는 자세까지 90도 넘게 돌리고 손이 위·뒤에서 내려온다", () => {
    const { raised, strike, rest } = pickaxePoses({ x: 0, y: 0 }, 160, 168);
    expect(raised.angle - strike.angle).toBeGreaterThan(90);
    expect(raised.y).toBeLessThan(strike.y);
    expect(raised.x).toBeGreaterThan(strike.x);
    expect(rest.angle).toBeLessThan(raised.angle);
  });

  it("의 날 끝과 쥔 곳은 원화 안에 있다", () => {
    for (const point of [PICKAXE_ART.grip, PICKAXE_ART.tip]) {
      expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(PICKAXE_ART.size);
      expect(point.y).toBeGreaterThan(0); expect(point.y).toBeLessThan(PICKAXE_ART.size);
    }
  });
});
