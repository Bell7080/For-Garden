/** 광고로 지급할 수 있는 일반 플레이·성장 재화의 폐쇄된 허용 목록이다. */
export type AdRewardCurrency = "stamina" | "cheesecake";

/** 보상형 광고의 노출 위치다. 씬 이름 대신 운영상 허용된 영역만 표현한다. */
export type AdPlacement = "shop_free_supplies" | "daily_mission_rewards";

/** 클라이언트가 표시하고 서버가 지급 정책을 조회하는 정적 광고 슬롯 정의다. */
export interface AdRewardSlot {
  readonly id: string;
  readonly displayText: string;
  readonly reward: { readonly currency: AdRewardCurrency; readonly amount: number };
  /** UTC 날짜가 바뀔 때만 초기화되는 슬롯별 최대 수령 횟수다. */
  readonly dailyLimitUtc: number;
  readonly placement: AdPlacement;
}

/** 희소 가챠 보상은 타입 단계부터 넣을 수 없는 초기 보상형 광고 슬롯이다. */
export const AD_REWARD_SLOTS = [
  { id: "daily-stamina", displayText: "광고 보고 스테미나 10 받기", reward: { currency: "stamina", amount: 10 }, dailyLimitUtc: 3, placement: "shop_free_supplies" },
  { id: "daily-cheesecake", displayText: "광고 보고 치즈케이크 20개 받기", reward: { currency: "cheesecake", amount: 20 }, dailyLimitUtc: 3, placement: "daily_mission_rewards" },
] as const satisfies readonly AdRewardSlot[];

/** 서버 경계가 요청 슬롯을 정적 허용 목록과 대조할 때 사용하는 조회 함수다. */
export function findAdRewardSlot(slotId: string): AdRewardSlot | undefined {
  return AD_REWARD_SLOTS.find((slot) => slot.id === slotId);
}
