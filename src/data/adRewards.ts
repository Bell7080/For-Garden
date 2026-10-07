import { registerDataText } from "../i18n";
/** 광고로 즉시 지급할 수 있는 일반 플레이 재화의 폐쇄된 허용 목록이다. */
export type AdRewardCurrency = "stamina" | "cheesecake" | "gems" | "gold" | "rawStone" | "raidSigil" | "salvageRecord";

/** 발굴 광고 효과는 서버가 이해하는 세 종류로만 제한한다. */
export type ExcavationAdEffect =
  | { readonly kind: "harvest_multiplier"; readonly multiplier: 1.5; readonly appliesTo: "current_confirmed_harvest_once" }
  | { readonly kind: "storage_extension"; readonly maxStorageSeconds: 57_600; readonly appliesTo: "next_settlement_window" }
  | { readonly kind: "production_speed"; readonly multiplier: 1.5; readonly durationSeconds: number; readonly refresh: "replace_expiry" };

/** kind로 즉시 재화와 상태 변경을 안전하게 분기하는 광고 보상 합집합이다. */
export type AdReward =
  | { readonly kind: "currency"; readonly currency: AdRewardCurrency; readonly amount: number }
  /** 한 번에 둘 이상의 재화를 함께 주는 광고(전리품 상점의 토벌·인양 증표). */
  | { readonly kind: "currencies"; readonly grants: readonly { readonly currency: AdRewardCurrency; readonly amount: number }[] }
  | { readonly kind: "excavation_effect"; readonly effect: ExcavationAdEffect }
  /** 가방에 쌓이는 아이템. 지금은 소탕권 하나뿐이라 ID를 그 값으로 못 박는다. */
  | { readonly kind: "item"; readonly itemId: "sweep-ticket"; readonly quantity: number }
  /** 결투 도전권. 가방이 아니라 결투장의 오늘 횟수에 더해진다 — 하루가 지나면 기본 몫과 함께 사라진다. */
  | { readonly kind: "duel_attempt"; readonly quantity: number }
  /** 실제 점수와 지급량은 광고 검증 뒤 서버 기록만으로 계산한다. */
  | { readonly kind: "quick_expedition"; readonly scoreRatio: number };

/** 광고 노출 위치는 일반 보급과 발굴 화면만 허용한다. */
export type AdPlacement = "shop_free_supplies" | "daily_mission_rewards" | "idle_excavation" | "quick_expedition" | "dungeon_sweep" | "duel_arena" | "premium_gems" | "shop_gold" | "archaeology_shop" | "loot_shop";

/** 서버 운영 설정의 원본이 되는 허용 슬롯 정의다. */
export interface AdRewardSlot { readonly id: string; readonly displayText: string; readonly reward: AdReward; readonly dailyLimitUtc: number; readonly weeklyLimitUtc?: number; readonly placement: AdPlacement; }

