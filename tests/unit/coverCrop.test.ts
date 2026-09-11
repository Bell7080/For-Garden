import { describe, expect, it } from "vitest";
import { coverCrop } from "../../src/ui/coverCrop";

/** 잘라 낸 뒤 실제로 화면에 보이는 크기. 배율과 잘라 낸 몫이 함께 맞아야 칸을 정확히 덮는다. */
function shown(crop: ReturnType<typeof coverCrop>): { width: number; height: number } {
  return { width: crop.cropWidth * crop.scale, height: crop.cropHeight * crop.scale };
}

describe("칸을 덮는 잘라 내기", () => {
  it("는 칸을 빈틈없이 덮는다", () => {
    const crop = coverCrop(1882, 3344, 960, 176);
    expect(shown(crop).width).toBeCloseTo(960);
    expect(shown(crop).height).toBeCloseTo(176);
  });

  it("는 가로세로를 같은 배율로 키운다 — 늘이면 원화마다 얼굴이 눌린다", () => {
    const crop = coverCrop(1882, 3344, 960, 176);
    // 배율이 하나뿐이라 비율이 바뀔 수가 없다. 모자란 쪽에 맞춰 덮는다.
    expect(crop.scale).toBeCloseTo(Math.max(960 / 1882, 176 / 3344));
  });

  it("는 그림 한가운데를 남긴다", () => {
    const crop = coverCrop(1000, 1000, 500, 100);
    expect(crop.cropX + crop.cropWidth / 2).toBeCloseTo(500);
    expect(crop.cropY + crop.cropHeight / 2).toBeCloseTo(500);
  });

  it("는 잘라 낼 몫이 원본을 넘지 않는다", () => {
    const crop = coverCrop(400, 300, 4000, 3000);
    expect(crop.cropX).toBe(0);
    expect(crop.cropY).toBe(0);
    expect(crop.cropWidth).toBeLessThanOrEqual(400);
    expect(crop.cropHeight).toBeLessThanOrEqual(300);
  });

  it("는 크기를 모르는 원화에도 쓰러지지 않는다", () => {
    // 텍스처가 아직 도착하지 않으면 폭이 0으로 읽힌다 — 그때도 배율은 1로 남는다.
    expect(coverCrop(0, 0, 960, 176).scale).toBe(1);
  });
});
