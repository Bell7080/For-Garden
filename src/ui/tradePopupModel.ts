import type { ProductDto } from "../api/contracts";

/** 무역 UI가 서버 응답을 다시 방어해 trade storefront 상품만 보존한다. */
export function tradePopupModel(products: readonly ProductDto[]): ProductDto[] {
  // 새 배열을 반환해 원본 API 스냅샷을 화면 정렬이나 갱신으로 변경하지 않는다.
  return products.filter((product) => product.storefront === "trade");
}

/** 조회 실패 화면이 chrome과 분리된 동적 영역에 그릴 최소 표시 계약이다. */
export const TRADE_POPUP_FAILURE_MODEL = {
  // 세계관 안의 짧은 상태와 실제 입력만 남기고 네트워크 구현 설명은 노출하지 않는다.
  status: "교신 두절",
  retryLabel: "재접속",
  clearsDynamicContent: true,
  preservesChrome: true,
  actions: ["retry", "close"] as const,
};

/** 연타가 같은 카탈로그 요청을 겹쳐 보내지 않게 하는 Phaser 비의존 요청 문지기다. */
export class TradePopupRequestGate {
  private activeGeneration?: number;

  /** 요청이 없을 때만 이 세대를 점유한다. */
  begin(generation: number): boolean {
    if (this.activeGeneration !== undefined) return false;
    this.activeGeneration = generation;
    return true;
  }

  /** 늦은 이전 요청의 finally가 새 요청의 잠금을 풀지 못하게 같은 세대만 해제한다. */
  finish(generation: number): void {
    if (this.activeGeneration === generation) this.activeGeneration = undefined;
  }

  /** 팝업 종료 시 진행 중 세대의 입력 잠금도 함께 폐기한다. */
  reset(): void { this.activeGeneration = undefined; }
}
