import type { ProductDto } from "../api/contracts";
import type { ShopCategory } from "../data/products";

/** 일반 상점 UI가 자기 storefront 상품만 보존하는 순수 표시 모델이다. */
export function shopModel(products: readonly ProductDto[]): ProductDto[] {
  // 서버가 잘못 합친 응답도 premium·trade 카드가 일반 상점에 새지 않도록 거른다.
  return products.filter((product) => product.storefront === "shop");
}

/** 하단 탭은 storefront 검증을 통과한 상품 중 선택 분류만 새 배열로 반환한다. */
export function productsForShopCategory(products: readonly ProductDto[], category: ShopCategory): ProductDto[] {
  return shopModel(products).filter((product) => product.category === category);
}
