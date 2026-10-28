import { describe, expect, it } from "vitest";
import { STATUS_GLYPHS } from "../../src/ui/statusGlyphShapes";
import { UNIT_STATUS_COLOR } from "../../src/ui/unitStatusModel";

/**
 * 머리 위 상태 칩의 그림. 색만 다르던 마름모로 되돌아가지 않도록, 모든 상태가 제 그림을 갖고
 * 칩 밖으로 나가지 않으며 두 상태가 같은 그림을 쓰지 않는지 고정한다.
 */
describe("상태 칩 그림", () => {
  const ids = Object.keys(UNIT_STATUS_COLOR) as (keyof typeof UNIT_STATUS_COLOR)[];

  it("은 모든 상태가 하나 이상의 조각을 갖는다", () => {
    for (const id of ids) expect(STATUS_GLYPHS[id].length, id).toBeGreaterThan(0);
  });

  it("은 단위 좌표(−1~1) 안에 든다", () => {
    for (const id of ids) {
      for (const part of STATUS_GLYPHS[id]) {
        expect(part.points.length, id).toBeGreaterThanOrEqual(part.kind === "fill" ? 3 : 2);
        for (const [x, y] of part.points) {
          expect(Math.abs(x), id).toBeLessThanOrEqual(1);
          expect(Math.abs(y), id).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it("은 두 상태가 같은 그림을 쓰지 않는다", () => {
    // 늑대 둘은 같은 머리에 색과 주둥이 표식만 다르다 — 그래도 그림 자체가 갈린다.
    const seen = new Map<string, string>();
    for (const id of ids) {
      const key = JSON.stringify(STATUS_GLYPHS[id]);
      expect(seen.get(key), `${id}와 ${seen.get(key)}가 같은 그림`).toBeUndefined();
      seen.set(key, id);
    }
  });
});
