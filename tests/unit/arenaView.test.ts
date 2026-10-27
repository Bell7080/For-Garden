import { describe, expect, it } from "vitest";
import { arenaViewAlly, arenaViewFlipped, mirrorFightersY, mirrorPointsY } from "../../src/core/arenaView";

describe("실시간 아레나 화면 시점", () => {
  it("위쪽 자리(1번)만 뒤집고, 뒤집힌 화면에서는 코어의 적 편이 아군이다", () => {
    expect(arenaViewFlipped(0)).toBe(false);
    expect(arenaViewFlipped(1)).toBe(true);
    expect(arenaViewAlly("player", false)).toBe(true);
    expect(arenaViewAlly("enemy", true)).toBe(true);
    expect(arenaViewAlly("player", true)).toBe(false);
  });

  it("전투원을 거울에 비췄다가 비트 단위로 되돌린다", () => {
    const fighter = {
      x: 100, y: 1400.1234567, dashY: 12.5, hop: 3,
      knockback: { remaining: 1, vx: 3, vy: -7, bouncesLeft: 1 },
      shallowPools: [{ x: 1, y: 900.7, remaining: 2, total: 3 }],
      def: { pos: { x: 1, y: 5 } },
    };
    const before = structuredClone(fighter);
    const restore = mirrorFightersY([fighter], 2110);
    expect(fighter.y).toBeCloseTo(2110 - 1400.1234567);
    expect(fighter.dashY).toBe(-12.5);
    expect(fighter.knockback.vy).toBe(7);
    expect(fighter.shallowPools[0].y).toBeCloseTo(2110 - 900.7);
    expect(fighter.def.pos.y).toBe(5);
    expect(fighter.hop).toBe(3);
    restore();
    expect(fighter).toEqual(before);
  });

  it("사건의 점은 사본에서만 뒤집는다", () => {
    const event = { kind: "charge", from: { x: 1, y: 700 }, to: { x: 2, y: 1400 } };
    const mirrored = mirrorPointsY(event, 2110);
    expect(mirrored.from.y).toBe(1410);
    expect(mirrored.to.y).toBe(710);
    expect(event.from.y).toBe(700);
  });
});
