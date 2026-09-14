import type { ProductDto } from "../api/contracts";
import type { ProductStorefront, ShopCategory } from "../data/products";

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
export function productsForShopCategory(products: readonly ProductDto[], category: ShopCategory, storefront: ProductStorefront = "shop"): ProductDto[] {
  return shopModel(products, storefront).filter((product) => product.category === category);
}
