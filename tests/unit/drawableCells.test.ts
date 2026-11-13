import { describe, expect, it } from "vitest";
import { alphaCellCoverage, drawableIndices } from "../../src/puppets/drawableCells";

/** PuppetForge `createGridMesh`와 같은 순서의 격자 인덱스(셀마다 6개). */
function gridIndices(cols: number, rows: number): number[] {
  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col;
      const b = a + 1;
      const c = a + cols + 1;
      const d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  }
  return indices;
}

describe("투명 셀 생략 (PuppetForge v0.42.0 판정)", () => {
  it("완전히 투명한 그림은 아무 셀도 그리지 않는다", () => {
    const grid = { cols: 4, rows: 4, indices: gridIndices(4, 4) };
    expect(drawableIndices(grid, new Uint8Array(40 * 40), 40, 40)?.length).toBe(0);
  });

  it("다 칠한 그림은 전체 격자를 그대로 그린다", () => {
    const grid = { cols: 4, rows: 4, indices: gridIndices(4, 4) };
    const drawn = drawableIndices(grid, new Uint8Array(40 * 40).fill(255), 40, 40);
    expect(Array.from(drawn ?? [])).toEqual(grid.indices);
  });

  it("픽셀 하나는 여유(2px)가 닿는 셀까지 그린다", () => {
    // 40×40 원화, 4×4 격자 → 셀 한 변 10px. (15, 15) 픽셀은 여유 2px 안에서 가운데 셀 하나다.
    const alpha = new Uint8Array(40 * 40);
    alpha[15 * 40 + 15] = 1;
    const cells = alphaCellCoverage(alpha, 40, 40, 4, 4);
    expect(Array.from(cells).filter(Boolean)).toHaveLength(1);
    expect(cells[1 * 4 + 1]).toBe(1);
    // 셀 경계 근처(19px)는 여유가 이웃 셀까지 닿는다.
    const edge = new Uint8Array(40 * 40);
    edge[15 * 40 + 19] = 1;
    expect(Array.from(alphaCellCoverage(edge, 40, 40, 4, 4)).filter(Boolean)).toHaveLength(2);
  });

  it("남긴 삼각형은 원래 셀의 인덱스 그대로다 — 정점 번호를 바꾸지 않는다", () => {
    const grid = { cols: 4, rows: 4, indices: gridIndices(4, 4) };
    const alpha = new Uint8Array(40 * 40);
    alpha[15 * 40 + 15] = 255;
    const drawn = Array.from(drawableIndices(grid, alpha, 40, 40) ?? []);
    expect(drawn).toEqual(grid.indices.slice(5 * 6, 6 * 6));
  });

  it("격자 모양이 아니면 고르지 않는다(전체를 그린다)", () => {
    expect(drawableIndices({ cols: 4, rows: 4, indices: [0, 1, 2] }, new Uint8Array(16), 4, 4)).toBeNull();
  });
});
