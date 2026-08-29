import { formatCurrency } from "../core/formatCurrency";
import type { BattleContributionRow, ContributionCategory } from "../core/battleContribution";
import { COLOR } from "./theme";

/** 전투 HUD와 종료 팝업이 공유하는 탭 순서와 플레이어 문구다. */
export const CONTRIBUTION_CATEGORIES: readonly { id: ContributionCategory; label: string }[] = [
  { id: "attack", label: "공격" }, { id: "defense", label: "방어" }, { id: "healing", label: "회복" },
];

/** Phaser 객체와 무관한 한 행의 표시값이라 두 UI가 막대 산식과 축약 수치를 복제하지 않는다. */
export interface ContributionRenderRow { source: BattleContributionRow; value: string; fill: number }

/** 분류별 색과 최고 행 100% 규칙을 한 경계에서 계산한다. */
export function contributionRenderModel(category: ContributionCategory, rows: readonly BattleContributionRow[]): {
  color: number; rows: ContributionRenderRow[];
} {
  const max = Math.max(0, ...rows.map((row) => row.total));
  const color = category === "attack" ? COLOR.sortie : category === "defense" ? COLOR.contributionDefense : COLOR.hpFill;
  return { color, rows: rows.map((source) => ({ source, value: formatCurrency(source.total), fill: max > 0 ? source.total / max : 0 })) };
}
