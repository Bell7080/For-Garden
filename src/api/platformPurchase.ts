import type { GameApi, FulfillPlatformPurchaseResponse, ProductDto } from "./contracts";
import type { PlatformPaymentAdapter } from "./PlatformPayment";
import { confirmPlatformProduct } from "../core/productConfirmation";

/** 결제 한 번의 끝. 화면은 이 네 가지만 안다. */
export type PlatformPurchaseOutcome =
  | { status: "purchased"; result: FulfillPlatformPurchaseResponse }
  | { status: "cancelled" }
  /** 결제 SDK가 없는 빌드. 성공을 흉내 내지 않는다. */
  | { status: "unsupported" }
  | { status: "failed"; message: string };

const PLATFORMS = ["apple", "google", "test"] as const;

/**
 * 결제창 → 영수증 검증 → 지급 확정까지의 한 흐름.
 *
 * 지급은 **서버가 영수증을 검증한 뒤에만** 일어난다 — 어댑터가 성공을 돌려줘도 이 함수가 직접 재화를 쓰지
 * 않는다. 요청 ID를 거래 ID에서 만들므로 앱이 중간에 죽었다 같은 영수증으로 다시 이어 불러도 서버가 같은
 * 결과를 돌려주고, 같은 거래가 두 번 지급되지 않는다.
 */
export async function runPlatformPurchase(api: GameApi, payment: PlatformPaymentAdapter, product: Pick<ProductDto, "id" | "acquisition">): Promise<PlatformPurchaseOutcome> {
  if (product.acquisition.kind !== "platform_payment") return { status: "failed", message: "platform_payment product required" };
  let result: FulfillPlatformPurchaseResponse | undefined;
  try {
    const confirmation = await confirmPlatformProduct(product.acquisition, payment, async (payload, receipt) => {
      const platform = PLATFORMS.find((candidate) => candidate === receipt.platform);
      if (!platform) return { status: "unavailable" };
      const verified = await api.verifyPurchaseReceipt({ productId: product.id, platform, receipt: payload, requestId: `verify:${receipt.transactionId}` });
      result = await api.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: `fulfill:${receipt.transactionId}` });
      return { status: "confirmed", proof: verified.transactionId };
    });
    if (confirmation.status === "cancelled") return { status: "cancelled" };
    if (confirmation.status === "unavailable") return result ? { status: "failed", message: "" } : { status: "unsupported" };
    return result ? { status: "purchased", result } : { status: "failed", message: "" };
  } catch (error) {
    return { status: "failed", message: error instanceof Error ? error.message : "" };
  }
}
