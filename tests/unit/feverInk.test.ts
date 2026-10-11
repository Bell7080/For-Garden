import { describe, expect, it } from "vitest";
import { FEVER_INK, feverAngerPlacement, feverBodyFill, feverFade, feverOutlineSteps, feverPulse, feverSirenRings } from "../../src/ui/feverInk";

describe("폭주의 잉크 테두리", () => {
  it("먹선이 붉은 띠보다 바깥에, 먼저 그려진다", () => {
    const steps = feverOutlineSteps(1, 1);
    expect(steps).toHaveLength(FEVER_INK.directions * 2);
    const ink = steps.slice(0, FEVER_INK.directions);
    const red = steps.slice(FEVER_INK.directions);
    ink.forEach((step) => expect(step.color).toBe(FEVER_INK.ink));
    red.forEach((step) => expect(step.color).not.toBe(FEVER_INK.ink));
    expect(Math.hypot(ink[0].dx, ink[0].dy)).toBeGreaterThan(Math.hypot(red[0].dx, red[0].dy));
  });

  it("두께가 경보 박자에 맞춰 숨 쉰다", () => {
    const thin = Math.hypot(feverOutlineSteps(0, 1)[12].dx, feverOutlineSteps(0, 1)[12].dy);
    const thick = Math.hypot(feverOutlineSteps(1, 1)[12].dx, feverOutlineSteps(1, 1)[12].dy);
    expect(thick).toBeGreaterThan(thin * 2);
    expect(feverPulse(FEVER_INK.sirenMs / 4)).toBeCloseTo(1, 5);
  });

  it("들어올 때와 끝날 때 녹아들고, 다 녹으면 겹이 없다", () => {
    expect(feverFade(0)).toBe(0);
    expect(feverFade(FEVER_INK.fadeInMs)).toBe(1);
    expect(feverFade(5_000, FEVER_INK.fadeOutMs)).toBe(0);
    expect(feverOutlineSteps(1, 0)).toEqual([]);
  });

  it("몸을 덮는 붉은 기운은 정점에서도 원화를 가리지 않을 만큼 옅다", () => {
    expect(feverBodyFill(1, 1)).toBeLessThanOrEqual(0.15);
    expect(feverBodyFill(0, 1)).toBeGreaterThan(0);
  });

  it("발밑 사이렌 두 겹은 반 박자씩 어긋나 퍼진다", () => {
    const [first, second] = feverSirenRings(0);
    expect(first.radius).not.toBeCloseTo(second.radius, 1);
    expect(first.strength).toBeGreaterThan(second.strength);
  });

  it("빠직 표식은 두 박자마다 반대편으로 옮겨 간다", () => {
    expect(feverAngerPlacement(0).side).toBe(-feverAngerPlacement(FEVER_INK.sirenMs * 2).side);
  });
});
