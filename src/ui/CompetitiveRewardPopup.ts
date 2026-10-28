import type Phaser from "phaser";
import { t } from "../i18n";
import { WEEKLY_RANK_GEMS, type RankRewardBundle, type RankRewardPool } from "../data/competitiveRewards";
import { EXPEDITION_WEEKLY_RANK_POOL } from "../data/expedition";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { openRewardTable, type RewardTableRow } from "./RewardTable";
import { rankRewardLabel, type RankRewardPeriod } from "./RankingChips";

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
 * 결투장·원정의 주간 순위 보상표. 원정은 표준 보상 풀(1,000위 밖 백분율 구간 + 젬·인양 기록·골드·치즈케이크)이라
 * `openRankPoolRewards`가 그린다. `myRank`를 주면 그 구간이 「현재」로 선다.
 */
export function openCompetitiveRewards(scene: Phaser.Scene, popups: PopupLayer, board: "duel" | "expedition", myRank?: number | null): void {
  if (board === "expedition") {
    openRankPoolRewards(scene, popups, { pool: EXPEDITION_WEEKLY_RANK_POOL, period: "weekly", rules: t("rewardTable.rules.expedition"), myRank });
    return;
  }
  const rows: RewardTableRow[] = rankBands(WEEKLY_RANK_GEMS).map((band) => ({
    badge: { kind: "rank", from: band.from, upTo: band.upTo },
    title: rankTitle(band),
    rewards: [{ texture: CURRENCY_ICON_BY_WALLET.gems, amount: band.gems }],
    current: inBand(myRank, band),
  }));
  openRewardTable(scene, popups, { title: rankRewardLabel("weekly"), rules: t("rewardTable.rules.duel"), sections: [{ rows }] });
}

/** 보상 액자의 차례 — 무거운 것부터 오른쪽 끝에 선다. */
const BUNDLE_ORDER = ["gems", "salvageRecord", "gold", "cheesecake"] as const;

/**
 * 표준 순위 보상 풀(`RankRewardPool`) 한 장 — 원정 주간·고대 지층 월간이 같은 창을 쓴다.
 * 순위 구간 → 「상위 N%」 구간 → 참여 보상 순으로 서고, 1,000위 밖의 내 구간은 참가자 수(`total`)를 알 때만 「현재」로 선다.
 */
export function openRankPoolRewards(scene: Phaser.Scene, popups: PopupLayer, spec: {
  pool: RankRewardPool; period: RankRewardPeriod; rules: string; myRank?: number | null; total?: number | null;
  /** 창 제목 — 비우면 기간의 보상 칩 이름(「주간 보상」)이다. 수호전 일일 표처럼 기간 밖의 표가 쓴다. */
  title?: string;
  /** 재화 그림을 바꿔 그린다 — 젬 칸에 길드 코인을 담는 표(`GUILD_GUARD_DAILY_RANK_COINS`)가 쓴다. */
  textures?: Partial<Record<(typeof BUNDLE_ORDER)[number], string>>;
}): void {
  const { pool, myRank, total } = spec;
  const bundle = (rewards: RankRewardBundle) => BUNDLE_ORDER.filter((key) => (rewards[key] ?? 0) > 0)
    .map((key) => ({ texture: spec.textures?.[key] ?? CURRENCY_ICON_BY_WALLET[key], amount: rewards[key] ?? 0 }));
  const lastRank = pool.ranks.at(-1)?.upTo ?? 0;
  const mine = typeof myRank === "number" && myRank > lastRank && typeof total === "number" && total > 0 ? myRank / total * 100 : null;
  const percentRow = mine === null ? -1 : pool.percents.findIndex((row) => mine <= row.upToPercent);
  const rows: RewardTableRow[] = [
    ...rankBands(pool.ranks).map((band) => ({
      badge: { kind: "rank" as const, from: band.from, upTo: band.upTo },
      title: rankTitle(band),
      rewards: bundle(band.rewards),
      current: inBand(myRank, band),
    })),
    ...pool.percents.map((row, index) => ({
      badge: { kind: "percent" as const, upToPercent: row.upToPercent },
      title: t("rewardTable.rank.percent", { percent: row.upToPercent }),
      sub: t("rewardTable.rank.beyond", { rank: (lastRank + 1).toLocaleString() }),
      rewards: bundle(row.rewards),
      current: index === percentRow,
    })),
    {
      badge: { kind: "participation" },
      title: t("rewardTable.rank.participation"),
      rewards: bundle(pool.participation),
      current: mine !== null && percentRow === -1,
    },
  ];
  openRewardTable(scene, popups, { title: spec.title ?? rankRewardLabel(spec.period), rules: spec.rules, compact: true, sections: [{ rows }] });
}

/** 줄 이름 — 1위 · 2~3위 · 101위 이하. */
export function rankTitle(band: { from: number; upTo: number | null }): string {
  if (band.upTo === null) return t("rewardTable.rank.beyond", { rank: band.from });
  if (band.upTo === band.from) return t("rewardTable.rank.single", { rank: band.from });
  return t("rewardTable.rank.range", { from: band.from, upTo: band.upTo });
}
