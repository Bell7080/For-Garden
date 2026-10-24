import type Phaser from "phaser";
import { t } from "../i18n";
import { DUEL_TIERS, DUEL_SEASON_DAYS, type DuelTierId } from "../core/duelArena";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { PopupLayer } from "./PopupLayer";
import { openRewardTable } from "./RewardTable";
import { COLOR } from "./theme";

/**
 * 티어 안내 — 여덟 티어의 시작 점수, 가려지는 칸, 시즌 보상. 지금 티어 줄이 「현재」로 선다.
 *
 * 값은 전부 `DUEL_TIERS` 한 표에서 읽는다. 화면이 수를 따로 적지 않는다. 양식은 주간 보상표와 같은 한 장이다(`RewardTable`).
 */
export function openDuelTierGuide(scene: Phaser.Scene, popups: PopupLayer, current: DuelTierId): void {
  openRewardTable(scene, popups, {
    title: t("duel.link.tiers"),
    rules: t("duel.season.rules", { days: DUEL_SEASON_DAYS }),
    sections: [{
      rows: DUEL_TIERS.map((tier) => ({
        badge: { kind: "tier", tier: tier.id },
        title: t(`duel.tier.${tier.id}`),
        sub: `${t("duel.tierGuide.floor", { score: tier.floor.toLocaleString() })} · ${tier.blind > 0 ? t("duel.tierGuide.blind", { count: tier.blind }) : t("duel.tierGuide.noBlind")}`,
        subColor: tier.blind > 0 ? COLOR.dangerText : undefined,
        rewards: [
          { texture: CURRENCY_ICON_BY_WALLET.duelEmblem, amount: tier.seasonReward.duelEmblem },
          { texture: CURRENCY_ICON_BY_WALLET.gems, amount: tier.seasonReward.gems },
        ],
        current: tier.id === current,
      })),
    }],
  });
}
