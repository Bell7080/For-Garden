import { describe, expect, it } from "vitest";
import { lashPoints } from "../../src/ui/reachStrikeShape";
import { REACH_STRIKE } from "../../src/ui/effectPresets";

/**
 * 채찍 리본의 도형 계약.
 *
 * 곧은 선 하나면 레이저로 보이고, 뿌리와 끝의 폭이 같으면 막대로 보인다. 그 둘이 아니라는
 * 것을 여기서 잰다 — 화면에서는 130ms만 보이므로 눈으로는 확인할 수 없다.
 */
describe("채찍 리본", () => {
  const from = { x: 0, y: 0 };
  const to = { x: 300, y: 0 };
  const control = { x: 150, y: 40 };
  const { rootWidth, tipWidth } = REACH_STRIKE.lash;

  /** 리본의 두 변에서 같은 마디끼리의 거리 = 그 자리의 두께. */
  function thicknessAt(index: number, points: ReturnType<typeof lashPoints>): number {
    const left = points[index];
    const right = points[points.length - 1 - index];
    return Math.hypot(left.x - right.x, left.y - right.y);
  }

  it("은 뿌리가 두껍고 끝으로 갈수록 가늘어진다", () => {
    const points = lashPoints(from, control, to, rootWidth, tipWidth);
    const root = thicknessAt(0, points);
    const tip = thicknessAt(points.length / 2 - 1, points);
    expect(root).toBeCloseTo(rootWidth, 5);
    expect(tip).toBeCloseTo(tipWidth, 5);
    expect(tip).toBeLessThan(root);
  });

  it("은 곧은 선이 아니라 한 번 휜다", () => {
    const points = lashPoints(from, control, to, rootWidth, tipWidth);
    // 가운데 마디가 양 끝을 잇는 직선(여기서는 y = 0)에서 실제로 벗어나야 채찍으로 읽힌다.
    const middle = points[Math.floor(points.length / 4)];
    expect(Math.abs(middle.y)).toBeGreaterThan(rootWidth);
  });

  it("은 닫힌 폴리곤이라 점 수가 짝수다", () => {
    const points = lashPoints(from, control, to, rootWidth, tipWidth);
    expect(points.length % 2).toBe(0);
    expect(points.length).toBeGreaterThan(6);
  });
});

describe("탄환", () => {
  it("은 다음 평타보다 짧게 날아간다", () => {
    // 연출이 길면 피해 숫자가 먼저 뜨고 총알이 나중에 닿는다.
    expect(REACH_STRIKE.bullet.ms).toBeLessThan(300);
    expect(REACH_STRIKE.lash.ms).toBeLessThan(REACH_STRIKE.bullet.ms);
  });

  it("은 채찍보다 두껍고 한 겹 위에 선다", () => {
    // 중거리 적과 원거리 아군이 맞붙으면 둘이 같은 길 위에 겹친다. 얇거나 같은 깊이면
    // 나중에 열린 채찍이 탄환을 통째로 덮어 무엇이 날아갔는지 보이지 않는다.
    expect(REACH_STRIKE.bullet.thickness).toBeGreaterThan(REACH_STRIKE.lash.rootWidth);
    expect(REACH_STRIKE.bullet.depthLift).toBeGreaterThan(0);
  });
});

describe("채찍이 비우는 길", () => {
  it("은 두 자리를 통째로 잇지 않고 닿는 쪽 끝만 그린다", () => {
    // 0이면 화면을 가로지르는 리본이 되어 그 사이의 탄환을 덮고, 1에 가까우면 채찍이
    // 사라져 무엇이 때렸는지 남지 않는다.
    expect(REACH_STRIKE.lash.startAt).toBeGreaterThan(0.15);
    expect(REACH_STRIKE.lash.startAt).toBeLessThan(0.6);
  });
});
