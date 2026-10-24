import type Phaser from "phaser";
import { t } from "../i18n";
import { WEEKLY_RANK_GEMS } from "../data/competitiveRewards";
import { EXPEDITION_WEEKLY_RANK_REWARDS } from "../data/expedition";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { openRewardTable, type RewardTableRow } from "./RewardTable";

/** 주간 순위 보상 구간의 시작·끝 등수를 차례로 푼다. */
export function rankBands<T extends { upTo: number | null }>(rows: readonly T[]): (T & { from: number })[] {
  let from = 1;
  return rows.map((row) => {
    const band = { ...row, from };
    from = (row.upTo ?? from) + 1;
    return band;
  });
}

const inBand = (rank: number | null | undefined, band: { from: number; upTo: number | null }): boolean =>
  typeof rank === "number" && rank >= band.from && (band.upTo === null || rank <= band.upTo);

/**
 * 결투장·원정의 주간 순위 보상표. 원정은 젬과 함께 인양 기록도 받으므로 그 액자가 함께 선다 —
 * 젬만 적던 때는 원정 순위표가 실제 우편보다 적게 말했다. `myRank`를 주면 그 구간이 「현재」로 선다.
 */
export function openCompetitiveRewards(scene: Phaser.Scene, popups: PopupLayer, board: "duel" | "expedition", myRank?: number | null): void {
  const rows: RewardTableRow[] = board === "expedition"
    ? rankBands(EXPEDITION_WEEKLY_RANK_REWARDS).map((band) => ({
      badge: { kind: "rank", from: band.from, upTo: band.upTo },
      title: rankTitle(band),
      rewards: [
        { texture: CURRENCY_ICON_BY_WALLET.gems, amount: band.rewards.gems ?? 0 },
        { texture: CURRENCY_ICON_BY_WALLET.salvageRecord, amount: band.rewards.salvageRecord ?? 0 },
      ],
      current: inBand(myRank, band),
    }))
    : rankBands(WEEKLY_RANK_GEMS).map((band) => ({
      badge: { kind: "rank", from: band.from, upTo: band.upTo },
      title: rankTitle(band),
      rewards: [{ texture: CURRENCY_ICON_BY_WALLET.gems, amount: band.gems }],
      current: inBand(myRank, band),
    }));
  openRewardTable(scene, popups, { title: t("expedition.weeklyReward"), rules: t(board === "expedition" ? "rewardTable.rules.expedition" : "rewardTable.rules.duel"), sections: [{ rows }] });
}

/** 줄 이름 — 1위 · 2~3위 · 101위 이하. */
export function rankTitle(band: { from: number; upTo: number | null }): string {
  if (band.upTo === null) return t("rewardTable.rank.beyond", { rank: band.from });
  if (band.upTo === band.from) return t("rewardTable.rank.single", { rank: band.from });
  return t("rewardTable.rank.range", { from: band.from, upTo: band.upTo });
}
