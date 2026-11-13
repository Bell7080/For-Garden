import { describe, expect, it } from "vitest";
import { createSkirmish, defensiveDefinition, huddlePercent, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

/*
 * 2026-11-13 응태 — 토비·아모·리파 개편. 태그 문장은 `skillArt.test`가, 실제 전투가 그 문장대로 도는지는 여기서 본다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };

describe("아모 「웅크린 무리」", () => {
  it("곁에 선 다른 아군 한 명당 방어·저항이 오르고 상한(2명)에서 멈춘다", () => {
    const state = createSkirmish([getRelic("torika")], [getRelic("amo"), getRelic("toby"), getRelic("ripa")], ARENA);
    const [amo, toby, ripa] = state.fighters.filter((fighter) => fighter.side === "enemy");
    const plan = amo.def.passive.huddle!;
    const far = (x: number) => ({ x, y: 100 });
    Object.assign(amo, far(500)); Object.assign(toby, far(500 + plan.radius + 200)); Object.assign(ripa, far(500 - plan.radius - 200));
    expect(huddlePercent(state, amo)).toBe(0);
    const base = defensiveDefinition(amo, state).def.stats;
    Object.assign(toby, far(500 + plan.radius - 10));
    expect(huddlePercent(state, amo)).toBe(plan.defenseResistancePercentPerAlly);
    Object.assign(ripa, far(500 - plan.radius + 10));
    expect(huddlePercent(state, amo)).toBe(plan.maxAllies * plan.defenseResistancePercentPerAlly);
    const huddled = defensiveDefinition(amo, state).def.stats;
    expect(huddled.def).toBeCloseTo(base.def * (1 + plan.maxAllies * plan.defenseResistancePercentPerAlly / 100));
    expect(huddled.res).toBeCloseTo(base.res * (1 + plan.maxAllies * plan.defenseResistancePercentPerAlly / 100));
  });
});

describe("토비 「난동」", () => {
  it("적중마다 오르는 공속이 태그가 말하는 상한에서 멈춘다", () => {
    const state = createSkirmish([getRelic("amo")], [getRelic("toby")], ARENA);
    const toby = state.fighters.find((fighter) => fighter.side === "enemy")!;
    const tank = state.fighters.find((fighter) => fighter.side === "player")!;
    // 끝나지 않게 둘 다 버티게 두고 오래 돌린다.
    for (let i = 0; i < 1_200; i += 1) {
      tank.hp = tank.def.stats.hp; toby.hp = toby.def.stats.hp;
      stepSkirmish(state, 1 / 30, () => 0.5);
    }
    const cap = toby.def.passive.maxStacks! * toby.def.passive.value;
    expect(toby.bonusAttackSpeed).toBe(cap);
  });
});
