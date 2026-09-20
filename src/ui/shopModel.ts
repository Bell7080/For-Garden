import type { ProductDto } from "../api/contracts";
import type { ProductStorefront } from "../data/products";

/**
 * 상점 UI가 **지금 보고 있는 자리**의 상품만 보존하는 순수 표시 모델이다.
 *
 * 자리를 인자로 받는 이유는 같은 화면이 일반 상점과 고고학 상점을 함께 맡기 때문이다 —
 * 화면이 filter를 다시 쓰면 같은 규칙이 두 곳에 살아, 한쪽만 고쳐도 나머지는 조용히 예전
 * 규칙으로 남는다.
 */
export function shopModel(products: readonly ProductDto[], storefront: ProductStorefront = "shop"): ProductDto[] {
  // 서버가 잘못 합친 응답도 다른 자리의 카드가 이 목록에 새지 않도록 거른다.
  return products.filter((product) => product.storefront === storefront);
}

/** 하단 탭은 storefront 검증을 통과한 상품 중 선택 분류만 새 배열로 반환한다. */
/**
 * 지금 열린 탭의 상품만 고른다.
 *
 * **어느 필드가 갈래인지는 자리가 정한다** — 일반·고고학은 상품 계약의 `category`(일반·강화·
 * 룬)를 읽고, 전리품 상점은 `lootCategory`(토벌·인양)를 읽는다. 한 필드로 합치지 않는 이유는
 * 두 축이 서로 다른 것을 가리키기 때문이다: 하나는 **무엇을 사나**이고 하나는 **무엇으로
 * 사나**다. 프리미엄이 `premiumCategory`를 따로 둔 것과 같은 갈림이다.
 */
export function productsForShopTab(products: readonly ProductDto[], tab: string, storefront: ProductStorefront = "shop"): ProductDto[] {
  const scoped = shopModel(products, storefront);
  if (storefront === "loot") return scoped.filter((product) => product.lootCategory === tab);
  return scoped.filter((product) => product.category === tab);
}

