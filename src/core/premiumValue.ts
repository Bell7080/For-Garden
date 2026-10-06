import type { ProductDto } from "../api/contracts";
import { tradeGemValue } from "../data/tradePackages";

/**
 * 가방 아이템의 젬 값 — 시세표(`TRADE_GEM_RATE`)에 없는 소비품이라 여기서만 센다.
 * 드링크는 스테미나 값어치의 기준(가장 싼 충전 1단계, 젬 0.83/스테미나)에서 나온다.
 * 표에 없는 아이템(소탕권·발굴권 등)은 환산하지 않는다 — 모르는 값을 지어내 배수를 부풀리지 않는다.
 */
export const PREMIUM_ITEM_GEM_VALUE: Readonly<Record<string, number>> = {
  "stamina-tonic": 50,
  "stamina-tonic-large": 100,
};

/** 배수를 단 상품의 최소 배수. 이보다 낮으면 "이득"이라 말할 수 없어 배지를 세우지 않는다. */
export const PREMIUM_VALUE_BADGE_MIN = 1.1;

type ValueInput = Pick<ProductDto, "acquisition" | "grants" | "passBenefit"> & Partial<Pick<ProductDto, "premiumCategory">>;

/** 지급품(+정기권이 매일 얹는 다이아의 기간 합)을 다이아 값으로 환산한다. */
export function premiumGemValue(product: Pick<ProductDto, "grants" | "passBenefit">): number {
  const items = product.grants.reduce((sum, grant) => grant.kind === "item" ? sum + (PREMIUM_ITEM_GEM_VALUE[grant.itemId] ?? 0) * grant.amount : sum, 0);
  const daily = product.passBenefit?.dailyBonus;
  const stipend = daily && daily.currency === "gems" ? daily.amount * (product.passBenefit?.durationDays ?? 0) : 0;
  return tradeGemValue(product.grants) + items + stipend;
}

/**
 * 같은 값의 다이아 팩 대비 몇 배를 받는가. 값이 원화가 아니거나 환산할 것이 없으면 `undefined`다.
 * 정기권은 **30일을 다 출석했을 때**의 값이다(안 받은 날은 사라진다).
 */
export function premiumValueMultiple(product: ValueInput, gemPerKrw: number): number | undefined {
  // 다이아 팩은 기준 자신이라 크기별 효율 차이를 배수로 달지 않는다.
  if (product.acquisition.kind !== "platform_payment" || product.premiumCategory === "gem") return undefined;
  const value = premiumGemValue(product);
  const baseline = product.acquisition.basePriceKrw * gemPerKrw;
  if (!(value > 0) || !(baseline > 0)) return undefined;
  const multiple = Math.round((value / baseline) * 10) / 10;
  return multiple >= PREMIUM_VALUE_BADGE_MIN ? multiple : undefined;
}

/** 정가가 있는 상품의 할인율(%). 정가가 값보다 낮거나 없으면 `undefined`. */
export function premiumDiscountPercent(product: Pick<ProductDto, "acquisition">): number | undefined {
  const { acquisition } = product;
  if (acquisition.kind !== "platform_payment" || acquisition.listPriceKrw === undefined) return undefined;
  if (!(acquisition.listPriceKrw > acquisition.basePriceKrw)) return undefined;
  return Math.round((1 - acquisition.basePriceKrw / acquisition.listPriceKrw) * 100);
}
