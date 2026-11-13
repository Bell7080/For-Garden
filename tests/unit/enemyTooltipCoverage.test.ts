import { describe, expect, it } from "vitest";
import { RELICS, getRelic } from "../../src/data/relics";
import { BREAKTHROUGH_CAP, BREAKTHROUGH_STEPS, breakthroughEnhances, isBreakthroughSlotOpen } from "../../src/core/relicProgression";
import { breakthroughEffectKeywords, breakthroughEffectText, passiveDescription, skillDescription } from "../../src/ui/skillPresentation";
import { formatBreakthroughDescription, formatEffectDescription } from "../../src/ui/skillExplanation";

describe("전체 개체의 돌파·기본 스킬 설명", () => {
  it("아모의 보호막 현재 수치는 자신 기준임을 아군 보호막과 구분한다", () => {
    const def = getRelic("amo");
    const text = breakthroughEffectText(def, "passive", { ...def.stats, hp: 1000 });
    expect(text).toContain("자신: [[v-shield-hp-16-1000|160]]");
    expect(text).toContain("해당 아군 최대 체력의 11%");
  });

  it("명시적으로 효과가 없는 슬롯도 등급에 관계없이 강화 표시를 만들지 않는다", () => {
    const def = { breakthroughEffects: { basic: { kind: "none" as const } } };
    for (let level = 0; level <= BREAKTHROUGH_CAP; level++) {
      expect(breakthroughEnhances(def, level, "basic")).toBe(false);
      expect(breakthroughEnhances(def, level, "ultimate")).toBe(false);
    }
  });

  it.each(RELICS)("$id: 돌파 효과 유무와 강화 표시가 모든 등급에서 일치한다", def => {
    for (const { slot } of BREAKTHROUGH_STEPS) {
      const effect = def.breakthroughEffects?.[slot];
      const hasEffect = effect !== undefined && effect.kind !== "none";
      for (let level = 0; level <= BREAKTHROUGH_CAP; level++) {
        expect(breakthroughEnhances(def, level, slot), `${def.id} ${slot} ${level}`)
          .toBe(hasEffect && isBreakthroughSlotOpen(level, slot));
      }
      const text = breakthroughEffectText(def, slot, def.stats);
      if (effect === undefined) expect(text).toBeUndefined();
      else if (effect.kind === "none") expect(text).toBe("없음");
      else expect(text).toBeTruthy();
      if (text) {
        expect(formatBreakthroughDescription(text)).not.toMatch(/NaN|undefined|\{\w+[!:]?[^}]*\}|skill\.breakthrough\./);
        for (const keyword of breakthroughEffectKeywords(def, slot, def.stats)) {
          expect(keyword.description).not.toMatch(/NaN|undefined|\{\w+[!:]?[^}]*\}/);
        }
      }
    }
  });

  it.each(RELICS.filter(def => def.enemyOnly || def.summonOnly))("$id: 돌파가 없어도 기본 스킬·패시브 설명이 정상이다", def => {
    const texts = [skillDescription(def.basic), skillDescription(def.ultimate), passiveDescription(def.passive)];
    for (const text of texts) {
      expect(text).toBeTruthy();
      expect(formatEffectDescription(text)).not.toMatch(/NaN|undefined|\{\w+[!:]?[^}]*\}|^skill\./);
    }
  });
});
