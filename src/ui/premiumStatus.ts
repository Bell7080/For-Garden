import type { ProductDto } from "../api/contracts";

/** 상품 카드에 붙는 상태 딱지의 종류. 키는 문구 표(`shop.premium.sticker.*`)와 같다. */
export type PremiumStatus = "purchased" | "claimed" | "subscribed" | "soldOut";

/**
 * 이 상품에 붙일 상태 딱지. 구매 제한이 남아 있으면 완료 딱지를 붙이지 않는다.
 *
 * - 이용 중인 구독 → 「구독 중」(살 수 없지만 소진이 아니다)
 * - 무료 수령을 마쳤다 → 「수령 완료」
 * - 한 번 사면 다시 열리지 않는 상품(패스·계정당 1회) → 「구매 완료」
 * - 주기마다 돌아오는 상품의 오늘 몫을 다 썼다 → 「매진」
 */
export function premiumStatusOf(product: Pick<ProductDto, "purchasable" | "remaining" | "subscription" | "acquisition" | "refresh">): PremiumStatus | undefined {
  if (product.subscription !== undefined) return "subscribed";
  // 결제 검증자 부재 등으로 구매가 막혀도, 구매 횟수를 소진한 것은 아니다.
  if (product.purchasable || product.remaining > 0) return undefined;
  if (product.acquisition.kind === "free") return "claimed";
  return product.refresh === "none" || product.refresh === "once" ? "purchased" : "soldOut";
}
