import type { ProductDto } from "../api/contracts";

/** 상품 카드에 붙는 상태 딱지의 종류. 키는 문구 표(`shop.premium.sticker.*`)와 같다. */
export type PremiumStatus = "purchased" | "claimed" | "subscribed" | "soldOut";

/**
 * 이 상품에 붙일 상태 딱지. 살 수 있으면 없다.
 *
 * - 이용 중인 구독 → 「구독 중」(살 수 없지만 소진이 아니다)
 * - 무료 수령을 마쳤다 → 「수령 완료」
 * - 한 번 사면 다시 열리지 않는 상품(패스·계정당 1회) → 「구매 완료」
 * - 주기마다 돌아오는 상품의 오늘 몫을 다 썼다 → 「매진」
 */
export function premiumStatusOf(product: Pick<ProductDto, "purchasable" | "subscription" | "acquisition" | "refresh">): PremiumStatus | undefined {
  if (product.subscription !== undefined) return "subscribed";
  if (product.purchasable) return undefined;
  if (product.acquisition.kind === "free") return "claimed";
  return product.refresh === "none" || product.refresh === "once" ? "purchased" : "soldOut";
}
