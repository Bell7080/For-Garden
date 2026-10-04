import { describe, expect, it } from "vitest";
import { createSkirmish, defensiveDefinition, fireUltimate, findFighter, stepSkirmish, tryTriggerEmergencyRecovery, type Arena, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import { breakthroughEffectText } from "../../src/ui/skillPresentation";

const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_600 };

/** 적 한 명(돌파 단계 지정)과 아군 한 명을 붙여 세운다. */
function duel(enemyId: string, breakthrough: number, playerId = "torika"): SkirmishState {
  const state = createSkirmish([getRelic(playerId)], [getRelic(enemyId)], ARENA, {}, {}, { enemyBreakthroughs: [breakthrough] });
  const ally = findFighter(state, "player-0")!;
  const enemy = findFighter(state, "enemy-0")!;
  enemy.x = ally.x + 40; enemy.y = ally.y;
  return state;
}

function run(state: SkirmishState, seconds: number): SkirmishEvent[] {
  const events: SkirmishEvent[] = [];
  for (let t = 0; t < seconds * 20; t += 1) events.push(...stepSkirmish(state, 0.05));
  return events;
}

describe("적 전용 한계 돌파", () => {
  it("레이티아 II — 앞니에 갉인 적의 방어력이 겹마다 깎인다", () => {
    const open = duel("raitia-grass", 1);
    const closed = duel("raitia-grass", 0);
    run(open, 6); run(closed, 6);
    const base = getRelic("torika").stats.def;
    const shaved = defensiveDefinition(findFighter(open, "player-0")!, open).def.stats.def;
    expect(findFighter(open, "player-0")!.bt.fangShave?.stacks ?? 0).toBeGreaterThan(0);
    expect(shaved).toBeLessThan(base);
    expect(defensiveDefinition(findFighter(closed, "player-0")!, closed).def.stats.def).toBe(base);
  });

  it("토비 II — 세 번째 적중마다 같은 피해가 한 번 더 들어간다", () => {
    const open = duel("toby", 1);
    const closed = duel("toby", 0);
    const hits = (events: SkirmishEvent[]) => events.filter((e) => e.kind === "attack" && e.attackerId === "enemy-0" && e.skill === "basic");
    const a = hits(run(open, 10)); const b = hits(run(closed, 10));
    expect(a.filter((e) => e.kind === "attack" && e.followUp).length).toBeGreaterThan(0);
    expect(b.filter((e) => e.kind === "attack" && e.followUp).length).toBe(0);
  });

  it("토비 IV — 폭주 중에만 피해의 일부가 체력으로 돌아온다", () => {
    const heal = (breakthrough: number, fever: boolean): number => {
      const state = duel("toby", breakthrough);
      const toby = findFighter(state, "enemy-0")!;
      toby.hp = toby.maxHp * 0.5; toby.ferocityFever = fever;
      findFighter(state, "player-0")!.attackCooldown = 999;
      const before = toby.hp;
      run(state, 3);
      return toby.hp - before;
    };
    expect(heal(3, true)).toBeGreaterThan(heal(0, true));
    expect(heal(3, false)).toBe(heal(0, false));
  });

  it("아모 III — 궁극기 보호막이 커진다", () => {
    const shield = (breakthrough: number): number => {
      const state = duel("amo", breakthrough);
      const amo = findFighter(state, "enemy-0")!;
      amo.energy = 100;
      fireUltimate(state, "enemy-0");
      return amo.shield.amount;
    };
    expect(shield(2)).toBeGreaterThan(shield(0));
  });

  it("리파 II·III — 시약이 한 번에 더 많이 묻는다", () => {
    const stacks = (breakthrough: number): number => {
      const state = duel("ripa", breakthrough);
      findFighter(state, "player-0")!.attackCooldown = 999;
      run(state, 1.5);
      return findFighter(state, "player-0")!.reagents["enemy-0"]?.stacks ?? 0;
    };
    expect(stacks(1)).toBeGreaterThan(stacks(0));
  });

  it("코마 III — 궁극기를 쓴 직후 순간이동 시계가 바로 돈다", () => {
    const state = duel("koma", 2);
    const koma = findFighter(state, "enemy-0")!;
    koma.energy = 100; koma.huntCooldown = 8;
    fireUltimate(state, "enemy-0");
    expect(koma.huntCooldown).toBe(0);
    const closed = duel("koma", 0);
    const k0 = findFighter(closed, "enemy-0")!;
    k0.energy = 100; k0.huntCooldown = 8;
    fireUltimate(closed, "enemy-0");
    expect(k0.huntCooldown).toBe(8);
  });

  it("코마 V — 순간이동 뒤 확정 치명타가 연달아 이어진다", () => {
    const state = duel("koma", 4);
    const koma = findFighter(state, "enemy-0")!;
    koma.huntCooldown = 0.01;
    stepSkirmish(state, 0.05);
    expect(koma.empoweredBasic || koma.bt.blinkCrits > 0).toBe(true);
    expect(koma.bt.blinkCrits).toBe(1);
  });

  it("레이티아 V — 겨울잠이 첫 회복이 끝난 뒤 한 번 더 발동한다", () => {
    const state = duel("raitia-grass", 4);
    const rat = findFighter(state, "enemy-0")!;
    rat.hp = rat.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(rat, state)).toBe(true);
    expect(tryTriggerEmergencyRecovery(rat, state)).toBe(false);
    rat.regeneration = null; rat.hp = rat.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(rat, state)).toBe(true);
    rat.regeneration = null; rat.hp = rat.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(rat, state)).toBe(false);
    const closed = duel("raitia-grass", 0);
    const r0 = findFighter(closed, "enemy-0")!;
    r0.hp = r0.maxHp * 0.4; tryTriggerEmergencyRecovery(r0, closed);
    r0.regeneration = null; r0.hp = r0.maxHp * 0.4;
    expect(tryTriggerEmergencyRecovery(r0, closed)).toBe(false);
  });

  it("아모 IV — 폭주 중 아군이 맞는 피해의 일부를 대신 받는다", () => {
    const state = createSkirmish([getRelic("torika")], [getRelic("amo"), getRelic("toby")], ARENA, {}, {}, { enemyBreakthroughs: [3, 0] });
    const amo = findFighter(state, "enemy-0")!;
    amo.ferocityFever = true;
    const ally = findFighter(state, "player-0")!;
    ally.x = 500; ally.y = 800;
    const toby = findFighter(state, "enemy-1")!;
    toby.x = 520; toby.y = 800;
    const events = run(state, 4);
    expect(events.some((e) => e.kind === "damageShared" && e.fighterId === "enemy-0")).toBe(true);
  });

  it("모든 적 돌파 문구가 번역 키 그대로 노출되지 않는다", () => {
    for (const id of ["raitia-grass", "raitia-water", "raitia-fire", "raitia-earth", "raitia-wind", "toby", "amo", "ripa", "koma"]) {
      for (const slot of ["basic", "ultimate", "ferocity", "passive"] as const) {
        const text = breakthroughEffectText(getRelic(id), slot);
        expect(text, `${id} ${slot}`).toBeTruthy();
        expect(text, `${id} ${slot}`).not.toMatch(/^skill\./);
      }
    }
  });

  it("레이티아 다섯 종은 같은 한계 돌파를 가진다", () => {
    const sets = ["raitia-grass", "raitia-water", "raitia-fire", "raitia-earth", "raitia-wind"].map((id) => JSON.stringify(getRelic(id).breakthroughEffects));
    expect(new Set(sets).size).toBe(1);
  });
});
