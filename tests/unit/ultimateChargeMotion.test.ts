import { describe, expect, it } from "vitest";
import { ULTIMATE_CHARGE_MOTION, stepUltimateCharge } from "../../src/ui/ultimateChargeMotion";

describe("궁극기 충전 굴리기", () => {
  it("은 한 프레임에 목표까지 뛰지 않는다 — 계단 값이 그대로 번쩍이지 않게 한다", () => {
    // 한 대 맞힐 때마다 게이지가 3할 가까이 뛴다. 그 계단이 화면에서 한 프레임에 끝나면 안 된다.
    const shown = stepUltimateCharge(0, 0.3, 1 / 60);
    expect(shown).toBeGreaterThan(0);
    expect(shown).toBeLessThan(0.3);
  });

  it("은 몇 프레임 안에 목표에 닿고 지나치지 않는다", () => {
    let shown = 0;
    for (let frame = 0; frame < 60; frame += 1) shown = stepUltimateCharge(shown, 0.3, 1 / 60);
    expect(shown).toBe(0.3);
  });

  it("은 쓴 직후 0으로 내려가는 길도 보여 준다", () => {
    // 다 찬 카드가 한 프레임에 0이 되면 "쓰고 다시 찬다"가 화면에서 통째로 사라진다.
    const shown = stepUltimateCharge(1, 0, 1 / 60);
    expect(shown).toBeLessThan(1);
    expect(shown).toBeGreaterThan(0);
  });

  it("은 끝자락에서도 멎지 않는다 — 지수만으로는 마지막 한 뼘이 한없이 느려진다", () => {
    const almost = 0.999;
    const eased = Math.abs(1 - almost) * (1 / 60) * ULTIMATE_CHARGE_MOTION.ease;
    const moved = stepUltimateCharge(almost, 1, 1 / 60) - almost;
    // 지수 몫보다 최소 속도가 크므로 그 자리에서 바로 목표에 붙는다.
    expect(moved).toBeGreaterThan(eased);
    expect(stepUltimateCharge(almost, 1, 1 / 60)).toBe(1);
  });

  it("은 모션을 끄면 즉시 맞춘다", () => {
    expect(stepUltimateCharge(0, 0.7, 1 / 60, 0)).toBe(0.7);
  });

  it("은 범위를 벗어난 입력도 0~1로 가둔다", () => {
    expect(stepUltimateCharge(Number.NaN, 2, 1)).toBe(1);
    expect(stepUltimateCharge(0.5, -1, 1)).toBe(0);
  });
});
