/** 플랫폼이 발급하고 실제 서버만 검증해야 하는 영수증의 전송 계약이다. */
export interface PlatformReceipt { platform: string; productId: string; transactionId: string; payload: string; }

/** 앱스토어/플레이스토어 SDK를 UI와 게임 서버에서 격리하는 결제 어댑터 경계다. */
export interface PlatformPaymentAdapter {
  /** 성공 영수증을 반환해도 지급은 서버 검증 뒤에만 가능하다. */
  requestPayment(productId: string): Promise<PlatformReceipt>;
}

/** 영수증 검증 서버가 없는 프로토타입에서는 결제를 시작하지 않는 기본 구현이다. */
export class DisabledPlatformPaymentAdapter implements PlatformPaymentAdapter {
  async requestPayment(_productId: string): Promise<PlatformReceipt> {
    throw new Error("플랫폼 결제와 서버 영수증 검증이 아직 연결되지 않았습니다.");
  }
}
