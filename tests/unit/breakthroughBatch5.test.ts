import { describe, expect, it } from "vitest";
import { attackInterval, createSkirmish, findFighter, resolveReceivedDamage, stepSkirmish, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { FEROCITY_RULES } from "../../src/core/ferocity";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };
const NEVER = () => 0.99;

function setup(allyIds: string[], enemyIds: string[], breakthrough: number): SkirmishState {
  const state = createSkirmish(allyIds.map(getRelic), enemyIds.map(getRelic), ARENA, {}, { [allyIds[0]]: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; fighter.stealthFor = 0; }
  state.fighters.filter((fighter) => fighter.side === "enemy").forEach((foe, index) => { foe.maxHp = 10_000_000; foe.hp = foe.maxHp; foe.x = 540 + index * 60; foe.y = 1_000; });
  state.fighters.filter((fighter) => fighter.side === "player").forEach((ally, index) => { ally.x = 500 - index * 40; ally.y = 1_000; });
  return state;
}

function swing(state: SkirmishState, attackerId: string, targetId: string): SkirmishEvent[] {
  const attacker = findFighter(state, attackerId)!;
  attacker.targetId = targetId; attacker.attackCooldown = 0;
  return stepSkirmish(state, 0.05, NEVER);
}

describe("델로피 한계 돌파", () => {
  it("는 독이 걸린 적이 받는 피해가 10% 늘어난다(별 V)", () => {
    const taken = (breakthrough: number) => {
      const state = setup(["delopi"], ["amo"], breakthrough);
      swing(state, "player-0", "enemy-0");
      const foe = findFighter(state, "enemy-0")!;
      return { poison: foe.poison, hit: resolveReceivedDamage(foe, 1_000).applied };
    };
    expect(taken(4).poison).not.toBeNull();
    expect(taken(4).hit).toBe(1_100);
    expect(taken(3).hit).toBe(1_000);
  });

  it("문구가 네 슬롯 모두 자리 표시 없이 채워진다", () => {
    for (const id of ["delopi", "maki"]) for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
      const text = breakthroughEffectText(getRelic(id), slot);
      expect(text).toBeTruthy();
      expect(text).not.toMatch(/\{\w+\}/);
    }
  });
});

describe("마키 한계 돌파", () => {
  it("는 폭주 중 공격 간격이 15% 짧아진다(별 IV)", () => {
    const interval = (breakthrough: number) => {
      const state = setup(["maki"], ["amo"], breakthrough);
      const maki = findFighter(state, "player-0")!;
      maki.ferocityFever = true; maki.ferocity = FEROCITY_RULES.max;
      return attackInterval(maki, state);
    };
    expect(interval(2) / interval(3)).toBeCloseTo(1.15, 2);
  });

  it("는 착지 뒤 첫 평타를 확정 치명타 대기로 만든다(별 V)", () => {
    const state = setup(["maki"], ["amo"], 4);
    const maki = findFighter(state, "player-0")!;
    expect(maki.bt.ambushCritReady).toBe(false);
    maki.bt.ambushCritReady = true;
    const events = swing(state, "player-0", "enemy-0");
    expect(events.some((e) => e.kind === "attack" && e.attackerId === "player-0" && e.critical)).toBe(true);
    expect(maki.bt.ambushCritReady).toBe(false);
  });
});
