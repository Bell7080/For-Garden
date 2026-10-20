import type { KeywordDef } from "../data/keywords";
import type { Stats } from "../core/types";
import { t } from "../i18n";

type GuardStats = Pick<Stats, "def" | "res">;
/** 비율은 적용 전의 표시 능력치에서 계산한다. 감소율·관통률을 능력치 증가로 바꾸지 않는다. */
export function statGainAlias(stat: "def" | "res", base: number, percent: number): string {
  return `[[stat-bonus-${stat}|+${Math.round(base * percent / 100)}]]`;
}
export function defenseGainKeywords(stats: GuardStats, percent: number): KeywordDef[] {
  return (["def", "res"] as const).map(stat => {
    const base = stats[stat], amount = Math.round(base * percent / 100);
    return { id: `stat-bonus-${stat}`, term: `+${amount}`, kind: "rule",
      description: t("skill.keyword.statGain", { stat: t(stat === "def" ? "skill.stat.def" : "skill.stat.res"), base, percent, amount, total: base + amount }) };
  });
}
export function defenseGainSummary(stats: GuardStats, percent: number): string {
  return `${t("skill.fact.whenActive")} · ${t("skill.stat.def")} ${statGainAlias("def", stats.def, percent)} · ${t("skill.stat.res")} ${statGainAlias("res", stats.res, percent)}`;
}
