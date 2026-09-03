import { describe, expect, it } from "vitest";
import { clockWedgePoints } from "../../src/ui/clockWedge";

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
