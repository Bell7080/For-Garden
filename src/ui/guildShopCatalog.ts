import type { ProductDto } from "../api/contracts";
import type { GuildShopState } from "../api/guildContracts";
import { GUILD_SHOP_PRODUCTS } from "../core/guild";
import { findItem } from "../data/items";
import type { ProductGrant } from "../data/products";
import { t, type TextKey } from "../i18n";

/**
 * 길드 상점을 **일반 상점과 같은 전시대**에 세우기 위한 상품 줄.
 *
 * 길드 상품은 값이 지갑이 아니라 길드원 행의 코인이라 서버의 상품 표(`getProducts`)를 지나지 않는다 —
 * 상품 정의는 `GUILD_SHOP_PRODUCTS` 한 표, 산 횟수·길드 레벨은 `guildApi.getShop`이 갖는다. 화면이 두 갈래를 그리지
 * 않도록 여기서 같은 `ProductDto` 모양으로 옮기고, 구매는 여전히 `gameApi.buyGuildProduct`가 확정한다.
 * 길드 레벨이 아직 닿지 않은 칸은 지우지 않고 「길드 Lv.N 개방」으로 선다 — 무엇이 열릴지 보여야 레벨을 올릴 이유가 된다.
 */
export function guildShopProducts(shop: GuildShopState): ProductDto[] {
  return GUILD_SHOP_PRODUCTS.map((product) => {
    const bought = shop.items.find((item) => item.productId === product.id)?.bought ?? 0;
    const remaining = Math.max(0, product.limit - bought);
    const locked = product.minGuildLevel !== undefined && (shop.guildLevel ?? 1) < product.minGuildLevel;
    return {
      id: product.id, storefront: "guild", category: product.tab, iconKey: product.grant.rune ? "shop-product-rune" : "shop-product-supplies",
      name: t(`guild.shop.product.${product.id}` as TextKey), description: "",
      acquisition: { kind: "guild_coin", amount: product.price }, grants: guildProductGrants(product.grant), defaultQuantity: 1,
      purchaseLimit: product.limit, refresh: product.refresh, remaining,
      purchasable: remaining > 0 && !locked,
      ...(locked ? { disabledReason: t("guild.shop.levelLock", { level: product.minGuildLevel! }) } : {}),
    };
  });
}

/** 길드 상품이 주는 것을 상점·영수증이 읽는 공용 지급 줄로 옮긴다. 그림은 첫 지급품에서 나온다. */
export function guildProductGrants(grant: (typeof GUILD_SHOP_PRODUCTS)[number]["grant"]): ProductGrant[] {
  const grants: ProductGrant[] = [];
  if (grant.rune) grants.push({ kind: "rune", name: t("guild.shop.product.guild-rune-rare"), amount: 1, rarity: grant.rune });
  if (grant.fossil) grants.push({ kind: "currency", currency: "fossil", amount: grant.fossil });
  if (grant.gold) grants.push({ kind: "currency", currency: "gold", amount: grant.gold });
  if (grant.cheesecake) grants.push({ kind: "currency", currency: "cheesecake", amount: grant.cheesecake });
  if (grant.item) grants.push({ kind: "item", itemId: grant.item.id, name: findItem(grant.item.id)?.name ?? grant.item.id, amount: grant.item.quantity });
  return grants;
}
