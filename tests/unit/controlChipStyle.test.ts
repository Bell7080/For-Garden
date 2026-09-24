import { describe, expect, it } from "vitest";
import { CONTROL_CHIP_ACTIVE, perimeterPoint, polygonPerimeter } from "../../src/ui/controlChipStyle";

describe("전투 조작 칩의 켜짐 연출", () => {
  it("단계가 오를수록 빛이 빨리 돌고 줄기가 늘고 판이 짙어진다", () => {
    const [one, two, three] = [1, 2, 3].map((level) => CONTROL_CHIP_ACTIVE.tiers[level as 1 | 2 | 3]);
    expect(two.spinMs).toBeLessThan(one.spinMs);
    expect(three.spinMs).toBeLessThan(two.spinMs);
    expect(two.comets).toBeGreaterThanOrEqual(one.comets);
    expect(three.comets).toBeGreaterThan(one.comets);
    expect(three.fillAlpha).toBeGreaterThan(one.fillAlpha);
    expect(three.glowWidth).toBeGreaterThan(one.glowWidth);
    // 겹쳐 밝아지는 번짐이 진하면 칩 글자가 묻힌다.
    for (const tier of [one, two, three]) expect(tier.glowAlpha).toBeLessThan(0.6);
  });

  it("빛은 둘레를 같은 빠르기로 돌고 한 바퀴 뒤 제자리로 온다", () => {
    const square = [-10, -10, 10, -10, 10, 10, -10, 10];
    expect(polygonPerimeter(square)).toBe(80);
    expect(perimeterPoint(square, 0)).toEqual({ x: -10, y: -10 });
    expect(perimeterPoint(square, 0.125)).toEqual({ x: 0, y: -10 });
    expect(perimeterPoint(square, 0.5)).toEqual({ x: 10, y: 10 });
    expect(perimeterPoint(square, 1)).toEqual(perimeterPoint(square, 0));
    // 꼬리는 머리 뒤(음수)를 읽으므로 한 바퀴 앞의 자리로 감긴다.
    expect(perimeterPoint(square, -0.125)).toEqual({ x: -10, y: 0 });
  });
});
