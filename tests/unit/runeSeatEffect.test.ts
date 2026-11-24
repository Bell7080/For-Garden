import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { RUNE_SEAT_FX, runeSeatChange, runeSeatSparkVector } from "../../src/ui/runeSeatEffectStyle";

describe("룬 정비 끼움·교체 연출", () => {
  it("저장 전후 칸 값으로 끼움·교체·빼기를 고른다", () => {
    expect(runeSeatChange(null, "a")).toBe("insert");
    expect(runeSeatChange("a", "b")).toBe("swap");
    expect(runeSeatChange("a", null)).toBe("remove");
    expect(runeSeatChange("a", "a")).toBeUndefined();
    expect(runeSeatChange(null, null)).toBeUndefined();
  });

  it("파편은 조각이 놓인 바깥쪽 부채꼴로 고르게 튄다", () => {
    const outward = { x: 0, y: 1 };
    const vectors = Array.from({ length: RUNE_SEAT_FX.spark.count }, (_, i) => runeSeatSparkVector(i, RUNE_SEAT_FX.spark.count, outward));
    for (const v of vectors) expect(v.x * outward.x + v.y * outward.y).toBeGreaterThan(0);
    expect(vectors[0]!.x).toBeCloseTo(-vectors[vectors.length - 1]!.x, 6);
  });

  it("섬광은 상한(0.6) 아래이고 연출은 0.7초 안에 끝난다", () => {
    expect(RUNE_SEAT_FX.flash.alpha).toBeLessThan(0.6);
    const landAt = RUNE_SEAT_FX.insert.swapDelay + RUNE_SEAT_FX.insert.duration;
    const tail = Math.max(RUNE_SEAT_FX.flash.duration, RUNE_SEAT_FX.ripple.duration, RUNE_SEAT_FX.spark.duration, RUNE_SEAT_FX.settle.duration);
    expect(landAt + tail).toBeLessThanOrEqual(700);
  });

  it("새 그림을 굽지 않는다 — 조각 그림과 공용 파편만 쓴다", () => {
    const source = readFileSync("src/ui/runeSeatEffect.ts", "utf8");
    expect(source).not.toMatch(/generateTexture|textures\.add|load\.image/);
  });
});
