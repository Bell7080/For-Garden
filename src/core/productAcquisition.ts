import type { ProductAcquisition, ProductCurrency } from "../data/products";
import { t } from "../i18n";

/** 씬이 조건 문구를 복제하지 않도록 획득 방식만으로 완성하는 행동 표시 모델이다. */
export interface ProductActionModel { label: string; disabledReason?: string; priceText: string; quantityEnabled: boolean; }

/** 서버 제한과 진행 상태를 함께 받아 모든 상품 카드·팝업의 단일 문구 원천이 된다. */
export function productActionModel(acquisition: ProductAcquisition, options: { remaining: number; pending?: boolean; available?: boolean } = { remaining: 1 }): ProductActionModel {
  if (options.pending) return { label: t("product.pending"), disabledReason: t("product.pending.reason"), priceText: acquisitionText(acquisition), quantityEnabled: false };
  if (options.remaining <= 0) return { label: actionLabel(acquisition), disabledReason: t(acquisition.kind === "rewarded_ad" ? "product.limit.ad" : "product.limit.claim"), priceText: acquisitionText(acquisition), quantityEnabled: false };
  if (options.available === false) return { label: actionLabel(acquisition), disabledReason: t(acquisition.kind === "rewarded_ad" ? "product.unavailable.ad" : acquisition.kind === "platform_payment" ? "product.unavailable.payment" : "product.unavailable"), priceText: acquisitionText(acquisition), quantityEnabled: false };
  return { label: actionLabel(acquisition), priceText: acquisitionText(acquisition), quantityEnabled: acquisition.kind === "currency" };
}

/** 방식별 동사는 화면 종류와 무관하게 동일하다. */
function actionLabel(acquisition: ProductAcquisition): string {
  return t(`product.action.${acquisition.kind}`);
}

/** 무료를 0으로 표시하지 않고 외부 결제 가격도 카탈로그가 제공한 문자열만 사용한다. */
function acquisitionText(acquisition: ProductAcquisition): string {
  if (acquisition.kind === "free") return t("product.price.free");
  if (acquisition.kind === "rewarded_ad") return t("product.price.ad", { count: acquisition.dailyLimitUtc });
  if (acquisition.kind === "platform_payment") return acquisition.displayPrice;
  return t("product.price.currency", { amount: acquisition.amount.toLocaleString(), currency: currencyName(acquisition.currency) });
}

/** 지갑 키의 사용자 표시명은 화면이 쓰는 것과 같은 표에서 온다. */
function currencyName(currency: ProductCurrency): string {
  return t(`currency.${currency}`);
}
