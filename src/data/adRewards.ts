/** 광고로 즉시 지급할 수 있는 일반 플레이 재화의 폐쇄된 허용 목록이다. */
export type AdRewardCurrency = "stamina" | "cheesecake";

/** 발굴 광고 효과는 서버가 이해하는 세 종류로만 제한한다. */
export type ExcavationAdEffect =
  | { readonly kind: "harvest_multiplier"; readonly multiplier: 1.5; readonly appliesTo: "current_confirmed_harvest_once" }
  | { readonly kind: "storage_extension"; readonly maxStorageSeconds: 28_800; readonly appliesTo: "next_settlement_window" }
  | { readonly kind: "production_speed"; readonly multiplier: 1.5; readonly durationSeconds: number; readonly refresh: "replace_expiry" };

/** kind로 즉시 재화와 상태 변경을 안전하게 분기하는 광고 보상 합집합이다. */
export type AdReward =
  | { readonly kind: "currency"; readonly currency: AdRewardCurrency; readonly amount: number }
  | { readonly kind: "excavation_effect"; readonly effect: ExcavationAdEffect };

/** 광고 노출 위치는 일반 보급과 발굴 화면만 허용한다. */
export type AdPlacement = "shop_free_supplies" | "daily_mission_rewards" | "idle_excavation";

/** 서버 운영 설정의 원본이 되는 허용 슬롯 정의다. */
export interface AdRewardSlot { readonly id: string; readonly displayText: string; readonly reward: AdReward; readonly dailyLimitUtc: number; readonly placement: AdPlacement; }

export const AD_REWARD_SLOTS = [
  { id: "daily-stamina", displayText: "스테미나 10", reward: { kind: "currency", currency: "stamina", amount: 10 }, dailyLimitUtc: 3, placement: "shop_free_supplies" },
  { id: "daily-cheesecake", displayText: "치즈케이크 20", reward: { kind: "currency", currency: "cheesecake", amount: 20 }, dailyLimitUtc: 3, placement: "daily_mission_rewards" },
  // 수확 배율은 광고 완료 전에 서버가 확정한 현재 미수확분에만 소비되는 일회성 규칙이다.
  { id: "excavation-harvest", displayText: "현재 수확 1.5배", reward: { kind: "excavation_effect", effect: { kind: "harvest_multiplier", multiplier: 1.5, appliesTo: "current_confirmed_harvest_once" } }, dailyLimitUtc: 3, placement: "idle_excavation" },
  // 확장은 다음 정산 한 번에서만 최대 8시간을 허용하며 기존 생산분을 소급하지 않는다.
  { id: "excavation-storage", displayText: "다음 정산 보관 최대 8시간", reward: { kind: "excavation_effect", effect: { kind: "storage_extension", maxStorageSeconds: 28_800, appliesTo: "next_settlement_window" } }, dailyLimitUtc: 2, placement: "idle_excavation" },
  // 같은 효과 재수령은 배율을 곱하지 않고, 수확과 같은 1.5배로 서버 시각부터 만료만 교체한다.
  { id: "excavation-speed", displayText: "생산 1.5배 · 60분", reward: { kind: "excavation_effect", effect: { kind: "production_speed", multiplier: 1.5, durationSeconds: 3_600, refresh: "replace_expiry" } }, dailyLimitUtc: 2, placement: "idle_excavation" },
] as const satisfies readonly AdRewardSlot[];

/** 요청 슬롯을 서버 허용 목록과 대조한다. */
export function findAdRewardSlot(slotId: string): AdRewardSlot | undefined { return AD_REWARD_SLOTS.find((slot) => slot.id === slotId); }

/** SDK 취소·실패·재고 없음에서는 토큰을 절대 만들지 않는 작은 순수 경계다. */
export function completedAdToken(result: { status: string; verificationToken?: string }): string | undefined {
  return result.status === "completed" && result.verificationToken ? result.verificationToken : undefined;
}
