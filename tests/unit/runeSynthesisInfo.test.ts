import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { RUNE_SYNTHESIS, runeSynthesisInfoBounds, runeSynthesisPlateBounds, runeSynthesisVertices } from "../../src/ui/runeSynthesisLayout";

type Box = { left: number; right: number; top: number; bottom: number };
const overlaps = (a: Box, b: Box): boolean => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

describe("룬 합성 능력 판 자리", () => {
  // 전설 룬이 가장 길다 — 주 옵션 둘 + 보조 셋 + 특성 한 줄.
  const LINES = 6;
  const plate = runeSynthesisPlateBounds(BASE_WIDTH);
  const vertices = runeSynthesisVertices(BASE_WIDTH);
  const half = RUNE_SYNTHESIS.slot / 2;
  const frames: Box[] = vertices.map(({ x, y }) => ({ left: x - half, right: x + half, top: y - half, bottom: y + half }));
  const infos = [0, 1, 2].map((index) => runeSynthesisInfoBounds(BASE_WIDTH, index, LINES));

  it("판 안에 들고 어느 칸 액자와도 겹치지 않는다", () => {
    for (const info of infos) {
      expect(info.left).toBeGreaterThanOrEqual(plate.left);
      expect(info.right).toBeLessThanOrEqual(plate.right);
      expect(info.top).toBeGreaterThanOrEqual(plate.top);
      expect(info.bottom).toBeLessThanOrEqual(plate.bottom);
      for (const frame of frames) expect(overlaps(info, frame)).toBe(false);
    }
  });

  it("능력 판끼리 겹치지 않는다", () => {
    expect(overlaps(infos[0], infos[1])).toBe(false);
    expect(overlaps(infos[0], infos[2])).toBe(false);
    expect(overlaps(infos[1], infos[2])).toBe(false);
  });

  it("삼각형 선을 덮지 않는다(네 모서리가 모두 삼각형 밖)", () => {
    const [a, b, c] = vertices;
    const side = (p: { x: number; y: number }, q: { x: number; y: number }, r: { x: number; y: number }): number => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const inside = (p: { x: number; y: number }): boolean => {
      const d1 = side(a, b, p); const d2 = side(b, c, p); const d3 = side(c, a, p);
      return (d1 > 0 && d2 > 0 && d3 > 0) || (d1 < 0 && d2 < 0 && d3 < 0);
    };
    for (const info of infos) {
      for (const p of [{ x: info.left, y: info.top }, { x: info.right, y: info.top }, { x: info.left, y: info.bottom }, { x: info.right, y: info.bottom }]) expect(inside(p)).toBe(false);
    }
  });
});
