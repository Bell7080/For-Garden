import { describe, expect, it } from "vitest";
import { EXPEDITION_STAT_AUGMENTS } from "../../src/data/expeditionStatAugments";
import { expeditionBattleEffects } from "../../src/core/expeditionBattle";
import { createSkirmish, stepSkirmish } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";
import type { RelicDef } from "../../src/core/types";
import { expeditionAugmentEffectLabel } from "../../src/ui/expeditionAugmentBadges";
import { expeditionAugmentKeywords } from "../../src/ui/expeditionAugmentKeywords";
import { parseKeywordText } from "../../src/data/keywords";

function setup(id?: string, nativeLifesteal = 0) {
  const base = getRelic("dodo");
  const unit = (unitId: string): RelicDef => ({ ...base, id: unitId,
    stats: { ...base.stats, hp: 10000, atk: 200, ap: 200, def: 100, res: 100, critChance: 0, critDamage: 150, lifeSteal: nativeLifesteal, energyGain: 12, ferocityGain: 0, moveSpeed: 100 },
    passive: { ...base.passive, kind: "summonDerived", value: 0 },
    basic: { id: "stat-test-basic", name: "test", iconAssetId: "skill-icon-physical", effectType: "physical", targeting: "single", damageType: "physical", power: 100 },
  });
  const owner = unit("owner");
  const state = createSkirmish([owner], [unit("enemy")], { left: 0, right: 600, top: 0, bottom: 1000 }, {}, {}, {
    augmentEffects: id ? expeditionBattleEffects([{ augmentId: id, targetRelicId: "owner" }]) : [],
  });
  const [player, target] = state.fighters;
  player.x = target.x = 300; player.y = target.y = 500;
  player.attackCooldown = 0; target.attackCooldown = 999; player.hp = player.maxHp / 2;
  return state;
}

describe("상시 흡혈·치명·충전·이동 증강", () => {
  it("6개 누락 능력치에 SR·SSR 12종을 제공하며 무제한 중복 획득하지 않는다", () => {
    expect(EXPEDITION_STAT_AUGMENTS).toHaveLength(12);
    for (const def of EXPEDITION_STAT_AUGMENTS) {
      expect(def.maxStacks).toBe(1); expect(def.exclusiveGroup).toBeTruthy();
      expect(expeditionAugmentEffectLabel(def)).not.toBe("효과");
    }
  });
  it("상시 흡혈은 기존 비율에 가산한다", () => {
    expect(setup("stat-lifesteal-sr", 10).fighters[0].def.stats.lifeSteal).toBe(14);
    expect(setup("stat-lifesteal-ssr", 10).fighters[0].def.stats.lifeSteal).toBe(17);
    expect(getRelic("dodo").stats.lifeSteal).toBe(0);
  });
  it("실제 HP 손실만 흡혈하며 보호막·초과 피해에서 회복량을 부풀리지 않는다", () => {
    const state = setup("stat-lifesteal-sr"); const [owner, target] = state.fighters;
    const hp = owner.hp, enemyHp = target.hp;
    stepSkirmish(state, 1 / 60, () => 0.99);
    expect(owner.hp - hp).toBeCloseTo(Math.round((enemyHp - target.hp) * 0.04), 0);
    const shielded = setup("stat-lifesteal-sr"); shielded.fighters[1].shield.amount = 10000;
    stepSkirmish(shielded, 1 / 60, () => 0.99);
    expect(shielded.fighters[0].hp).toBe(5000);
    const overkill = setup("stat-lifesteal-sr"); overkill.fighters[1].hp = 10;
    stepSkirmish(overkill, 1 / 60, () => 0.99);
    expect(overkill.fighters[0].hp - 5000).toBeLessThanOrEqual(1);
  });
  it("궁극기 충전은 퍼센트 배율이 아닌 평타당 게이지로 더한다", () => {
    const state = setup("stat-energy-gain-ssr");
    stepSkirmish(state, 1 / 60, () => 0.99);
    expect(state.fighters[0].energy).toBe(16);
    expect(expeditionAugmentEffectLabel(EXPEDITION_STAT_AUGMENTS.find(def => def.id === "stat-energy-gain-ssr")!)).not.toContain("%");
  });
  it("야성 증가율·이동 속도 배율·치명 확률·치명 피해는 각자의 단위를 지킨다", () => {
    const plain = setup(); const boosted = setup("stat-ferocity-gain-ssr");
    stepSkirmish(plain, 1 / 60, () => 0.99); stepSkirmish(boosted, 1 / 60, () => 0.99);
    expect(boosted.fighters[0].ferocity).toBeCloseTo(plain.fighters[0].ferocity * 1.2);
    expect(setup("stat-move-speed-ssr").fighters[0].def.stats.moveSpeed).toBe(120);
    const critical = setup("stat-crit-chance-ssr");
    expect(stepSkirmish(critical, 1 / 60, () => 0.1).some(event => event.kind === "attack" && event.attackerId === critical.fighters[0].id && event.critical)).toBe(true);
    expect(setup("stat-crit-damage-ssr").fighters[0].def.stats.critDamage).toBe(195);
  });
  it("흡혈 증가 설명도 실제 수치의 태그 팝업으로 연결한다", () => {
    const def = EXPEDITION_STAT_AUGMENTS.find(def => def.id === "stat-lifesteal-ssr")!;
    const keywords = expeditionAugmentKeywords(def);
    expect(keywords[0].description).toContain("7%");
    expect(parseKeywordText(expeditionAugmentEffectLabel(def), keywords).some(segment => segment.keyword?.id === "augment-tag")).toBe(true);
  });
});
