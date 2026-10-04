import { describe, expect, it } from "vitest";
import { CHAIN_STEP, chainLinks } from "../../src/ui/chainLayout";

describe("사슬 고리 배치", () => {
  it("양 끝점을 지나고 간격이 같으며 길게 선 고리와 모로 선 고리가 번갈아 이어진다", () => {
    const links = chainLinks(0, 0, 240, 0);
    expect(links[0]).toMatchObject({ x: 0, y: 0, long: true });
    expect(links[links.length - 1].x).toBeCloseTo(240);
    const gaps = links.slice(1).map((link, i) => link.x - links[i].x);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]);
    expect(gaps[0]).toBeLessThanOrEqual(CHAIN_STEP + 1e-6);
    links.forEach((link, i) => expect(link.long).toBe(i % 2 === 0));
  });

  it("대각선이면 각도가 진행 방향을 따른다", () => {
    const [first] = chainLinks(0, 0, 100, 100);
    expect(first.angle).toBeCloseTo(Math.PI / 4);
  });
});
