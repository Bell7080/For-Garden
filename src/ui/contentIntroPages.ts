import type { IconIntroId } from "../core/tutorial";
import type { TextKey } from "../i18n";
import { ROLE_ICON } from "./affinityIcons";
import { CURRENCY_ICON_BY_WALLET } from "./currencyIcons";
import type { IconIntroPage } from "./IconIntroPopup";

/**
 * 콘텐츠마다 첫 방문에 넘겨 보는 아이콘 쪽지의 쪽들.
 *
 * 쪽마다 그 콘텐츠에서 실제로 쓰거나 받는 것의 그림을 세운다 — 그림이 곧 「여기서 무엇을 얻는가」를 먼저 말한다.
 * 문장은 `intro.<콘텐츠>.<쪽>.heading/body` 키가 갖고, 쪽 수만큼 키를 늘린다.
 */
const W = CURRENCY_ICON_BY_WALLET;

function pages(id: IconIntroId, icons: readonly string[]): readonly IconIntroPage[] {
  return icons.map((icon, index) => ({
    icon,
    headingKey: `intro.${id}.${index + 1}.heading` as TextKey,
    bodyKey: `intro.${id}.${index + 1}.body` as TextKey,
  }));
}

export const CONTENT_INTRO_PAGES: Readonly<Record<IconIntroId, readonly IconIntroPage[]>> = {
  stageMap: pages("stageMap", [ROLE_ICON.warrior, W.gems]),
  party: pages("party", [ROLE_ICON.tank, ROLE_ICON.assassin]),
  shop: pages("shop", [W.cheesecake, W.gold]),
  cakeOperation: pages("cakeOperation", [W.cheesecake, "item-sweep-ticket"]),
  bounty: pages("bounty", [ROLE_ICON.assassin, W.gold]),
  interaction: pages("interaction", [ROLE_ICON.support, W.gold]),
  duel: pages("duel", [ROLE_ICON.tank, "item-duel-ticket"]),
  friends: pages("friends", [ROLE_ICON.support, "item-raid-ticket"]),
  raid: pages("raid", [W.raidSigil, "item-raid-ticket"]),
  expedition: pages("expedition", [W.salvageRecord, ROLE_ICON.warrior, W.gems]),
  premium: pages("premium", [W.gems, "item-stamina-tonic"]),
};
