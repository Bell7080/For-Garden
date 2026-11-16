import { t } from "../i18n";
import type { ExpeditionAugmentDef } from "./expeditionAugments";

/**
 * 확률·흡혈·치명 배율은 퍼센트 수치에 가산하고, 궁극기 충전·야성 획득은 기본 공격 한 번의 게이지에 깡 수치로 가산한다.
 * 야성은 퍼센트로 세던 때(+12% · +20%)의 기대 가치를 공통값 12 위의 깡 수치로 옮겼다(+1.5 · +2.5).
 */
export const EXPEDITION_FLAT_STAT_PLANS = [
  { id: "lifesteal", stat: "lifeSteal", category: "recovery", sr: 4, ssr: 7 },
  { id: "crit-chance", stat: "critChance", category: "attack", sr: 8, ssr: 14 },
  { id: "crit-damage", stat: "critDamage", category: "attack", sr: 25, ssr: 45 },
  { id: "energy-gain", stat: "energyGain", category: "spell", sr: 2, ssr: 4 },
  { id: "ferocity-gain", stat: "ferocityGain", category: "attack", sr: 1.5, ssr: 2.5 },
] as const;

const STAT_LABELS = { lifeSteal: "stat.lifeSteal", critChance: "stat.critChance", critDamage: "stat.critDamage", energyGain: "stat.energyGain", ferocityGain: "stat.ferocityGain" } as const;

/** 상시 수치도 선택 화면·확정 목록이 실제 전투 입력의 값을 그대로 표시한다. */
export function expeditionStatAugmentLabel(def: ExpeditionAugmentDef, linkLifesteal = false): string | undefined {
  if (def.effect.kind !== "flatStat") return undefined;
  const effect = def.effect;
  const name = t(STAT_LABELS[effect.stat]);
  const label = linkLifesteal && effect.stat === "lifeSteal" ? `[[augment-tag|${name}]]` : name;
  return effect.stat === "energyGain" || effect.stat === "ferocityGain" ? t("augment.flatPoints", { label, points: effect.points }) : t("augment.percent", { label, percent: effect.points });
}

export const EXPEDITION_STAT_AUGMENTS: readonly ExpeditionAugmentDef[] = [
  ...EXPEDITION_FLAT_STAT_PLANS.flatMap(plan => (["sr", "ssr"] as const).map(rarity => {
    const def: ExpeditionAugmentDef = {
      id: `stat-${plan.id}-${rarity}`, get name() { return expeditionStatAugmentLabel(def)!; }, rarity, target: "relic", category: plan.category,
      maxStacks: 1, stacking: { mode: "strongest" }, exclusiveGroup: `stat-${plan.id}`,
      tags: [plan.category, "relic", "stat", plan.stat], effect: { kind: "flatStat", stat: plan.stat, points: plan[rarity] },
    };
    return def;
  })),
  ...(["sr", "ssr"] as const).map(rarity => ({
    id: `stat-move-speed-${rarity}`, get name() { return t("augment.percent", { label: t("stat.moveSpeed"), percent: rarity === "sr" ? 12 : 20 }); },
    rarity, target: "relic" as const, category: "survival" as const, maxStacks: 1, stacking: { mode: "strongest" as const },
    exclusiveGroup: "stat-move-speed", tags: ["survival", "relic", "stat", "moveSpeedPercent"],
    effect: { kind: "moveSpeedPercent" as const, percent: rarity === "sr" ? 12 : 20 },
  })),
];
