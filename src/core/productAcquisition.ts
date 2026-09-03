import type { ProductAcquisition, ProductCurrency } from "../data/products";

/** 씬이 조건 문구를 복제하지 않도록 획득 방식만으로 완성하는 행동 표시 모델이다. */
export interface ProductActionModel { label: string; disabledReason?: string; priceText: string; quantityEnabled: boolean; }

/** 서버 제한과 진행 상태를 함께 받아 모든 상품 카드·팝업의 단일 문구 원천이 된다. */
export function productActionModel(acquisition: ProductAcquisition, options: { remaining: number; pending?: boolean; available?: boolean } = { remaining: 1 }): ProductActionModel {
  if (options.pending) return { label: "처리 중…", disabledReason: "이미 처리 중입니다.", priceText: acquisitionText(acquisition), quantityEnabled: false };
  if (options.remaining <= 0) return { label: actionLabel(acquisition), disabledReason: acquisition.kind === "rewarded_ad" ? "UTC 일일 제한에 도달했습니다." : "수령 제한에 도달했습니다.", priceText: acquisitionText(acquisition), quantityEnabled: false };
  if (options.available === false) return { label: actionLabel(acquisition), disabledReason: acquisition.kind === "rewarded_ad" ? "광고를 이용할 수 없습니다." : acquisition.kind === "platform_payment" ? "플랫폼 결제를 이용할 수 없습니다." : "지금 수령할 수 없습니다.", priceText: acquisitionText(acquisition), quantityEnabled: false };
  return { label: actionLabel(acquisition), priceText: acquisitionText(acquisition), quantityEnabled: acquisition.kind === "currency" };
}

/** 방식별 동사는 화면 종류와 무관하게 동일하다. */
function actionLabel(acquisition: ProductAcquisition): string {
  return ({ currency: "교환", platform_payment: "구매", free: "무료 수령", rewarded_ad: "광고 보고 받기" } as const)[acquisition.kind];
}

/** 무료를 0으로 표시하지 않고 외부 결제 가격도 카탈로그가 제공한 문자열만 사용한다. */
function acquisitionText(acquisition: ProductAcquisition): string {
  if (acquisition.kind === "free") return "무료";
  if (acquisition.kind === "rewarded_ad") return `광고 · 일 ${acquisition.dailyLimitUtc}회`;
  if (acquisition.kind === "platform_payment") return acquisition.displayPrice;
  return `${acquisition.amount.toLocaleString()} ${currencyName(acquisition.currency)}`;
}

/** 지갑 키의 사용자 표시명을 한 곳에 고정한다. */
function currencyName(currency: ProductCurrency): string {
  return ({ fossil: "화석", amber: "호박석", cheesecake: "치즈케이크", dnaFragments: "DNA 조각" } as const)[currency];
}
