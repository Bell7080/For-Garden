import { describe, expect, it } from "vitest";
import { KNOCKBACK, type Arena } from "../../src/core/skirmish";
import { knockbackFlightPath } from "../../src/ui/knockbackFlight";

const ARENA: Arena = { left: 130, right: 950, top: 600, bottom: 1360 };

/**
 * 튕겨 날아가는 궤적은 사망 연출이 쓴다(폭주 날려버림은 코어가 좌표를 옮긴다). 화면이 매
 * 프레임 위치를 적분하면 배속에 따라 부딪히는 자리가 달라지므로, 구간을 미리 끊어 둔다.
 */
describe("튕겨 날아가는 궤적", () => {
  it("은 전장 밖으로 나가지 않는다", () => {
    const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 1400, vy: -900, bounces: 6, arena: ARENA });
    expect(legs.length).toBeGreaterThan(1);
    for (const leg of legs) {
      expect(leg.x).toBeGreaterThanOrEqual(ARENA.left - 1e-6);
      expect(leg.x).toBeLessThanOrEqual(ARENA.right + 1e-6);
      expect(leg.y).toBeGreaterThanOrEqual(ARENA.top - 1e-6);
      expect(leg.y).toBeLessThanOrEqual(ARENA.bottom + 1e-6);
    }
  });

  it("은 시킨 횟수만큼만 벽에 부딪힌다", () => {
    // 끝을 시간이 아니라 횟수로 정한다 — 시간으로 끊으면 전장 크기와 속도에 따라 튕기는
    // 수가 달라져 같은 연출이 판마다 다른 무게로 읽힌다.
    for (const bounces of [3, 6]) {
      const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 2400, vy: -900, bounces, arena: ARENA });
      expect(legs.filter((leg) => leg.bounced)).toHaveLength(bounces);
    }
  });

  it("은 벽에 닿은 구간만 튕겼다고 표시하고 마지막에 짧게 미끄러진다", () => {
    const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 1400, vy: 0, bounces: 3, arena: ARENA });
    // 마지막 구간은 벽에 붙은 채 끝나지 않도록 조금 미끄러지는 몫이다.
    expect(legs[legs.length - 1].bounced).toBe(false);
    expect(legs.slice(0, -1).every((leg) => leg.bounced)).toBe(true);
    // 첫 구간의 끝은 정확히 오른쪽 벽이다.
    expect(legs[0].x).toBeCloseTo(ARENA.right, 6);
  });

  it("은 튕길 때마다 힘을 잃어 구간이 점점 짧아진다", () => {
    const legs = knockbackFlightPath({ x: 540, y: 1000, vx: 900, vy: 0, bounces: 6, arena: ARENA });
    const walls = legs.filter((leg) => leg.bounced);
    // 감쇠는 코어와 같은 값을 쓴다 — 화면과 계산이 다른 물리를 쓰면 날아가는 자리가 갈린다.
    expect(KNOCKBACK.restitution).toBeLessThan(1);
    // 벽 사이를 오가는 데 걸리는 시간이 점점 늘어난다(= 느려진다).
    expect(walls[2].durationMs).toBeGreaterThan(walls[1].durationMs);
  });

  it("은 속도가 없으면 아무 구간도 만들지 않는다", () => {
    expect(knockbackFlightPath({ x: 300, y: 800, vx: 0, vy: 0, bounces: 6, arena: ARENA })).toEqual([]);
  });
});
