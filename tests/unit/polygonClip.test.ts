import { describe, expect, it } from "vitest";
import { clipPolygonToBand } from "../../src/core/polygonClip";

describe("clipPolygonToBand", () => {
  const square = [0, 0, 10, 0, 10, 10, 0, 10];
  it("띠 안의 도형은 그대로 둔다", () => {
    expect(clipPolygonToBand(square, -5, 15)).toEqual(square);
  });
  it("띠 밖의 도형은 비운다", () => {
    expect(clipPolygonToBand(square, 20, 30)).toEqual([]);
  });
  it("위아래를 띠 경계에서 자른다", () => {
    const clipped = clipPolygonToBand(square, 2, 7);
    const ys = clipped.filter((_, index) => index % 2 === 1);
    expect(Math.min(...ys)).toBe(2);
    expect(Math.max(...ys)).toBe(7);
    expect(clipped.length).toBe(8);
  });
});
