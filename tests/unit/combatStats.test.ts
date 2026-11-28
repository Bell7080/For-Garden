import { describe, expect, it } from "vitest";
import { applyBattleStatBonuses, displayCombatStats } from "../../src/core/combatStats";
import { combatPower } from "../../src/core/combatPower";
import { createSkirmish } from "../../src/core/skirmish";
import type { ExpeditionAugmentEffect } from "../../src/core/expeditionAugments";
import type { RuneInstance } from "../../src/core/runes";
import { getRelic } from "../../src/data/relics";

const ARENA = { left: 0, right: 1000, top: 0, bottom: 1600 };
const ATK_UP: ExpeditionAugmentEffect = { kind: "attackPowerPercent", percent: 16, scope: { kind: "all" } } as ExpeditionAugmentEffect;
const HP_UP: ExpeditionAugmentEffect = { kind: "maxHpPercent", percent: 14, scope: { kind: "all" } } as ExpeditionAugmentEffect;

describe("전투가 얹는 상시 몫은 전투와 전투력이 같은 함수로 읽는다", () => {
  it("전투 시작 능력치가 applyBattleStatBonuses와 같다(증강 · 패시브 돌파)", () => {
    const rexia = getRelic("rexia");
    const augments = [ATK_UP, HP_UP];
    const state = createSkirmish([rexia], [getRelic("torika")], ARENA, {}, { rexia: 4 }, { augmentEffects: augments });
    const expected = applyBattleStatBonuses(rexia, rexia.stats, 4, augments);
    const fighter = state.fighters.find((f) => f.side === "player")!;
    expect(fighter.def.stats.atk).toBeCloseTo(expected.atk, 6);
    expect(fighter.def.stats.def).toBeCloseTo(expected.def, 6);
    expect(fighter.maxHp).toBeCloseTo(expected.hp, 6);
  });

  it("렉시아 패시브 돌파는 열린 뒤에만 체력·방어·저항을 25% 올리고 전투력에 든다", () => {
    const rexia = getRelic("rexia");
    const closed = applyBattleStatBonuses(rexia, rexia.stats, 0, []);
    const open = applyBattleStatBonuses(rexia, rexia.stats, 4, []);
    expect(closed).toEqual(rexia.stats);
    expect(open.hp).toBeCloseTo(rexia.stats.hp * 1.25, 6);
    expect(open.res).toBeCloseTo(rexia.stats.res * 1.25, 6);
    expect(combatPower(open, rexia.stats)).toBeGreaterThan(combatPower(closed, rexia.stats));
    // 다른 개체의 돌파는 이 몫을 갖지 않는다.
    const torika = getRelic("torika");
    expect(applyBattleStatBonuses(torika, torika.stats, 4, [])).toEqual(torika.stats);
  });

  it("룬 특성의 치명타 피해는 표시 능력치에 든다", () => {
    const torika = getRelic("torika");
    const rune = { instanceId: "t", trait: { id: "deepWound", grade: "legendary", upgradeMisses: 0 } } as unknown as RuneInstance;
    const shown = displayCombatStats(torika, torika.stats, 0, [rune]);
    expect(shown.critDamage).toBeGreaterThan(torika.stats.critDamage);
  });

  it("원정 증강은 표시 능력치에 든다", () => {
    const torika = getRelic("torika");
    const shown = displayCombatStats(torika, torika.stats, 0, [], [ATK_UP]);
    expect(shown.atk).toBeCloseTo(torika.stats.atk * 1.16, 6);
    expect(combatPower(shown, torika.stats)).toBeGreaterThan(combatPower(torika.stats, torika.stats));
  });
});
