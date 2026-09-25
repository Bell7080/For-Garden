import { describe, expect, it } from "vitest";
import { LAB_CHROME } from "../../src/ui/labLayout";

describe("연구소 배경 층 순서", () => {
  it("비네트는 녹아 드는 원화와 자리 잡은 원화보다 모두 위에 선다", () => {
    const { art, incomingArt, vignette } = LAB_CHROME.depth;
    expect(incomingArt).toBeGreaterThan(art);
    expect(vignette).toBeGreaterThan(incomingArt);
  });
});
