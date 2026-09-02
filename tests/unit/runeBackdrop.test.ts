import { describe, expect, it } from "vitest";
import { clipShapeByDiagonal, runeBackdropBands, scaleShape } from "../../src/ui/runeBackdrop";

/** 액자 도형 안의 점인지 확인한다(볼록 다각형이므로 모든 변에서 같은 방향이면 안이다). */
function insideShape(shape: readonly number[], x: number, y: number, epsilon = 1e-6): boolean {
  const count = shape.length / 2;
  let sign = 0;
  for (let i = 0; i < count; i += 1) {
    const ax = shape[i * 2];
    const ay = shape[i * 2 + 1];
    const bx = shape[((i + 1) % count) * 2];
    const by = shape[((i + 1) % count) * 2 + 1];
    const cross = (bx - ax) * (y - ay) - (by - ay) * (x - ax);
    if (Math.abs(cross) <= epsilon) continue;
    const current = cross > 0 ? 1 : -1;
    if (sign === 0) sign = current;
    else if (sign !== current) return false;
  }
  return true;
}

/**
 * 액자와 같은 모양으로 깎은 칩.
 *
 * `chipPoints`(Phaser를 import한다)를 그대로 부를 수 없어 같은 규칙으로 다시 만든다 —
 * 좌상·우하만 깎고 나머지 두 모서리는 직각이다. 네모로 검사하면 깎인 모서리로 색이 새는
 * 바로 그 문제를 놓친다.
 */
function frame(size: number): number[] {
  const half = size / 2;
  const bevel = size * 0.2;
  return [
    -half + bevel, -half,
    half, -half,
    half, half - bevel,
    half - bevel, half,
    -half, half,
    -half, -half + bevel,
  ];
}

describe("룬 액자 뒷배경", () => {
  it("잘라 낸 두 조각의 모든 점이 액자 안에 남는다", () => {
    const size = 160;
    const shape = frame(size);
    for (const side of ["upper", "lower"] as const) {
      const half = clipShapeByDiagonal(shape, size, size, side);
      expect(half.length).toBeGreaterThan(4);
      for (let i = 0; i < half.length; i += 2) {
        expect(insideShape(shape, half[i], half[i + 1], 1e-6)).toBe(true);
      }
    }
  });

  it("줄여 깐 발광 겹도 액자를 넘지 않는다", () => {
    const size = 108;
    const shape = frame(size);
    for (const { factor } of runeBackdropBands()) {
      const band = scaleShape(shape, factor);
      for (const side of ["upper", "lower"] as const) {
        const half = clipShapeByDiagonal(band, size, size, side);
        for (let i = 0; i < half.length; i += 2) {
          expect(insideShape(shape, half[i], half[i + 1], 1e-6)).toBe(true);
        }
      }
    }
  });

  it("두 조각이 대각선을 경계로 갈리고 서로 겹치지 않는다", () => {
    const size = 200;
    const shape = frame(size);
    const value = (x: number, y: number): number => x / (size / 2) + y / (size / 2);
    const upper = clipShapeByDiagonal(shape, size, size, "upper");
    const lower = clipShapeByDiagonal(shape, size, size, "lower");
    for (let i = 0; i < upper.length; i += 2) expect(value(upper[i], upper[i + 1])).toBeLessThanOrEqual(1e-6);
    for (let i = 0; i < lower.length; i += 2) expect(value(lower[i], lower[i + 1])).toBeGreaterThanOrEqual(-1e-6);
  });

  it("겹은 안쪽으로 갈수록 작아지고, 다 더해도 면을 덮지 않는다", () => {
    const bands = runeBackdropBands();
    // 계단으로 보이지 않으려면 겹이 여럿이어야 하고, 한 겹은 눈에 띄지 않을 만큼 옅어야 한다.
    expect(bands.length).toBeGreaterThanOrEqual(8);
    bands.forEach((band, index) => {
      expect(band.factor).toBeGreaterThan(0);
      expect(band.alpha).toBeLessThan(0.05);
      if (index > 0) expect(band.factor).toBeLessThan(bands[index - 1].factor);
    });
    // 겹쳐 밝아지는 합성이라 다 더한 값이 곧 가운데 밝기다. 0.5를 넘으면 색이 면을 덮는다.
    expect(bands.reduce((sum, { alpha }) => sum + alpha, 0)).toBeLessThan(0.5);
  });
});
