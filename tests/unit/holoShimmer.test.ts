import { describe, expect, it } from "vitest";
import { HOLO_SHIMMER, holoBreathe, holoSweepPhase, holoWobble, polygonSpans } from "../../src/ui/holoShimmer";

describe("정보창 홀로그램 결", () => {
  it("주사선은 도형 안쪽 구간만 긋는다(오목한 도형 포함)", () => {
    const square = [0, 0, 10, 0, 10, 10, 0, 10];
    expect(polygonSpans(square, 5)).toEqual([[0, 10]]);
    expect(polygonSpans(square, 20)).toEqual([]);
    // 가운데가 파인 U자 — 한 줄에 구간이 둘이다.
    const u = [0, 0, 3, 0, 3, 6, 7, 6, 7, 0, 10, 0, 10, 10, 0, 10];
    expect(polygonSpans(u, 3)).toEqual([[0, 3], [7, 10]]);
  });

  it("일렁임·숨·빛띠는 정해진 폭 안에 머문다", () => {
    for (let ms = 0; ms < 6000; ms += 37) {
      for (let i = 0; i < 5; i += 1) expect(Math.abs(holoWobble(i, ms) - 1)).toBeLessThanOrEqual(HOLO_SHIMMER.wobble.ratio + 1e-9);
      const breathe = holoBreathe(ms);
      expect(breathe).toBeGreaterThanOrEqual(HOLO_SHIMMER.breathe.min - 1e-9);
      expect(breathe).toBeLessThanOrEqual(1 + 1e-9);
      const phase = holoSweepPhase(ms);
      expect(phase).toBeGreaterThanOrEqual(0);
      expect(phase).toBeLessThan(1);
    }
  });
});
