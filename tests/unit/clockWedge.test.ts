import { describe, expect, it } from "vitest";
import { clockWedgeOnShape, clockWedgePoints } from "../../src/ui/clockWedge";

/**
 * 머리 위 상태 칩의 남은 시간은 원형 게이지가 아니라 **덮이는 부채꼴**이 말한다. 기하 마스크
 * 없이 사각형 안에서 잘라 그리므로, 그 도형이 칩 밖으로 나가지 않는지 여기서 고정한다.
 */
describe("시계 부채꼴", () => {
  const SIZE = 30;

  it("은 아무것도 지나지 않았으면 그리지 않는다", () => {
    expect(clockWedgePoints(SIZE, 0)).toEqual([]);
    expect(clockWedgePoints(SIZE, -1)).toEqual([]);
  });

  it("은 12시에서 시작해 시계 방향으로 덮는다", () => {
    const points = clockWedgePoints(SIZE, 0.1);
    expect(points[0]).toEqual({ x: 0, y: 0 });
    // 첫 점은 칩 윗변 한가운데 — 12시다.
    expect(points[1].x).toBeCloseTo(0, 6);
    expect(points[1].y).toBeCloseTo(-SIZE / 2, 6);
    // 조금 덮은 뒤의 끝점은 오른쪽으로 간다(시계 방향).
    expect(points[points.length - 1].x).toBeGreaterThan(0);
  });

  it("은 칩 사각형을 벗어나지 않는다", () => {
    for (const ratio of [0.05, 0.25, 0.5, 0.75, 0.99, 1]) {
      for (const { x, y } of clockWedgePoints(SIZE, ratio)) {
        expect(Math.abs(x)).toBeLessThanOrEqual(SIZE / 2 + 1e-6);
        expect(Math.abs(y)).toBeLessThanOrEqual(SIZE / 2 + 1e-6);
      }
    }
  });

  it("은 지나가는 모서리를 빠뜨리지 않는다", () => {
    // 한 바퀴를 다 덮으면 중심 + 시작·끝점 + 네 모서리가 모두 있어야 사각형이 채워진다.
    const points = clockWedgePoints(SIZE, 1);
    const corners = points.filter(({ x, y }) => Math.abs(Math.abs(x) - SIZE / 2) < 1e-6 && Math.abs(Math.abs(y) - SIZE / 2) < 1e-6);
    expect(corners).toHaveLength(4);
  });

  it("은 덮을수록 넓어진다", () => {
    const area = (ratio: number) => {
      const points = clockWedgePoints(SIZE, ratio);
      let sum = 0;
      for (let index = 0; index < points.length; index += 1) {
        const a = points[index];
        const b = points[(index + 1) % points.length];
        sum += a.x * b.y - b.x * a.y;
      }
      return Math.abs(sum) / 2;
    };
    expect(area(0.25)).toBeGreaterThan(area(0.1));
    expect(area(1)).toBeCloseTo(SIZE * SIZE, 4);
  });
});

describe("칩 도형 안에서 자른 시계", () => {
  const SIZE = 30;
  const BEVEL = 8;
  /** `chipPoints`와 같은 모양의 깎인 네모. Phaser 없이 점만 만든다. */
  const CHIP: { x: number; y: number }[] = [
    { x: -SIZE / 2 + BEVEL, y: -SIZE / 2 },
    { x: SIZE / 2, y: -SIZE / 2 },
    { x: SIZE / 2, y: SIZE / 2 - BEVEL },
    { x: SIZE / 2 - BEVEL, y: SIZE / 2 },
    { x: -SIZE / 2, y: SIZE / 2 },
    { x: -SIZE / 2, y: -SIZE / 2 + BEVEL },
  ];

  /** 볼록 다각형 안(경계 포함)인지. 모든 변에 대해 같은 부호면 안이다. */
  function inside(point: { x: number; y: number }): boolean {
    return CHIP.every((a, index) => {
      const b = CHIP[(index + 1) % CHIP.length];
      return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -1e-6;
    });
  }

  it("은 깎인 모서리를 넘지 않는다", () => {
    // 사각형 기준으로 그리면 오른쪽 아래 빗변 밖으로 검은 조각이 흘러내려 체력 바를 가렸다.
    for (let ratio = 0.05; ratio <= 1; ratio += 0.05) {
      for (const point of clockWedgeOnShape(CHIP, ratio)) {
        expect(inside(point), `ratio ${ratio} → (${point.x}, ${point.y})`).toBe(true);
      }
    }
  });

  it("은 다 덮으면 도형의 꼭짓점을 모두 지난다", () => {
    const points = clockWedgeOnShape(CHIP, 1);
    for (const vertex of CHIP) {
      expect(points.some((point) => Math.hypot(point.x - vertex.x, point.y - vertex.y) < 1e-6), `${vertex.x},${vertex.y}`).toBe(true);
    }
  });

  it("은 비어 있으면 아무것도 그리지 않는다", () => {
    expect(clockWedgeOnShape(CHIP, 0)).toEqual([]);
  });
});
