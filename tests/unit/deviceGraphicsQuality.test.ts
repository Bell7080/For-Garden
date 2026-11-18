import { describe, expect, it } from "vitest";
import { deviceGraphicsQuality, presentationPolicy, revealSeconds, stagePixelRatio } from "../../src/core/settings";

describe("기기 그래픽 품질·렌더 배율·연구 연출 줄이기", () => {
  it("메모리를 말하지 않는 기기는 높음 그대로다 — 코어 수만으로 내리지 않는다", () => {
    expect(deviceGraphicsQuality({})).toBe("high");
    expect(deviceGraphicsQuality({ hardwareConcurrency: 2 })).toBe("high");
  });
  it("메모리가 작을수록 품질을 낮춘다", () => {
    expect(deviceGraphicsQuality({ deviceMemory: 1, hardwareConcurrency: 8 })).toBe("low");
    expect(deviceGraphicsQuality({ deviceMemory: 2 })).toBe("low");
    expect(deviceGraphicsQuality({ deviceMemory: 4, hardwareConcurrency: 8 })).toBe("balanced");
    expect(deviceGraphicsQuality({ deviceMemory: 8, hardwareConcurrency: 4 })).toBe("balanced");
    expect(deviceGraphicsQuality({ deviceMemory: 8, hardwareConcurrency: 8 })).toBe("high");
  });
  it("연출 무대의 픽셀 배율은 품질의 렌더 배율을 따르고 1 아래로 내려가지 않는다", () => {
    expect(stagePixelRatio("high", 1.5)).toBe(1.5);
    expect(stagePixelRatio("balanced", 1.5)).toBeCloseTo(1.5 * presentationPolicy("balanced").renderQuality, 2);
    expect(stagePixelRatio("low", 1.5)).toBeLessThan(stagePixelRatio("balanced", 1.5));
    expect(stagePixelRatio("low", 1.75, 1)).toBe(1);
    expect(stagePixelRatio("high", 1.75, 3)).toBe(1.75);
  });
  it("연구 연출 줄이기는 카드 공개 시간을 줄이되 하한을 지킨다", () => {
    expect(revealSeconds(2.45, false)).toBe(2.45);
    expect(revealSeconds(2.45, true)).toBeLessThan(2.45);
    expect(revealSeconds(0.8, true)).toBeGreaterThanOrEqual(0.45);
  });
});
