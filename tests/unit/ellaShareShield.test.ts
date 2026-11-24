import { describe, expect, it } from "vitest";
import { createSkirmish, findFighter, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };
const NEVER = () => 0.99;

describe("엘라 궁극기 돌파 「막 나누기」", () => {
  it("도발이 끝나면 막의 절반을 소환수를 뺀 아군에게 나눈다", () => {
    const state = createSkirmish([getRelic("ella"), getRelic("dian")], [getRelic("amo")], ARENA, {}, { ella: 4 });
    for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; }
    const foe = findFighter(state, "enemy-0")!;
    foe.x = 900; foe.y = 100; foe.maxHp = 100_000_000; foe.hp = foe.maxHp;
    const ella = findFighter(state, "player-0")!;
    const dian = findFighter(state, "player-1")!;
    const wolves = state.fighters.filter((fighter) => fighter.summonOwnerId === dian.id && fighter.hp > 0);
    expect(wolves.length).toBeGreaterThan(0);
    ella.shield.amount = 1_000;
    ella.bt.shareShieldIn = 0.01;
    stepSkirmish(state, 0.05, NEVER);
    expect(dian.shield.amount).toBeGreaterThan(0);
    for (const wolf of wolves) expect(wolf.shield.amount).toBe(0);
  });
});
