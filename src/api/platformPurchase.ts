import { QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { GameApiError, type GameApi, type FulfillPlatformPurchaseResponse, type ProductDto } from "./contracts";
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
async function requestKey(parts: string[]): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(parts)));
  return [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("").slice(0, 56);
}

/**
 * 결제창 → 영수증 검증 → 지급 확정까지의 한 흐름.
 *
 * 지급은 **서버가 영수증을 검증한 뒤에만** 일어난다 — 어댑터가 성공을 돌려줘도 이 함수가 직접 재화를 쓰지
 * 않는다. 요청 ID를 거래 ID에서 만들므로 앱이 중간에 죽었다 같은 영수증으로 다시 이어 불러도 서버가 같은
 * 결과를 돌려주고, 같은 거래가 두 번 지급되지 않는다.
 */
export async function runPlatformPurchase(api: GameApi, payment: PlatformPaymentAdapter, product: Pick<ProductDto, "id" | "acquisition" | "storefront">): Promise<PlatformPurchaseOutcome> {
  if (product.acquisition.kind !== "platform_payment") return { status: "failed", message: "platform_payment product required" };
  if (payment.supported === false || !globalThis.crypto?.subtle) return { status: "unsupported" };
  let result: FulfillPlatformPurchaseResponse | undefined;
  try {
    // 화면을 연 뒤 서버 설정이 바뀌었어도 실제 과금 전에 최신 지급 가능 여부를 확인한다.
    const catalog = await api.getProducts(product.storefront);
    const current = catalog.products.find(candidate => candidate.id === product.id);
    if (!current?.purchasable || current.acquisition.kind !== "platform_payment"
      || current.acquisition.platformProductId !== product.acquisition.platformProductId) return { status: "unsupported" };
    const confirmation = await confirmPlatformProduct(product.acquisition, payment, async (payload, receipt) => {
      const platform = PLATFORMS.find((candidate) => candidate === receipt.platform);
      if (!platform || platform === "test" && !QA_TOOLS_ENABLED) return { status: "unavailable" };
      // 긴 Google 거래/구매 토큰도 HTTP 멱등 키(64자)를 넘지 않으며 스토어 간 ID 충돌을 피한다.
      const verificationKey = await requestKey([platform, receipt.transactionId, payload]);
      const verified = await api.verifyPurchaseReceipt({ productId: product.id, platform, receipt: payload, requestId: `verify:${verificationKey}` });
      if (verified.verified !== true || verified.productId !== product.id || !verified.verificationId || !verified.transactionId) return { status: "unavailable" };
      const transactionKey = await requestKey([platform, verified.transactionId]);
      result = await api.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: `fulfill:${transactionKey}` });
      return { status: "confirmed", proof: verified.transactionId };
    });
    if (confirmation.status === "cancelled") return { status: "cancelled" };
    if (confirmation.status === "unavailable") return result ? { status: "failed", message: "" } : { status: "unsupported" };
    return result ? { status: "purchased", result } : { status: "failed", message: "" };
  } catch (error) {
    return { status: "failed", message: error instanceof GameApiError ? error.message : "" };
  }
}
