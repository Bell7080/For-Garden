import type { ProductDto } from "../api/contracts";
import type { PremiumCategory } from "../data/products";

/** 프리미엄 화면이 자기 storefront 상품만 보존하는 순수 표시 모델이다. */
export function premiumModel(products: readonly ProductDto[]): ProductDto[] {
  // 서버가 잘못 합친 응답도 상점·무역 카드가 프리미엄에 새지 않도록 거른다.
  return products.filter((product) => product.storefront === "premium");
}

/**
 * 그 상품이 어느 라벨 아래 서는가.
 *
 * **갈래를 적지 않은 상품은 패키지로 본다.** 카탈로그에 새 상품을 넣으면서 갈래를 빠뜨려도
 * 목록에서 사라지지 않게 하려는 것이다 — 사라진 상품은 화면 어디에도 없어 빠뜨린 것을
 * 알아챌 방법이 없다.
 */
export function premiumCategoryOf(product: ProductDto): PremiumCategory {
  return product.premiumCategory ?? "package";
}

/** 라벨은 storefront 검증을 통과한 상품 중 그 갈래만 새 배열로 반환한다. */
export function productsForPremiumCategory(products: readonly ProductDto[], category: PremiumCategory): ProductDto[] {
  return premiumModel(products).filter((product) => premiumCategoryOf(product) === category);
}
