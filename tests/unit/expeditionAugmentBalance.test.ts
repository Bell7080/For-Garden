import { describe, expect, it } from "vitest";
import { EXPEDITION_AUGMENTS } from "../../src/data/expeditionAugments";
import {
  EXPEDITION_AUGMENT_BALANCE, EXPEDITION_AUGMENT_BUDGET_RANGES, MAX_HP_TRUE_DAMAGE_POLICY,
  expeditionAugmentBalanceAudit,
} from "../../src/data/expeditionAugmentBalance";
import { expeditionAugmentEffectLabel } from "../../src/ui/expeditionAugmentBadges";

/** 운영 카탈로그 전체를 순회해 새 행이 검수 장부와 안전 계약을 건너뛰지 못하게 한다. */
describe("원정 증강 밸런스 표", () => {
  it("모든 ID가 유일하고 수치·등급 예산·glyph·설명을 만족한다", () => {
    const ids = EXPEDITION_AUGMENTS.map(({ id }) => id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(EXPEDITION_AUGMENT_BALANCE).sort()).toEqual([...ids].sort());

    for (const augment of EXPEDITION_AUGMENTS) {
      const audit = expeditionAugmentBalanceAudit(augment.id);
      expect(audit, `${augment.id} balance audit`).toBeDefined();
      const range = EXPEDITION_AUGMENT_BUDGET_RANGES[augment.rarity][augment.target];
      expect(audit!.equivalentPercent).toBeGreaterThanOrEqual(range.min);
      expect(audit!.equivalentPercent).toBeLessThanOrEqual(range.max);
      expect(Number.isFinite(audit!.equivalentPercent)).toBe(true);
      expect(["attack", "spell", "survival", "shield", "heal", "status", "conditional"]).toContain(audit!.glyph);
      expect(audit!.rationale.trim().length).toBeGreaterThan(4);
      expect(audit!.sharedMechanic.trim().length).toBeGreaterThan(4);
      expect(expeditionAugmentEffectLabel(augment).trim()).not.toBe("효과");
    }
  });

  it("모든 발동 조건에 횟수·쿨다운·중첩 상한이 명시된다", () => {
    for (const { id, effect } of EXPEDITION_AUGMENTS) {
      if (!("trigger" in effect)) continue;
      expect(effect.limits, `${id} limits`).toBeDefined();
      expect(effect.limits.maxTriggers).toBeGreaterThan(0);
      expect(effect.limits.cooldownSeconds).toBeGreaterThanOrEqual(0);
      expect(effect.limits.maxStacks).toBeGreaterThan(0);
    }
  });

  it("최대 체력 고정 피해는 일반 적과 불사 보스에 각각 유한한 상한을 둔다", () => {
    expect(MAX_HP_TRUE_DAMAGE_POLICY.normalEnemy.maxPercentPerTrigger).toBeLessThanOrEqual(2);
    expect(MAX_HP_TRUE_DAMAGE_POLICY.normalEnemy.maxPercentPerBattle).toBeLessThanOrEqual(10);
    expect(MAX_HP_TRUE_DAMAGE_POLICY.immortalBoss.multiplier).toBeLessThan(1);
    expect(MAX_HP_TRUE_DAMAGE_POLICY.immortalBoss.maxPercentPerBattle).toBeLessThan(MAX_HP_TRUE_DAMAGE_POLICY.normalEnemy.maxPercentPerBattle);
  });
});
