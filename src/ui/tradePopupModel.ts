import type { ProductDto } from "../api/contracts";
import type { ProductCurrency } from "../data/products";
import { tradePackageLimitLabel, tradePackageValuePercent } from "../data/tradePackages";

/** 무역 UI가 서버 응답을 다시 방어해 trade storefront 상품만 보존한다. */
export function tradePopupModel(products: readonly ProductDto[]): ProductDto[] {
  // 새 배열을 반환해 원본 API 스냅샷을 화면 정렬이나 갱신으로 변경하지 않는다.
  return products.filter((product) => product.storefront === "trade");
}

/** 카드 한 장이 그리는 것. 재화 키만 들고 있어 그림·글꼴은 화면이 고른다. */
export interface TradePackageAmount { currency: ProductCurrency; amount: number }

/**
 * 패키지 한 장의 표시 계약.
 *
 * **카드가 직접 값을 계산하지 않는다.** 가치 %는 시세표가, 제한 문구는 갱신 주기 표가 만든다 —
 * 카드는 받은 글자를 자리에 놓기만 해야 구매 확인판과 같은 말이 선다.
 */
export interface TradePackageView {
  id: string;
  name: string;
  /** 같은 젬으로 따로 사는 것 대비 몇 %인가. 환산할 수 없는 상품은 비운다. */
  valueLabel?: string;
  cost?: TradePackageAmount;
  grants: readonly TradePackageAmount[];
  limitLabel: string;
  /** 남은 횟수가 없거나 서버가 막은 상품. 카드는 눌리지 않고 눌러 둔 채로 남는다. */
  soldOut: boolean;
  disabledReason?: string;
}

/** 서버 상품을 카드가 그대로 그릴 수 있는 표시 계약으로 바꾼다. */
export function tradePackageViews(products: readonly ProductDto[]): TradePackageView[] {
  return tradePopupModel(products).map((product) => {
    const percent = tradePackageValuePercent(product.acquisition, product.grants);
    return {
      id: product.id,
      name: product.name,
      valueLabel: percent === undefined ? undefined : `가치 ${percent}%`,
      cost: product.acquisition.kind === "currency" ? { currency: product.acquisition.currency, amount: product.acquisition.amount } : undefined,
      // 재화가 아닌 지급품(룬·장식)은 아직 이 전시장에 없다. 생기면 액자 그림만 늘린다.
      grants: product.grants.flatMap((grant) => grant.kind === "currency" ? [{ currency: grant.currency, amount: grant.amount }] : []),
      limitLabel: tradePackageLimitLabel(product.refresh, product.purchaseLimit, product.remaining),
      soldOut: !product.purchasable || product.remaining <= 0,
      disabledReason: product.disabledReason,
    };
  });
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
