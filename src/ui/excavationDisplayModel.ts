import { EXCAVATION_CURRENCIES, type ExcavationCurrency } from "../core/idleExcavation";

/** 발굴 요약 한 칸이 렌더러와 무관하게 알아야 하는 정적 배치 정보다. */
export interface ExcavationDisplayItem {
  currency: ExcavationCurrency;
  unclaimed: number;
  rate: number;
  x: number;
}

/** 네 칸에서도 팝업의 760px 안전 폭 안에 액자와 간격을 함께 보존한다. */
export const EXCAVATION_DISPLAY_LAYOUT = { safeWidth: 760, itemWidth: 172, gap: 16 } as const;

/** 획득했거나 현재 생산 중인 재화만 공용 순서로 남기고 한 줄 중앙 좌표를 계산한다. */
export function excavationDisplayModel(
  unclaimed: Readonly<Record<ExcavationCurrency, number>>,
  rates: Readonly<Record<ExcavationCurrency, number>>,
): ExcavationDisplayItem[] {
  const visible = EXCAVATION_CURRENCIES.filter((currency) => unclaimed[currency] > 0 || rates[currency] > 0);
  const stride = EXCAVATION_DISPLAY_LAYOUT.itemWidth + EXCAVATION_DISPLAY_LAYOUT.gap;
  return visible.map((currency, index) => ({
    currency,
    unclaimed: unclaimed[currency],
    rate: rates[currency],
    x: (index - (visible.length - 1) / 2) * stride,
  }));
}
