import type { ProductDto, PurchaseProductResponse } from "../api/contracts";

/** Phaser와 무관하게 팝업의 중복 열기와 요청 잠금을 판정하는 정적 상태다. */
export interface TradePopupState {
  open: boolean;
  pendingProductId?: string;
  products: ProductDto[];
}

/** 새 로비 방문에서 사용하는 닫힌 초기 상태를 만든다. */
export function initialTradePopupState(): TradePopupState {
  return { open: false, products: [] };
}

/** 이미 열린 팝업은 그대로 돌려줘 레이어와 입력 차단막이 중복 생성되지 않게 한다. */
export function openTradePopup(state: TradePopupState): TradePopupState {
  return state.open ? state : { ...state, open: true };
}

/** 닫을 때 진행 표시까지 폐기해 다음 열기의 입력을 복구한다. */
export function closeTradePopup(state: TradePopupState): TradePopupState {
  return { ...state, open: false, pendingProductId: undefined };
}

/** 공용 카탈로그 중 로비 무역 경계에 속한 행만 보존한다. */
export function loadTradeProducts(state: TradePopupState, products: readonly ProductDto[]): TradePopupState {
  return { ...state, products: products.filter((product) => product.storefront === "trade") };
}

/** 구매가 진행 중이면 후속 탭을 무시하고 최초 상품 ID를 유지한다. */
export function beginTradePurchase(state: TradePopupState, productId: string): TradePopupState {
  return state.pendingProductId ? state : { ...state, pendingProductId: productId };
}

/** 서버가 확정한 남은 횟수만 카탈로그에 병합하며 지갑이나 보상을 계산하지 않는다. */
export function finishTradePurchase(state: TradePopupState, result: PurchaseProductResponse): TradePopupState {
  return {
    ...state,
    pendingProductId: undefined,
    products: state.products.map((product) => product.id === result.productId
      ? { ...product, remaining: result.remaining, purchasable: result.remaining > 0 }
      : product),
  };
}