export const AD_REWARD_SLOTS = [
  { id: "daily-stamina", displayText: "스테미나 10", reward: { kind: "currency", currency: "stamina", amount: 10 }, dailyLimitUtc: 3, placement: "shop_free_supplies" },
  { id: "daily-cheesecake", displayText: "치즈케이크 20", reward: { kind: "currency", currency: "cheesecake", amount: 20 }, dailyLimitUtc: 3, placement: "daily_mission_rewards" },
  // 수확 배율은 광고 완료 전에 서버가 확정한 현재 미수확분에만 소비되는 일회성 규칙이다.
  { id: "excavation-harvest", displayText: "현재 수확 1.5배", reward: { kind: "excavation_effect", effect: { kind: "harvest_multiplier", multiplier: 1.5, appliesTo: "current_confirmed_harvest_once" } }, dailyLimitUtc: 3, placement: "idle_excavation" },
  // 확장은 다음 정산 한 번에서만 기본 보관 시간의 두 배(8 → 16시간)를 허용하며 기존 생산분을
  // 소급하지 않는다. 두 값이 갈리면 `tests/unit/adRewards.test.ts`가 실패한다.
  { id: "excavation-storage", displayText: "다음 정산 보관 최대 16시간", reward: { kind: "excavation_effect", effect: { kind: "storage_extension", maxStorageSeconds: 57_600, appliesTo: "next_settlement_window" } }, dailyLimitUtc: 2, placement: "idle_excavation" },
  // 같은 효과 재수령은 배율을 곱하지 않고, 수확과 같은 1.5배로 서버 시각부터 만료만 교체한다.
  { id: "excavation-speed", displayText: "생산 1.5배 · 60분", reward: { kind: "excavation_effect", effect: { kind: "production_speed", multiplier: 1.5, durationSeconds: 3_600, refresh: "replace_expiry" } }, dailyLimitUtc: 2, placement: "idle_excavation" },
  // 소탕권 다섯 장. 멤버십이 없는 사람이 던전 소탕을 쓰는 길이다 — 한 번에 한 장이 든다.
  { id: "sweep-tickets", displayText: "소탕권 5", reward: { kind: "item", itemId: "sweep-ticket", quantity: 5 }, dailyLimitUtc: 3, placement: "dungeon_sweep" },
  // 결투 도전권 한 장. 젬 구매와 따로 세어 젬 값의 누진을 밀어 올리지 않는다.
  { id: "duel-attempt", displayText: "결투 도전권 1", reward: { kind: "duel_attempt", quantity: 1 }, dailyLimitUtc: 3, placement: "duel_arena" },
  // 프리미엄 젬 탭·일반 상점 골드 탭의 광고. 값은 깔끔한 단위로 끊는다(`premiumAmounts.test`).
  { id: "gem-ad", displayText: "젬 10", reward: { kind: "currency", currency: "gems", amount: 10 }, dailyLimitUtc: 3, placement: "premium_gems" },
  { id: "gold-ad", displayText: "골드 5,000", reward: { kind: "currency", currency: "gold", amount: 5_000 }, dailyLimitUtc: 3, placement: "shop_gold" },
  // 고고학 상점의 원석, 전리품 상점의 토벌·인양 증표. 모두 하루 세 번이다.
  { id: "archaeology-ad", displayText: "원석 100", reward: { kind: "currency", currency: "rawStone", amount: 100 }, dailyLimitUtc: 3, placement: "archaeology_shop" },
  { id: "loot-ad", displayText: "토벌 증표 5 · 인양 증표 5", reward: { kind: "currencies", grants: [{ currency: "raidSigil", amount: 5 }, { currency: "salvageRecord", amount: 5 }] }, dailyLimitUtc: 3, placement: "loot_shop" },
  // 기준 점수가 없거나 광고 검증이 실패하면 서버가 지급을 거절하며 횟수도 소비하지 않는다.
  { id: "quick-expedition", displayText: "빠른 원정", reward: { kind: "quick_expedition", scoreRatio: 0.25 }, dailyLimitUtc: 2, weeklyLimitUtc: 5, placement: "quick_expedition" },
] as const satisfies readonly AdRewardSlot[];

/** 요청 슬롯을 서버 허용 목록과 대조한다. */
export function findAdRewardSlot(slotId: string): AdRewardSlot | undefined { return AD_REWARD_SLOTS.find((slot) => slot.id === slotId); }

/** SDK 취소·실패·재고 없음에서는 토큰을 절대 만들지 않는 작은 순수 경계다. */
export function completedAdToken(result: { status: string; verificationToken?: string }): string | undefined {
  return result.status === "completed" && result.verificationToken ? result.verificationToken : undefined;
}

/** 광고 보상 슬롯의 표시 문구를 언어별로 덮어쓸 수 있게 등록한다. */
for (const slot of AD_REWARD_SLOTS) registerDataText(slot, "displayText", `adReward.${slot.id}.text`);
