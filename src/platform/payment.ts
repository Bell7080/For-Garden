import { UnsupportedPlatformPaymentAdapter, type PlatformPaymentAdapter, type PlatformPaymentResult } from "../api/PlatformPayment";

/** 네이티브 셸이 주입하는 최소 결제 SDK 계약이다. 웹 단독 빌드는 성공을 가장하지 않는다. */
interface PaymentBridge { requestPayment(platformProductId: string): Promise<PlatformPaymentResult>; }

declare global {
  interface Window { __PF_PAYMENT__?: PaymentBridge; }
}

/**
 * 지금 빌드의 결제 어댑터.
 *
 * 앱스토어·플레이스토어 SDK를 붙이는 자리는 여기 하나다 — 셸이 `window.__PF_PAYMENT__`를 주입하면
 * 그 브리지로 결제창이 열리고, 없으면 `unsupported`를 돌려준다. 씬은 SDK도 전역도 모른다.
 */
export function platformPayment(): PlatformPaymentAdapter {
  const bridge = typeof window === "undefined" ? undefined : window.__PF_PAYMENT__;
  return bridge ?? new UnsupportedPlatformPaymentAdapter();
}
