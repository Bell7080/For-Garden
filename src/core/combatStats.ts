import { expeditionAugmentStatMultipliers, flatStatPoints, type ExpeditionAugmentEffect, type FlatStatKind } from "./expeditionAugments";
import { isBreakthroughSlotOpen } from "./relicProgression";
import type { RuneInstance } from "./runes";
import { resolveRuneTraitStacking } from "./runeTraitEffects";
import type { RelicDef, Stats } from "./types";

/**
 * 성장된 최종 능력치 위에 **전투가 시작될 때 얹히는 상시 몫**을 더한다.
 *
 * 원정 증강·룬 특성 중 상시 능력치(배율 · 깡 수치)와 렉시아의 패시브 돌파(체력·방어·저항 +25%)가 여기 든다.
 * 전투(`makeFighter`)와 표시 전투력이 **이 함수 하나**를 지나므로 둘이 갈리지 않는다 — 한때 전투만 이 몫을
 * 곱하고 화면의 전투력은 그 앞에서 멈춰, 원정 후반 아군이 실제보다 15% 안팎 낮게 읽혔다.
 * 조건부 효과(저체력 공격력·적중 시 막 등)는 상시 값이 아니라 여기 들지 않는다.
 */
export function applyBattleStatBonuses(
  def: Pick<RelicDef, "id" | "breakthroughEffects">,
  stats: Stats,
  breakthrough: number,
  effects: readonly ExpeditionAugmentEffect[],
): Stats {
  const multipliers = expeditionAugmentStatMultipliers(effects, def.id);
  const flatPoints = (stat: FlatStatKind): number => flatStatPoints(effects, def.id, stat);
  const passiveBreakthrough = isBreakthroughSlotOpen(breakthrough, "passive")
    && def.breakthroughEffects?.passive?.kind === "battleMaidAscension" ? def.breakthroughEffects.passive : undefined;
  const durability = 1 + (passiveBreakthrough?.durabilityPercent ?? 0) / 100;
  return {
    ...stats,
    hp: stats.hp * multipliers.maxHpPercent * durability,
    def: stats.def * multipliers.defensePercent * durability,
    res: stats.res * multipliers.resistancePercent * durability,
    atk: stats.atk * multipliers.attackPowerPercent,
    ap: stats.ap * multipliers.spellPowerPercent,
    attackSpeed: stats.attackSpeed * multipliers.attackSpeedPercent,
    moveSpeed: stats.moveSpeed * multipliers.moveSpeedPercent,
    // 아래는 이미 퍼센트로 세는 수치라 덧셈으로 붙는다. 곱셈 배율과 섞으면 같은 「+10」이 능력치마다 다른 크기가 된다.
    critDamage: stats.critDamage + flatPoints("critDamage"),
    lifeSteal: stats.lifeSteal + flatPoints("lifeSteal"),
    critChance: stats.critChance + flatPoints("critChance"),
    energyGain: stats.energyGain + flatPoints("energyGain"),
    ferocityGain: stats.ferocityGain + flatPoints("ferocityGain"),
  };
}

/** 낀 룬의 특성이 만드는 전투 효과 — 전투 입력(`partyRuneTraitEffects`)과 같은 중첩 규칙이다. */
export function relicRuneTraitEffects(relicId: string, runes: readonly RuneInstance[]): ExpeditionAugmentEffect[] {
  return resolveRuneTraitStacking(runes.flatMap((rune) => rune.trait === undefined ? [] : [rune.trait]), relicId).effects;
}

/**
 * 표시용 「싸우는 능력치」 — 최종 능력치에 돌파·룬 특성·(원정이면) 증강의 상시 몫을 얹는다.
 * 전투력·오각형이 읽는 값이고, 전투 입력에는 넘기지 않는다(전투는 `makeFighter`가 같은 함수로 얹는다).
 */
export function displayCombatStats(
  def: Pick<RelicDef, "id" | "breakthroughEffects">,
  finalStats: Stats,
  breakthrough: number,
  runes: readonly RuneInstance[],
  augments: readonly ExpeditionAugmentEffect[] = [],
): Stats {
  return applyBattleStatBonuses(def, finalStats, breakthrough, [...relicRuneTraitEffects(def.id, runes), ...augments]);
}
