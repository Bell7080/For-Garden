/** 플랫폼이 발급하고 실제 서버만 검증해야 하는 영수증의 전송 계약이다. */
export interface PlatformReceipt { platform: string; productId: string; transactionId: string; payload: string; }

/**
 * 사용자가 닫은 결제창은 오류나 성공 영수증으로 위장하지 않는다.
 *
 * `unsupported`는 결제 SDK가 없는 빌드(웹 단독·E2E)다. 성공을 흉내 내지 않고 이 값을 돌려주며
 * (계정 API가 `unsupported`를 돌려주는 것과 같은 규칙), 화면은 그 사실만 알린다.
 */
export type PlatformPaymentResult =
  | { status: "completed"; receipt: PlatformReceipt }
  | { status: "cancelled" }
  | { status: "unsupported" };

/** 앱스토어/플레이스토어 SDK를 UI와 게임 서버에서 격리하는 결제 어댑터 경계다. */
export interface PlatformPaymentAdapter {
  /**
   * 스토어 상품 ID(`platformProductId`)로 결제창을 연다. 성공 영수증을 반환해도 지급은 서버 검증 뒤에만 가능하다.
   * SDK를 붙일 때는 이 메서드 하나만 구현하면 된다.
   */
  requestPayment(platformProductId: string): Promise<PlatformPaymentResult>;
}

/** 결제 SDK가 없는 빌드의 기본 구현이다. 결제를 시작하지 않고 `unsupported`만 돌려준다. */
export class UnsupportedPlatformPaymentAdapter implements PlatformPaymentAdapter {
  async requestPayment(_platformProductId: string): Promise<PlatformPaymentResult> {
    return { status: "unsupported" };
  }
}
