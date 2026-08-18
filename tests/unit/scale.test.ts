import { describe, expect, it } from "vitest";
import { fitScale } from "../../src/core/scale";

describe("fitScale", () => {
  it("는 세로 화면 기준 해상도를 가로가 좁은 뷰포트에 맞춘다", () => {
    const scale = fitScale({ width: 390, height: 844 }, { width: 1080, height: 1920 });
    expect(scale).toBeCloseTo(390 / 1080, 5);
  });

  it("는 데스크톱처럼 넓은 뷰포트에서 높이 기준으로 레터박스된다", () => {
    const scale = fitScale({ width: 1920, height: 1080 }, { width: 1080, height: 1920 });
    expect(scale).toBeCloseTo(1080 / 1920, 5);
  });
});
