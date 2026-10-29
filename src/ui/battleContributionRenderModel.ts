import { formatCurrency } from "../core/formatCurrency";
import { t } from "../i18n";
import type { BattleContributionRow, ContributionCategory } from "../core/battleContribution";
import { COLOR } from "./theme";
import type { GlyphName } from "./glyphs";

/** 전투 HUD와 종료 팝업이 공유하는 탭 순서다. */
export const CONTRIBUTION_CATEGORIES: readonly ContributionCategory[] = ["attack", "defense", "healing"];

/** 탭의 이름. 표에 넣으면 모듈을 읽는 순간 굳어 언어를 따라오지 않는다. */
export function contributionCategoryLabel(category: ContributionCategory): string {
  return t(`contribution.${category === "healing" ? "heal" : category}`);
}

/** 탭마다 서는 아이콘 — 공격은 칼, 방어는 방패, 회복은 십자. 글자를 읽기 전에 그림이 무엇을 여는지 말한다. */
export const CONTRIBUTION_ICON: Readonly<Record<ContributionCategory, GlyphName>> = {
  attack: "contrib-attack",
  defense: "contrib-defense",
  healing: "contrib-heal",
};

/** 켜진 탭의 글자색 — 분류 색을 한 단계 밝힌 값이라 어두운 판 위에서 읽힌다. */
export const CONTRIBUTION_TEXT: Readonly<Record<ContributionCategory, string>> = {
  attack: "#f2936c",
  defense: "#a9c4dc",
  healing: "#9fe3ab",
};

/** 분류의 색 — 막대·탭 강조선·아이콘이 같은 색을 쓴다. */
export function contributionCategoryColor(category: ContributionCategory): number {
  return category === "attack" ? COLOR.sortie : category === "defense" ? COLOR.contributionDefense : COLOR.hpFill;
}

/** Phaser 객체와 무관한 한 행의 표시값이라 두 UI가 막대 산식과 축약 수치를 복제하지 않는다. */
export interface ContributionRenderRow { source: BattleContributionRow; value: string; fill: number }

/** 분류별 색과 최고 행 100% 규칙을 한 경계에서 계산한다. */
export function contributionRenderModel(category: ContributionCategory, rows: readonly BattleContributionRow[]): {
  color: number; rows: ContributionRenderRow[];
} {
  const max = Math.max(0, ...rows.map((row) => row.total));
  const color = contributionCategoryColor(category);
  return { color, rows: rows.map((source) => ({ source, value: formatCurrency(source.total), fill: max > 0 ? source.total / max : 0 })) };
}
