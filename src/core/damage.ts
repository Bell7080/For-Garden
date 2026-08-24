import { elementMultiplier } from "./element";
import { ferocityDamageBonus } from "./ferocity";
import { breakthroughBonus } from "./relicProgression";
import type { Skill } from "./types";
import type { Combatant, DamageInput } from "./combatTypes";

/** 정보창이 확정 피해와 대상 없는 능력치 배율을 구분하는 미리보기 결과다. */
export type DamagePreview =
  | { kind: "damage"; amount: number; label: "예상 피해" }
  | { kind: "scaling"; power: number; stat: "공격력" | "주문력"; label: "기준 배율" };

/** 주입된 0 이상 1 미만 판정값으로 치명타 여부를 결정한다. */
export function isCriticalHit(critChance: number, roll: number): boolean {
  if (roll < 0 || roll >= 1) throw new RangeError("critical roll은 0 이상 1 미만이어야 합니다.");
  return roll < critChance / 100;
}

/** 실시간 난전의 공격력, 방어, 치명타, 각성, 야성, 속성 순서를 고정한 피해 공식이다. */
export function computeDamage(attacker: Combatant, target: Combatant, input: DamageInput, targetIsFront: boolean): number {
  const offense = input.damageType === "physical" ? attacker.def.stats.atk : attacker.def.stats.ap;
  const defense = input.damageType === "physical" ? target.def.stats.def : target.def.stats.res;
  const critical = input.isCritical ? attacker.def.stats.critDamage / 100 : 1;
  const opened = breakthroughBonus(attacker.breakthrough);
  const awakened = 1 + (input.kind === "ultimate" ? opened.ultimateDamage : input.kind === "basic" ? opened.basicDamage : 0);
  const raw = ((offense * input.power) / 100) * critical * awakened * (1 + ferocityDamageBonus(attacker.ferocity));
  const afterDefense = (raw * 100) / (100 + defense);
  const guard = targetIsFront && target.def.passive.kind === "frontGuard" ? 1 - target.def.passive.value / 100 : 1;
  return Math.max(1, Math.round(afterDefense * guard * elementMultiplier(attacker.def.element, target.def.element)));
}

/** 대상이 있으면 실제 방어를 적용하고, 없으면 도감에 표시할 스탯 배율만 반환한다. */
export function previewSkillDamage(attacker: Combatant, skill: Skill, target?: Combatant, targetIsFront = false): DamagePreview {
  if (!target) return { kind: "scaling", power: skill.power, stat: skill.damageType === "physical" ? "공격력" : "주문력", label: "기준 배율" };
  return { kind: "damage", amount: computeDamage(attacker, target, { ...skill, isCritical: false }, targetIsFront), label: "예상 피해" };
}
