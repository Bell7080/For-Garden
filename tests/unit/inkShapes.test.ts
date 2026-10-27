import { describe, expect, it } from "vitest";
import { INK_SHAPES, INK_SHAPE_IDS, INK_STYLE, inkTextureKey, type InkPoint } from "../../src/ui/inkShapes";

const distance = ([x, y]: InkPoint): number => Math.hypot(x, y);

describe("잉크 조각 도형", () => {
  it("윤곽과 잉크선이 모두 굽는 캔버스 안에 든다", () => {
    for (const id of INK_SHAPE_IDS) {
      const shape = INK_SHAPES[id];
      for (const part of shape.parts) {
        // 각진 꼭짓점의 선은 두께의 절반보다 더 삐져나가므로 miter 한도까지는 아니어도 넉넉히 본다.
        const margin = part.lineWidth;
        for (const [x, y] of part.points) {
          expect(Math.abs(x) + margin, `${id} x`).toBeLessThanOrEqual(shape.width / 2 + 0.5);
          expect(Math.abs(y) + margin, `${id} y`).toBeLessThanOrEqual(shape.height / 2 + 0.5);
        }
      }
    }
  });

  it("텍스처 키는 메뉴의 홀로그램 조각과 섞이지 않는다", () => {
    const keys = INK_SHAPE_IDS.map(inkTextureKey);
    expect(new Set(keys).size).toBe(keys.length);
    keys.forEach((key) => expect(key.startsWith("fx-ink-")).toBe(true));
  });

  it("색은 잉크·흰 면·그늘 셋뿐이고, 흰 면은 tint가 그대로 물들도록 순백이다", () => {
    expect(INK_STYLE.white).toBe("#ffffff");
    expect(INK_STYLE.ink).not.toBe(INK_STYLE.shade);
  });

  it("폭주 표식(💢)은 꺾인 모서리가 가운데를 향하고 팔이 바깥으로 벌어진다", () => {
    const { parts } = INK_SHAPES.anger;
    expect(parts).toHaveLength(4);
    for (const part of parts) {
      const nearest = Math.min(...part.points.map(distance));
      const farthest = Math.max(...part.points.map(distance));
      // 모서리가 가운데 가까이 모이고(네모 틀이면 가장 가까운 점이 멀다) 팔 끝은 멀리 뻗는다.
      expect(nearest).toBeLessThan(6);
      expect(farthest).toBeGreaterThan(18);
      // 가운데에 가장 가까운 점이 그 갈래의 꺾인 모서리다 — 첫 점이 모서리로 정의되어 있다.
      expect(distance(part.points[0])).toBeCloseTo(nearest, 5);
    }
  });
});
