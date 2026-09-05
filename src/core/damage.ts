import { elementMultiplier } from "./element";
import { ferocityDamageBonus } from "./ferocity";
import { breakthroughBonus } from "./relicProgression";
import type { Skill } from "./types";
import type { Combatant, DamageInput } from "./combatTypes";

/** 미리보기와 태그가 함께 읽는 능력치 이름이다. */
export type ScalingStatLabel = "공격력" | "주문력" | "방어력" | "체력";

/** 정보창이 확정 피해와 대상 없는 능력치 배율을 구분하는 미리보기 결과다. */
export type DamagePreview =
  | { kind: "damage"; amount: number; label: "예상 피해" }
  | {
      kind: "scaling";
      amount: number;
      power: number;
      stat: ScalingStatLabel;
      /** 위력을 두 능력치가 나눠 갖는 스킬만 갖는 여벌 축이다. 태그 문장이 두 축을 함께 말한다. */
      secondary?: { power: number; stat: ScalingStatLabel };
      label: "피해량";
    };

/** 주입된 0 이상 1 미만 판정값으로 치명타 여부를 결정한다. */
export function isCriticalHit(critChance: number, roll: number): boolean {
  if (roll < 0 || roll >= 1) throw new RangeError("critical roll은 0 이상 1 미만이어야 합니다.");
  return roll < critChance / 100;
}

/** 표시·회복·마법 피해가 전투 중 누적분을 정확히 한 번 더하도록 현재 주문력을 확정한다. */
export function currentAbilityPower(combatant: Combatant): number {
  return combatant.def.stats.ap + (combatant.bonusAp ?? 0);
}

/** 스킬이 고른 능력치 하나를 읽는다. 고르지 않았으면 피해 종류가 정한다. */
function scalingStatValue(attacker: Combatant, stat: DamageInput["scalingStat"], damageType: DamageInput["damageType"]): number {
  if (stat === "def") return attacker.def.stats.def;
  // 최대 체력에서 뽑는 개체는 공격력을 아예 쓰지 않는다. 현재 체력이 아니라 **최대** 체력이라
  // 아플 때 갑자기 약해지지 않는다 — 앞에 서서 맞는 개체의 피해가 맞을수록 줄면 성질이 거꾸로다.
  if (stat === "hp") return attacker.def.stats.hp;
  if (stat === "atk") return attacker.def.stats.atk;
  if (stat === "ap") return currentAbilityPower(attacker);
  return damageType === "physical" ? attacker.def.stats.atk : currentAbilityPower(attacker);
}

/**
 * 위력을 실제 능력치 값으로 바꾼다.
 *
 * 두 능력치가 위력을 나눠 갖는 스킬은 각각에서 뽑아 더한다 — 치명타·각성·야성은 그렇게 합친
 * 뒤에 한 번만 곱해야 두 축이 같은 한 방으로 읽힌다.
 */
function offenseValue(attacker: Combatant, input: DamageInput): number {
  const primary = scalingStatValue(attacker, input.scalingStat, input.damageType) * input.power / 100;
  if (!input.secondaryScaling) return primary;
  return primary + scalingStatValue(attacker, input.secondaryScaling.stat, input.damageType) * input.secondaryScaling.power / 100;
}

/** 방어·저항·속성·대상 패시브 전, 공격자가 스킬과 버프로 만들어 낸 순수 공격 기여값이다. */
export function computeDamageContribution(attacker: Combatant, input: DamageInput): number {
  const critical = input.isCritical ? attacker.def.stats.critDamage / 100 : 1;
  const opened = breakthroughBonus(attacker.breakthrough);
  const awakened = 1 + (input.kind === "ultimate" ? opened.ultimateDamage : input.kind === "basic" ? opened.basicDamage : 0);
  // 타격별 반올림은 같은 총 계수의 다단히트를 더 크게 만들므로 기여도에는 소수 정밀도를 보존한다.
  return Math.max(0, offenseValue(attacker, input) * critical * awakened * (1 + ferocityDamageBonus(attacker.ferocity)));
}

/** 실시간 난전의 공격력, 방어, 치명타, 각성, 야성, 속성 순서를 고정한 피해 공식이다. */
export function computeDamage(attacker: Combatant, target: Combatant, input: DamageInput, targetIsFront: boolean): number {
  // 고정 피해는 방어·저항을 0으로 두고 지나간다. 속성 상성과 대상 경감은 그대로 거친다.
  const defense = input.ignoresDefense ? 0 : input.damageType === "physical" ? target.def.stats.def : target.def.stats.res;
  const critical = input.isCritical ? attacker.def.stats.critDamage / 100 : 1;
  const opened = breakthroughBonus(attacker.breakthrough);
  const awakened = 1 + (input.kind === "ultimate" ? opened.ultimateDamage : input.kind === "basic" ? opened.basicDamage : 0);
  const raw = offenseValue(attacker, input) * critical * awakened * (1 + ferocityDamageBonus(attacker.ferocity));
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
    const label = (stat: DamageInput["scalingStat"]): ScalingStatLabel =>
      stat === "def" ? "방어력" : stat === "hp" ? "체력"
        : stat === "atk" || (stat === undefined && skill.damageType === "physical") ? "공격력" : "주문력";
    const base = (stat: DamageInput["scalingStat"]): number =>
      stat === "def" ? attacker.def.stats.def : stat === "hp" ? attacker.def.stats.hp
        : label(stat) === "공격력" ? attacker.def.stats.atk : attacker.def.stats.ap;
    const primary = base(skill.scalingStat) * skill.power / 100;
    const secondary = skill.secondaryScaling;
    return {
      kind: "scaling",
      // 두 축이 나눠 가진 위력은 합친 값이 곧 이 스킬의 피해라, 라벨도 그 합을 보여 준다.
      amount: Math.round(primary + (secondary ? base(secondary.stat) * secondary.power / 100 : 0)),
      power: skill.power,
      stat: label(skill.scalingStat),
      secondary: secondary && { power: secondary.power, stat: label(secondary.stat) },
      label: "피해량",
    };
  }
  return { kind: "damage", amount: computeDamage(attacker, target, { ...skill, isCritical: false }, targetIsFront), label: "예상 피해" };
}
