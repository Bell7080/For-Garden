import { describe, expect, it } from "vitest";
import type { PuppetMesh } from "puppetforge";
import { drawableIndices } from "../../src/puppets/drawableCells";

/** PuppetForge `createGridMesh`와 같은 모양의 격자(셀마다 인덱스 6개). */
function grid(cols: number, rows: number, width: number, height: number): PuppetMesh {
  const vertices: number[] = [];
  for (let row = 0; row <= rows; row += 1) {
    for (let col = 0; col <= cols; col += 1) vertices.push((col / cols) * width, (row / rows) * height);
  }
  const indices: number[] = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col;
      const c = a + cols + 1;
      indices.push(a, a + 1, c, a + 1, c + 1, c);
    }
  }
  return { resolution: "low", cols, rows, vertices, indices, weights: vertices.filter((_v, i) => i % 2 === 0).map(() => ({ boneIds: [], weights: [] })) };
}

describe("투명 셀 생략 (PuppetForge alphaVertexMask → visibleIndices)", () => {
  it("완전히 투명한 그림은 아무 셀도 그리지 않는다", () => {
    expect(drawableIndices(grid(4, 4, 40, 40), new Uint8Array(40 * 40), 40, 40)?.length).toBe(0);
  });

  it("다 칠한 그림은 전체 격자를 그대로 그린다", () => {
    const mesh = grid(4, 4, 40, 40);
    expect(Array.from(drawableIndices(mesh, new Uint8Array(40 * 40).fill(255), 40, 40) ?? [])).toEqual(mesh.indices);
  });

  it("남긴 삼각형은 원래 셀의 인덱스 그대로다 — 정점 번호를 바꾸지 않는다", () => {
    // 40×40 원화, 4×4 격자 → 셀 한 변 10px. (15, 15) 픽셀은 여유 2px 안에서 가운데 셀 하나다.
    const mesh = grid(4, 4, 40, 40);
    const alpha = new Uint8Array(40 * 40);
    alpha[15 * 40 + 15] = 255;
    expect(Array.from(drawableIndices(mesh, alpha, 40, 40) ?? [])).toEqual(mesh.indices.slice(5 * 6, 6 * 6));
  });

  it("격자 모양이 아니면 고르지 않는다(전체를 그린다)", () => {
    expect(drawableIndices({ ...grid(4, 4, 40, 40), indices: [0, 1, 2] }, new Uint8Array(1600), 40, 40)).toBeNull();
  });
});
