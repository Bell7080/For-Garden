import type Phaser from "phaser";
import { t } from "../i18n";
import { ARENA_TIERS, ARENA_WEEKLY_RANK_GEMS, arenaTierId } from "../core/arenaStanding";
import { rankBands, rankTitle } from "./CompetitiveRewardPopup";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { openRewardTable } from "./RewardTable";

/**
 * 아레나 주간 보상 — 판마다 주는 것이 없고, 주간 마감 때의 **티어 보상**과 **순위 보너스**가 한 통의 우편으로 온다.
 * 두 표를 한 창에 섹션으로 나눠 세운다(값은 `arenaStanding.ts` 한 곳). 내 티어·내 순위 구간이 「현재」로 선다.
 */
export function openArenaWeeklyRewards(scene: Phaser.Scene, popups: PopupLayer, score: number | null, rank: number | null): void {
  const myTier = score === null ? null : arenaTierId(score);
  const ranks = rankBands(ARENA_WEEKLY_RANK_GEMS).filter((band) => band.gems > 0);
  openRewardTable(scene, popups, {
    title: t("arena.weekly.title"),
    rules: t("rewardTable.rules.arena"),
    compact: true,
    sections: [
      {
        title: t("arena.weekly.tierSection"),
        rows: [...ARENA_TIERS].reverse().map((tier) => ({
          badge: { kind: "tier", tier: tier.id },
          title: t(`duel.tier.${tier.id}`),
          sub: t("arena.weekly.floor", { score: tier.floor.toLocaleString() }),
          rewards: [
            { texture: CURRENCY_ICON_BY_WALLET.duelEmblem, amount: tier.weeklyReward.duelEmblem },
            { texture: CURRENCY_ICON_BY_WALLET.gems, amount: tier.weeklyReward.gems },
          ],
          current: tier.id === myTier,
        })),
      },
      {
        title: t("arena.weekly.rankSection"),
        rows: ranks.map((band) => ({
          badge: { kind: "rank", from: band.from, upTo: band.upTo },
          title: rankTitle(band),
          rewards: [{ texture: CURRENCY_ICON_BY_WALLET.gems, amount: band.gems }],
          current: rank !== null && rank >= band.from && (band.upTo === null || rank <= band.upTo),
        })),
      },
    ],
  });
}
