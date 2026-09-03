import type { PlatformPaymentAdapter } from "../api/PlatformPayment";
import type { ProductAcquisition } from "../data/products";
import { presentRewardedAd } from "../platform/rewardedAds";

/** 외부 획득의 완료·취소·중복·한도 결과를 화면과 무관한 고정 상태로 제한한다. */
export type ProductConfirmation =
  | { status: "confirmed"; proof: string }
  | { status: "cancelled" }
  | { status: "duplicate" }
  | { status: "daily_limit" }
  | { status: "unavailable" };

/** 플랫폼 상품은 반드시 PlatformPayment 어댑터가 발급한 영수증만 확정 콜백에 전달한다. */
export async function confirmPlatformProduct(acquisition: Extract<ProductAcquisition, { kind: "platform_payment" }>, payment: PlatformPaymentAdapter, confirmReceipt: (payload: string) => Promise<ProductConfirmation>): Promise<ProductConfirmation> {
  const paymentResult = await payment.requestPayment(acquisition.platformProductId);
  if (paymentResult.status === "cancelled") return { status: "cancelled" };
  return confirmReceipt(paymentResult.receipt.payload);
}

/** 광고 상품은 rewardedAds 모듈의 완료 토큰 외에는 서버 확정 콜백에 전달하지 않는다. */
export async function confirmRewardedAdProduct(acquisition: Extract<ProductAcquisition, { kind: "rewarded_ad" }>, confirmToken: (token: string) => Promise<ProductConfirmation>): Promise<ProductConfirmation> {
  const presentation = await presentRewardedAd(acquisition.slotId);
  if (presentation.status === "dismissed") return { status: "cancelled" };
  if (presentation.status !== "completed") return { status: "unavailable" };
  return confirmToken(presentation.verificationToken);
}
