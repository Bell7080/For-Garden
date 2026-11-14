import { describe, expect, it } from "vitest";
import { applyCombatStatusEffect, createSkirmish, fireUltimate, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { skillDescription } from "../../src/ui/skillPresentation";

/**
 * 아르테 — 바람 SR 근거리 지원가. 평타는 밀어내기·막 깨기만 하고(둔화 없음), 궁극기 「대청소」는 지정 원을 쓸어 내는
 * 강한 광역 피해 뒤 생존 아군 전원에게 막과 방어·저항 강화를 남긴다. 해로운 효과를 걷는 일은 궁극기 돌파의 몫이다.
 */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };
const ARTE = getRelic("arte");

function setup(breakthrough = 0) {
  const state = createSkirmish([ARTE, getRelic("torika")], [getRelic("amo"), getRelic("toby")], ARENA);
  const [arte, ally] = state.fighters.filter((fighter) => fighter.side === "player");
  const enemies = state.fighters.filter((fighter) => fighter.side === "enemy");
  for (const fighter of state.fighters) { fighter.attackCooldown = Number.POSITIVE_INFINITY; fighter.retargetIn = Number.POSITIVE_INFINITY; }
  arte.breakthrough = breakthrough;
  arte.x = 500; arte.y = 900; ally.x = 560; ally.y = 900;
  enemies.forEach((enemy, index) => { enemy.x = 470 + index * 60; enemy.y = 600; enemy.stealthFor = 0; });
  arte.energy = 1_000;
  return { state, arte, ally, enemies };
}

function chilled(state: SkirmishState, targetId: string, sourceId: string): void {
  const target = state.fighters.find((fighter) => fighter.id === targetId)!;
  applyCombatStatusEffect(target, { kind: "chill", speedPercentPerStack: 10, maxStacks: 2, seconds: 5 }, [], state, sourceId);
}

describe("아르테 — 대걸레질·대청소", () => {
  it("의 평타는 둔화를 걸지 않는다", () => {
    expect(ARTE.basic.statusEffects ?? []).toEqual([]);
  });

  it("의 대청소는 원 안의 적에게 강한 마법 피해를 주고 아군 전원에게 막과 강화를 남긴다", () => {
    const { state, arte, ally, enemies } = setup();
    const before = enemies.map((enemy) => enemy.hp);
    fireUltimate(state, arte.id, () => 0.99, { x: 500, y: 600 });
    enemies.forEach((enemy, index) => expect(enemy.hp).toBeLessThan(before[index]!));
    for (const friend of [arte, ally]) {
      expect(friend.shield.amount).toBeGreaterThan(0);
      expect(friend.scrub?.defenseResistancePercent).toBe(20);
    }
  });

  it("는 돌파 전에는 해로운 효과를 걷지 않고, 궁극기 돌파가 열리면 걷는다", () => {
    const plain = setup();
    chilled(plain.state, plain.ally.id, plain.enemies[0]!.id);
    fireUltimate(plain.state, plain.arte.id, () => 0.99, { x: 500, y: 600 });
    expect(plain.ally.chill).not.toBeNull();

    const opened = setup(4);
    chilled(opened.state, opened.ally.id, opened.enemies[0]!.id);
    fireUltimate(opened.state, opened.arte.id, () => 0.99, { x: 500, y: 600 });
    expect(opened.ally.chill).toBeNull();
  });

  it("의 설명은 피해와 막·강화를 함께 말하고 정화는 말하지 않는다", () => {
    const text = skillDescription(ARTE.ultimate, { ap: ARTE.stats.ap });
    expect(text).toContain("보호막");
    expect(text).not.toContain("해로운 효과");
  });
});
