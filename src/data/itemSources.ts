import type { GuideRouteId } from "./guideRoutes";

/**
 * 가방 아이템의 「얻는 방법」 — 아이템 안내창(`ItemGuidePopup`)이 효과 아래에 줄마다 세운다.
 *
 * 재화 안내와 **같은 줄 ID**(`guideRoutes.ts`)를 쓴다 — 같은 「마일리지 상점」이 재화 창과 아이템 창에서 다른
 * 문장·다른 바로가기로 서지 않게 한다. 줄이 없는 아이템은 그 칸을 세우지 않는다 — 얻는 길을 정하지 않은
 * 아이템에 빈 칸이나 「없음」을 세우면 찾을 곳을 만들어 낸다. 새 수급처가 붙으면 여기에 한 줄을 더한다.
 */
export const ITEM_SOURCE_ROUTES: Readonly<Record<string, readonly GuideRouteId[]>> = {
  "raid-ticket": ["dungeonDrop", "strataDrop", "mileageShop", "premiumPackage"],
  "raid-select-ticket": ["raidPass"],
  "stamina-tonic": ["levelUp", "attendance", "premiumDaily", "shop", "lootShop", "mileageShop"],
  "stamina-tonic-large": ["shop", "duelShop", "mileageShop"],
  "strata-ticket": ["attendance", "mileageShop", "premiumPackage"],
  "sweep-ticket": ["sweepAd", "premiumPackage"],
  "duel-ticket": ["duelDaily", "duelBuy", "duelAd"],
  "ancient-core": ["archaeology", "archaeologyShop", "lootShop", "mileageShop"],
  "refined-core": ["archaeology", "archaeologyShop", "lootShop", "duelShop"],
  "restoration-crystal": ["archaeology", "archaeologyShop", "lootShop", "duelShop"],
  "universal-fragment-r": ["shopGoldBuy", "mileageShop"],
  "universal-fragment-sr": ["mileageShop"],
};

export function itemSourceRoutes(itemId: string): readonly GuideRouteId[] {
  return ITEM_SOURCE_ROUTES[itemId] ?? [];
}
