import { defenseGainKeywords } from "./statGainKeywords";
import type { RelicDef, Skill, Stats } from "../core/types";
import type { KeywordDef } from "../data/keywords";
import { deriveSummonStats } from "../core/summonStats";
import { previewSkillDamage } from "../core/damage";
import { t } from "../i18n";
import { canPreviewSkillDamage, damageKeyword, ferocityTraitDescription, passiveDescription, skillDescription } from "./skillPresentation";

/** 보유·적·친구·미보유 미리보기가 같은 전투 정의와 성장 근거로 소환수를 설명한다. */
export function buildSummonKeywords(owner: RelicDef, ownerStats: Readonly<Stats> = owner.stats): KeywordDef[] {
  return (owner.summons ?? []).map(summon => {
    const { def, growthStat, resummon } = summon;
    const stats = deriveSummonStats(ownerStats, summon);
    const attacker = { def: { ...def, stats }, hp: stats.hp, maxHp: stats.hp, energy: 0, ferocity: 0, bondLevel: 0, ferocityFever: false, breakthrough: 0 };
    const described = (skill: Skill) => {
      const preview = canPreviewSkillDamage(skill) ? previewSkillDamage(attacker, skill) : undefined;
      const detail = damageKeyword(preview);
      return { text: skillDescription(skill, { ap: stats.ap, atk: { atk: stats.atk, attackSpeed: stats.attackSpeed },
        maxHp: stats.hp, resistance: stats.res, damage: preview?.kind === "scaling" ? preview.amount : undefined }), contextualKeywords: detail ? [detail] : [] };
    };
    const basis = t(growthStat === "atk" ? "skill.stat.atk" : "skill.stat.ap");
    const formula = (stat: "hp" | "atk" | "def" | "res", amount: number) =>
      `${t(stat === "atk" ? growthStat === "atk" ? "skill.stat.atk" : "skill.stat.ap" : stat === "hp" ? "skill.stat.hp" : stat === "def" ? "skill.stat.def" : "skill.stat.res")} ${amount} (${Math.round(summon.scaling[stat] * 100)}%)`;
    return {
      id: `summon-${def.id}`, term: def.name, kind: "summon",
      description: t("skill.keyword.summon.description", { owner: owner.name, stat: basis,
        resummon: resummon.enabled ? t("skill.keyword.summon.resummon", { seconds: resummon.cooldownSeconds, percent: resummon.hpPercent }) : "" }),
      sections: [
        { label: t("info.summon.growth"), name: basis,
          text: `${t("info.summon.growthSource", { owner: owner.name, stat: basis })} ${ownerStats[growthStat]}\n${formula("hp", stats.hp)}\n${formula("atk", growthStat === "atk" ? stats.atk : stats.ap)}\n${formula("def", stats.def)} · ${formula("res", stats.res)}` },
        { label: t("info.skill.passive"), name: def.passive.name, text: passiveDescription(def.passive, stats.atk, { defense: stats.def, resistance: stats.res }) },
        { label: t("info.skill.basic"), name: def.basic.name, ...described(def.basic) },
        { label: t("info.skill.ultimate"), name: def.ultimate.name, ...described(def.ultimate) },
        { label: t("info.skill.ferocity"), name: def.ferocityTrait.name,
          contextualKeywords: "defenseResistancePercent" in def.ferocityTrait ? defenseGainKeywords(stats, def.ferocityTrait.defenseResistancePercent) : [],
          text: ferocityTraitDescription(def.ferocityTrait, { attack: stats.atk, defense: stats.def, maxHp: stats.hp, abilityPower: stats.ap, resistance: stats.res }) },
      ],
    };
  });
}
