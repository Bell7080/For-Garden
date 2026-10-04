import { describe, expect, it } from "vitest";
import { createSkirmish, defensiveDefinition, findFighter, stepSkirmish, type Arena, type SkirmishState } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };
const NEVER = () => 0.99;
const none = { kind: "none" } as const;

/** 엘라의 한 슬롯 돌파만 남기고 나머지는 "없음"으로 바꾼 개체로 싸움을 연다 — 슬롯끼리 엮이지 않는지를 가른다. */
function ellaWith(keep: "basic" | "ultimate" | "ferocity" | "passive", breakthrough: number): SkirmishState {
  const base = getRelic("ella");
  const effects = { ...base.breakthroughEffects!, basic: none, ultimate: none, ferocity: none, passive: none, [keep]: base.breakthroughEffects![keep] };
  const state = createSkirmish([{ ...base, breakthroughEffects: effects }], [getRelic("amo")], ARENA, {}, { ella: breakthrough });
  for (const fighter of state.fighters) { fighter.attackCooldown = 999; fighter.retargetIn = 999; }
  const foe = findFighter(state, "enemy-0")!;
  foe.maxHp = 100_000_000; foe.hp = foe.maxHp; foe.x = 900; foe.y = 100;
  const ella = findFighter(state, "player-0")!;
  ella.x = 100; ella.y = 1_500;
  return state;
}

describe("엘라 한계 돌파는 슬롯끼리 엮이지 않는다", () => {
  it("폭주 돌파는 평타 돌파가 닫혀 있어도 폭주에 들어설 때 두르는 막을 35%로 키운다", () => {
    const shieldOnEntry = (breakthrough: number): number => {
      const state = ellaWith("ferocity", breakthrough);
      const ella = findFighter(state, "player-0")!;
      const foe = findFighter(state, "enemy-0")!;
      foe.x = 130; foe.y = 1_500;
      // 폭주 문턱에 선 채로 한 번 때리면 그 타격이 게이지를 채운다.
      ella.ferocity = 99.9; ella.targetId = "enemy-0"; ella.attackCooldown = 0;
      stepSkirmish(state, 0.05, NEVER);
      expect(ella.ferocityFever).toBe(true);
      return ella.shield.amount / ella.maxHp;
    };
    // 같은 타격이 평타로 두르는 얇은 막이 함께 들어 있으므로, 두 값의 차가 곧 돌파가 키운 몫이다.
    expect(shieldOnEntry(2)).toBeGreaterThanOrEqual(0.25);
    expect(shieldOnEntry(3) - shieldOnEntry(2)).toBeCloseTo(0.10, 2);
  });

  it("패시브 돌파는 불멸의 회복을 100%로 올리고 끝난 뒤 10초 동안 방어·저항을 두 배로 한다", () => {
    const state = ellaWith("passive", 4);
    const ella = findFighter(state, "player-0")!;
    const baseDef = getRelic("ella").stats.def;
    ella.hp = 1;
    ella.undyingPending = true;
    stepSkirmish(state, 0.05, NEVER);
    expect(ella.undying).not.toBeNull();
    expect(ella.regeneration?.percentPerTick).toBeCloseTo(100 / 4, 5);
    expect(defensiveDefinition(ella, state).def.stats.def).toBeCloseTo(ella.def.stats.def, 5);
    for (let t = 0; t < 4.2; t += 0.1) stepSkirmish(state, 0.1, NEVER);
    expect(ella.undying).toBeNull();
    expect(defensiveDefinition(ella, state).def.stats.def).toBeCloseTo(ella.def.stats.def * 2, 3);
    expect(defensiveDefinition(ella, state).def.stats.res).toBeCloseTo(ella.def.stats.res * 2, 3);
    for (let t = 0; t < 10.5; t += 0.1) stepSkirmish(state, 0.1, NEVER);
    expect(defensiveDefinition(ella, state).def.stats.def).toBeCloseTo(ella.def.stats.def, 3);
    expect(baseDef).toBeGreaterThan(0);
  });

  it("패시브 돌파가 닫혀 있으면 회복은 30%이고 방어는 오르지 않는다", () => {
    const state = ellaWith("passive", 3);
    const ella = findFighter(state, "player-0")!;
    ella.hp = 1; ella.undyingPending = true;
    stepSkirmish(state, 0.05, NEVER);
    expect(ella.regeneration?.percentPerTick).toBeCloseTo(30 / 4, 5);
    for (let t = 0; t < 4.2; t += 0.1) stepSkirmish(state, 0.1, NEVER);
    expect(defensiveDefinition(ella, state).def.stats.def).toBeCloseTo(ella.def.stats.def, 5);
  });

  it("문구가 방어·저항을 실제 값으로 말한다", () => {
    const ella = getRelic("ella");
    const text = breakthroughEffectText(ella, "passive", { ...ella.stats })!;
    expect(text).not.toMatch(/\{\w+\}/);
    expect(text).toContain(String(Math.round(ella.stats.def)));
    expect(breakthroughEffectText(ella, "ferocity")).toContain("35%");
  });
});
