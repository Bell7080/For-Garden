import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { GAUGE_FOG_ALPHA, gaugeFogPixels, gaugeSweepAlpha } from "../../src/core/gaugeFog";

const input = { width: 340, height: 30, color: 0x9a6bff, variant: 0 };
const alphas = (pixels: Uint8ClampedArray): number[] => Array.from({ length: pixels.length / 4 }, (_, i) => pixels[i * 4 + 3]);

describe("게이지 안개", () => {
  it("같은 입력은 늘 같은 결을 낸다", () => {
    expect(gaugeFogPixels(input)).toEqual(gaugeFogPixels(input));
  });

  it("두 겹과 서로 다른 줄은 서로 다른 결을 그린다", () => {
    const base = gaugeFogPixels(input);
    expect(gaugeFogPixels({ ...input, variant: 1 })).not.toEqual(base);
    expect(gaugeFogPixels({ ...input, seed: 2 })).not.toEqual(base);
  });

  it("덩어리와 빈 곳이 함께 있고, 가장 짙어도 상한을 넘지 않는다", () => {
    const values = alphas(gaugeFogPixels(input));
    const empty = values.filter((a) => a === 0).length / values.length;
    const dense = values.filter((a) => a > 255 * GAUGE_FOG_ALPHA * 0.8).length / values.length;
    expect(empty).toBeGreaterThan(0.1);
    expect(dense).toBeGreaterThan(0.1);
    expect(Math.max(...values)).toBeLessThanOrEqual(Math.ceil(255 * GAUGE_FOG_ALPHA));
  });

  it("빛띠는 가운데가 가장 밝고 양 끝에서 녹아 사라진다", () => {
    expect(gaugeSweepAlpha(0)).toBe(1);
    expect(gaugeSweepAlpha(1)).toBeCloseTo(0);
    expect(gaugeSweepAlpha(-1)).toBeCloseTo(0);
    expect(gaugeSweepAlpha(0.5)).toBeLessThan(1);
  });

  it("고고학 기대 획득 게이지는 원석만이 아니라 세 줄 모두 일렁인다", () => {
    const source = readFileSync("src/scenes/ArchaeologyScene.ts", "utf8");
    expect(source).not.toMatch(/shimmer:\s*kind === "rawStone"/);
    expect(source).toMatch(/shimmer:\s*\{\s*still:/);
  });
});
