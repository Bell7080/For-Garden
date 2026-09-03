import { describe, expect, it } from "vitest";
import { KNOCKBACK, type Arena } from "../../src/core/skirmish";
import { knockbackFlightPath } from "../../src/ui/knockbackFlight";

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

/**
 * 튕겨 날아가는 궤적은 사망 연출과 폭주 날려버림이 함께 쓴다. 화면이 매 프레임 위치를
 * 적분하면 배속에 따라 부딪히는 자리가 달라지므로, 구간을 미리 끊어 두는 이 규칙을 고정한다.
 */
describe("튕겨 날아가는 궤적", () => {
  it("은 전장 밖으로 나가지 않는다", () => {
    const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 1400, vy: -900, seconds: 2, arena: ARENA });
    expect(legs.length).toBeGreaterThan(1);
    for (const leg of legs) {
      expect(leg.x).toBeGreaterThanOrEqual(ARENA.left - 1e-6);
      expect(leg.x).toBeLessThanOrEqual(ARENA.right + 1e-6);
      expect(leg.y).toBeGreaterThanOrEqual(ARENA.top - 1e-6);
      expect(leg.y).toBeLessThanOrEqual(ARENA.bottom + 1e-6);
    }
  });

  it("은 주어진 시간을 남김없이 나눠 갖는다", () => {
    const seconds = 1.4;
    const legs = knockbackFlightPath({ x: 400, y: 900, vx: -800, vy: 600, seconds, arena: ARENA });
    const total = legs.reduce((sum, leg) => sum + leg.durationMs, 0);
    // 구간을 다 이어 붙이면 원래 시간이 된다 — 모자라면 연출이 일찍 끝나고 남으면 시체가 남는다.
    expect(total).toBeCloseTo(seconds * 1_000, 6);
  });

  it("은 벽에 닿은 구간만 튕겼다고 표시한다", () => {
    const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 1400, vy: 0, seconds: 2, arena: ARENA });
    // 마지막 구간은 시간이 다 되어 끝난 것이므로 튕긴 것이 아니다.
    expect(legs[legs.length - 1].bounced).toBe(false);
    expect(legs.slice(0, -1).every((leg) => leg.bounced)).toBe(true);
    // 첫 구간의 끝은 정확히 오른쪽 벽이다.
    expect(legs[0].x).toBeCloseTo(ARENA.right, 6);
  });

  it("은 튕길 때마다 힘을 잃어 구간이 점점 짧아진다", () => {
    const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 900, vy: 0, seconds: 6, arena: ARENA });
    const spans = legs.filter((leg) => leg.bounced).map((leg, index, all) =>
      index === 0 ? Math.abs(leg.x - 540) : Math.abs(leg.x - all[index - 1].x));
    expect(spans.length).toBeGreaterThan(2);
    // 감쇠는 코어와 같은 값을 쓴다 — 화면과 계산이 다른 물리를 쓰면 날아가는 자리가 갈린다.
    expect(KNOCKBACK.restitution).toBeLessThan(1);
    expect(spans[2]).toBeLessThan(spans[1]);
  });

  it("은 속도가 없으면 그 자리에 머문다", () => {
    const legs = knockbackFlightPath({ x: 300, y: 800, vx: 0, vy: 0, seconds: 0.5, arena: ARENA });
    expect(legs).toEqual([{ x: 300, y: 800, durationMs: 500, bounced: false }]);
  });
});
