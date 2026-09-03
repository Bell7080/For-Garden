import type { ProductDto } from "../api/contracts";

/** 무역 UI가 서버 응답을 다시 방어해 trade storefront 상품만 보존한다. */
export function tradePopupModel(products: readonly ProductDto[]): ProductDto[] {
  // 새 배열을 반환해 원본 API 스냅샷을 화면 정렬이나 갱신으로 변경하지 않는다.
  return products.filter((product) => product.storefront === "trade");
}
