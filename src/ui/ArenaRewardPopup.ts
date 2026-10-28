import type Phaser from "phaser";
import { t } from "../i18n";
import { ARENA_TIERS, ARENA_WEEKLY_RANK_GEMS, arenaTierId } from "../core/arenaStanding";
import { rankBands, rankTitle } from "./CompetitiveRewardPopup";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { openRewardTable } from "./RewardTable";

/**
 * 아레나 보상 표 둘 — 주간 마감 때의 **티어 보상**과 **순위 보너스**가 한 통의 우편으로 오지만, 결투장처럼
 * 표는 갈라 세운다(순위표 창의 「주간 보상」 칩 → 순위 보너스, 「티어」 버튼 → 티어 보상). 한 창에 두 섹션을
 * 쌓던 때는 어느 칩을 눌러도 같은 긴 표가 떠 무엇이 순위 몫이고 무엇이 티어 몫인지 한 번 더 찾아야 했다.
 * 값은 `arenaStanding.ts` 한 곳이고, 내 티어·내 순위 구간이 「현재」로 선다.
 */
export function openArenaTierRewards(scene: Phaser.Scene, popups: PopupLayer, score: number | null): void {
  const myTier = score === null ? null : arenaTierId(score);
  openRewardTable(scene, popups, {
    title: t("arena.weekly.tierSection"),
    rules: t("rewardTable.rules.arena"),
    compact: true,
    sections: [{
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
    }],
  });
}

export function openArenaWeeklyRewards(scene: Phaser.Scene, popups: PopupLayer, rank: number | null): void {
  const ranks = rankBands(ARENA_WEEKLY_RANK_GEMS).filter((band) => band.gems > 0);
  openRewardTable(scene, popups, {
    title: t("arena.weekly.title"),
    rules: t("rewardTable.rules.arena"),
    compact: true,
    sections: [{
      title: t("arena.weekly.rankSection"),
      rows: ranks.map((band) => ({
        badge: { kind: "rank", from: band.from, upTo: band.upTo },
        title: rankTitle(band),
        rewards: [{ texture: CURRENCY_ICON_BY_WALLET.gems, amount: band.gems }],
        current: rank !== null && rank >= band.from && (band.upTo === null || rank <= band.upTo),
      })),
    }],
  });
}
