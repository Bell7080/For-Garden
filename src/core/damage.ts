import { elementMultiplier } from "./element";
import { ferocityDamageBonus } from "./ferocity";
import { breakthroughBonus } from "./relicProgression";
import type { Skill } from "./types";
import type { Combatant, DamageInput } from "./combatTypes";

/** 정보창이 확정 피해와 대상 없는 능력치 배율을 구분하는 미리보기 결과다. */
export type DamagePreview =
  | { kind: "damage"; amount: number; label: "예상 피해" }
  | { kind: "scaling"; amount: number; power: number; stat: "공격력" | "주문력" | "방어력"; label: "피해량" };

/** 주입된 0 이상 1 미만 판정값으로 치명타 여부를 결정한다. */
export function isCriticalHit(critChance: number, roll: number): boolean {
  if (roll < 0 || roll >= 1) throw new RangeError("critical roll은 0 이상 1 미만이어야 합니다.");
  return roll < critChance / 100;
}

/** 표시·회복·마법 피해가 전투 중 누적분을 정확히 한 번 더하도록 현재 주문력을 확정한다. */
export function currentAbilityPower(combatant: Combatant): number {
  return combatant.def.stats.ap + (combatant.bonusAp ?? 0);
}

/** 방어·저항·속성·대상 패시브 전, 공격자가 스킬과 버프로 만들어 낸 순수 공격 기여값이다. */
export function computeDamageContribution(attacker: Combatant, input: DamageInput): number {
  const offense = input.scalingStat === "def" ? attacker.def.stats.def
    : input.scalingStat === "atk" ? attacker.def.stats.atk
      : input.scalingStat === "ap" ? currentAbilityPower(attacker)
        : input.damageType === "physical" ? attacker.def.stats.atk : currentAbilityPower(attacker);
  const critical = input.isCritical ? attacker.def.stats.critDamage / 100 : 1;
  const opened = breakthroughBonus(attacker.breakthrough);
  const awakened = 1 + (input.kind === "ultimate" ? opened.ultimateDamage : input.kind === "basic" ? opened.basicDamage : 0);
  // 타격별 반올림은 같은 총 계수의 다단히트를 더 크게 만들므로 기여도에는 소수 정밀도를 보존한다.
  return Math.max(0, (offense * input.power / 100) * critical * awakened * (1 + ferocityDamageBonus(attacker.ferocity)));
}

/** 실시간 난전의 공격력, 방어, 치명타, 각성, 야성, 속성 순서를 고정한 피해 공식이다. */
export function computeDamage(attacker: Combatant, target: Combatant, input: DamageInput, targetIsFront: boolean): number {
  // 방어형 탱커의 공격은 방어력을 직접 피해 원천으로 쓸 수 있다.
  const offense = input.scalingStat === "def" ? attacker.def.stats.def
    : input.scalingStat === "atk" ? attacker.def.stats.atk
      : input.scalingStat === "ap" ? currentAbilityPower(attacker)
        : input.damageType === "physical" ? attacker.def.stats.atk : currentAbilityPower(attacker);
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
  // 순수 회복기는 피해 미리보기 경계에 들어올 수 없으며 호출부가 healing 계약을 표시해야 한다.
  if (!("damageType" in skill) || skill.damageType === undefined || skill.power === undefined) {
    throw new TypeError("비공격 스킬은 피해를 미리 볼 수 없습니다.");
  }
  if (!target) {
    const stat = skill.scalingStat === "def" ? "방어력" : skill.scalingStat === "atk" || skill.damageType === "physical" ? "공격력" : "주문력";
    const base = skill.scalingStat === "def" ? attacker.def.stats.def : skill.scalingStat === "atk" || skill.damageType === "physical" ? attacker.def.stats.atk : attacker.def.stats.ap;
    return { kind: "scaling", amount: Math.round(base * skill.power / 100), power: skill.power, stat, label: "피해량" };
  }
  return { kind: "damage", amount: computeDamage(attacker, target, { ...skill, isCritical: false }, targetIsFront), label: "예상 피해" };
}
