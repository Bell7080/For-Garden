import { describe, expect, it } from "vitest";
import { expeditionAugmentStatMultipliers, type ExpeditionAugmentEffect } from "../../src/core/expeditionAugments";
import { createSkirmish, stepSkirmish } from "../../src/core/skirmish";
import { EXPEDITION_AUGMENTS } from "../../src/data/expeditionAugments";
import { getRelic } from "../../src/data/relics";

/** 새 증강 능력치는 운영 데이터, 순수 합산기, 전투 초기화 경계를 한 묶음으로 회귀 고정한다. */
describe("원정 증강 능력치", () => {
  it("SR/SSR마다 모든 전술 카테고리와 유효한 백분율 후보를 제공한다", () => {
    const categories = ["attack", "spell", "survival", "shield", "recovery", "status", "conditional"];
    for (const rarity of ["sr", "ssr"] as const) {
      const pool = EXPEDITION_AUGMENTS.filter((augment) => augment.rarity === rarity);
      expect(new Set(pool.map(({ category }) => category))).toEqual(new Set(categories));
      for (const augment of pool) {
        expect(augment.effect.percent).toBeGreaterThan(0);
        expect(augment.effect.percent).toBeLessThanOrEqual(40);
      }
    }
  });

  it("능력치별 전체/개인 효과만 더한 뒤 독립된 배율을 반환한다", () => {
    const effects: ExpeditionAugmentEffect[] = [
      { kind: "maxHpPercent", percent: 10, scope: { kind: "all" } },
      { kind: "maxHpPercent", percent: 20, scope: { kind: "relic", relicId: "rex" } },
      { kind: "defensePercent", percent: 15, scope: { kind: "all" } },
      { kind: "spellPowerPercent", percent: 25, scope: { kind: "relic", relicId: "anky" } },
    ];
    expect(expeditionAugmentStatMultipliers(effects, "rex")).toMatchObject({ maxHpPercent: 1.3, defensePercent: 1.15, spellPowerPercent: 1 });
    expect(expeditionAugmentStatMultipliers(effects, "anky")).toMatchObject({ maxHpPercent: 1.1, defensePercent: 1.15, spellPowerPercent: 1.25 });
  });

  it("전투 스냅샷에 모든 능력치와 시작 보호막을 한 번만 적용하고 HP 비율을 보존한다", () => {
    const original = getRelic("rex");
    const base = { ...original.stats };
    const effects: ExpeditionAugmentEffect[] = [
      ...(["maxHpPercent", "defensePercent", "resistancePercent", "attackPowerPercent", "spellPowerPercent", "attackSpeedPercent"] as const)
        .map((kind) => ({ kind, percent: 20, scope: { kind: "all" as const } })),
      { kind: "initialShieldPercent", percent: 10, scope: { kind: "all" } },
      { kind: "statusPotencyPercent", percent: 25, scope: { kind: "all" } },
    ];
    const state = createSkirmish([original], [getRelic("husk-shell")], { left: 0, right: 600, top: 0, bottom: 1000 }, {}, {}, {
      augmentEffects: effects,
      playerInitialStates: [{ relicId: original.id, currentHp: 40, alive: true }],
    });
    const fighter = state.fighters[0];
    expect(fighter.def.stats).toMatchObject({ hp: base.hp * 1.2, def: base.def * 1.2, res: base.res * 1.2, atk: base.atk * 1.2, ap: base.ap * 1.2, attackSpeed: base.attackSpeed * 1.2 });
    expect(fighter.hp / fighter.maxHp).toBeCloseTo(0.4);
    expect(fighter.shield.amount).toBeCloseTo(fighter.maxHp * 0.1);
    expect(fighter.statusPotencyMultiplier).toBe(1.25);
    // 정적 카탈로그 원본은 다른 전투와 도감이 계속 공유하므로 절대 보정하지 않는다.
    expect(original.stats).toEqual(base);
  });

  it("상태 위력을 기존 출혈 상태 경로의 지속시간에 적용한다", () => {
    const state = createSkirmish([getRelic("rex")], [getRelic("husk-shell")], { left: 0, right: 600, top: 0, bottom: 1000 }, {}, {}, { augmentEffects: [
      { kind: "statusPotencyPercent", percent: 25, scope: { kind: "all" } },
      { kind: "bleedOnAttack", percent: 4, seconds: 4, scope: { kind: "all" } },
    ] });
    const [ally, foe] = state.fighters;
    ally.x = foe.x = 300; ally.y = foe.y = 500; ally.attackCooldown = 0; foe.attackCooldown = 99;
    stepSkirmish(state, 1 / 60);
    expect(foe.bleed?.total).toBe(5);
  });
});
