import type { ProductDto } from "../api/contracts";

/** 일반 상점 UI가 자기 storefront 상품만 보존하는 순수 표시 모델이다. */
export function shopModel(products: readonly ProductDto[]): ProductDto[] {
  // 서버가 잘못 합친 응답도 premium·trade 카드가 일반 상점에 새지 않도록 거른다.
  return products.filter((product) => product.storefront === "shop");
}
