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
 * 상품 정의는 `GUILD_SHOP_PRODUCTS` 한 표, 산 횟수는 `guildApi.getShop`이 갖는다. 화면이 두 갈래를 그리지
 * 않도록 여기서 같은 `ProductDto` 모양으로 옮기고, 구매는 여전히 `gameApi.buyGuildProduct`가 확정한다.
 */
export function guildShopProducts(shop: GuildShopState): ProductDto[] {
  return GUILD_SHOP_PRODUCTS.map((product) => {
    const bought = shop.items.find((item) => item.productId === product.id)?.bought ?? 0;
    const remaining = Math.max(0, product.weeklyLimit - bought);
    const grants: ProductGrant[] = [];
    if (product.grant.gold) grants.push({ kind: "currency", currency: "gold", amount: product.grant.gold });
    if (product.grant.cheesecake) grants.push({ kind: "currency", currency: "cheesecake", amount: product.grant.cheesecake });
    if (product.grant.item) {
      const item = product.grant.item;
      grants.push({ kind: "item", itemId: item.id, name: findItem(item.id)?.name ?? item.id, amount: item.quantity });
    }
    return {
      id: product.id, storefront: "guild", category: "weekly", iconKey: "shop-product-supplies",
      name: t(`guild.shop.product.${product.id}` as TextKey), description: "",
      acquisition: { kind: "guild_coin", amount: product.price }, grants, defaultQuantity: 1,
      purchaseLimit: product.weeklyLimit, refresh: "weekly", remaining,
      purchasable: remaining > 0,
    };
  });
}
