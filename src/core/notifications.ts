/** 화면 이름과 무관하게 서버 상태에서 판별할 수 있는 공용 알림 키다. */
export const NOTIFICATION_KEYS = ["raidReward", "expeditionReward", "sortieReward", "missionReward", "excavationHarvestReady", "friendRequest", "newEvent", "mail", "premiumFree", "premiumFreeDaily", "premiumFreeWeekly", "premiumFreeMonthly", "premiumOffer", "passReward", "premiumNotice", "achievementReward", "codexReward", "shopFree", "freeResearch", "interactionReturned", "duelSeasonReward", "duelDefense", "duel", "premiumSubscription", "guildAttendance", "patronDaily"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

/** API 응답을 합성하기 전의 최소 조건이며, 항목이 없으면 추측하지 않고 false로 둔다. */
export interface NotificationConditions {
  claimableRaidCount?: number;
  claimableExpeditionCount?: number;
  claimableMissionCount: number;
  excavationHarvestReady: boolean;
  pendingFriendRequestCount: number;
  unseenEventCount: number;
  /** 광고를 봐야 받는 것만 남은 이벤트 수. `showAdDots`를 켰을 때만 이벤트 점을 세운다. */
  adOnlyEventCount?: number;
  /** 설정의 「광고 보상 알림 점」 — 광고 보상은 공짜 보상이 아니라 기본은 끔이다. */
  showAdDots?: boolean;
  unreadMailCount: number;
  claimableMailCount?: number;
  claimablePassCount?: number;
  /** 받을 수 있는 업적 단계 수. 알려 주지 않으면 없는 것으로 둔다. */
  claimableAchievementCount?: number;
  /** 받을 수 있는 도감 마디 수. */
  claimableCodexCount?: number;
  /** 아직 받지 않은 무료 보급이 남은 프리미엄 탭. 알려 주지 않으면 없는 것으로 둔다. */
  freeSupplyCategories?: readonly string[];
  /** 지금 열린 상황 특가 수(`core/situationalOffers.ts`). 알려 주지 않으면 없는 것으로 둔다. */
  situationalOfferCount?: number;
  /** 일반 상점에 아직 받지 않은 무료 칸이 있는가. */
  shopFreeSupply?: boolean;
  /** 오늘의 무료 화석 연구가 남았는가(`core/freeResearch.ts`). */
  freeResearchAvailable?: boolean;
  /** 돌아와 받을 수 있는 교류 파견 수. */
  claimableInteractionCount?: number;
  /** 결투 시즌 보상이 받을 수 있게 대기 중인가. */
  duelSeasonRewardReady?: boolean;
  /** 결투 방어덱이 알릴 것의 서명(빈 값이면 없음)과, 이 기기에서 방어덱을 열어 본 서명. 다르면 점이 선다. */
  duelDefenseNotice?: string;
  duelDefenseSeen?: string;
  /** 오늘 몫을 아직 받지 않은 구독 수. */
  claimableSubscriptionBonusCount?: number;
  /** 길드에 들었는데 오늘 출석 도장을 아직 찍지 않았는가. 길드가 없으면 서버가 false로 보낸다. */
  guildAttendanceReady?: boolean;
  /** 후원 지층에 받을 것(오늘 보급·기념품)이 있는가. */
  patronClaimable?: boolean;
}

/** 모든 씬이 공유하는 판정 결과라 UI가 개별 숫자나 날짜를 다시 계산하지 않는다. */
export type NotificationState = Readonly<Record<NotificationKey, boolean>>;

/** 수량은 양수일 때만 켜고 서버가 직접 판정한 발굴 상한 상태는 그대로 사용한다. */
export function deriveNotificationState(conditions: NotificationConditions): NotificationState {
  return {
    raidReward: (conditions.claimableRaidCount ?? 0) > 0,
    expeditionReward: (conditions.claimableExpeditionCount ?? 0) > 0,
    sortieReward: (conditions.claimableRaidCount ?? 0) > 0 || (conditions.claimableExpeditionCount ?? 0) > 0,
    missionReward: conditions.claimableMissionCount > 0,
    excavationHarvestReady: conditions.excavationHarvestReady,
    friendRequest: conditions.pendingFriendRequestCount > 0,
    newEvent: conditions.unseenEventCount > 0 || (conditions.showAdDots === true && (conditions.adOnlyEventCount ?? 0) > 0),
    mail: conditions.unreadMailCount > 0 || (conditions.claimableMailCount ?? 0) > 0,
    passReward: (conditions.claimablePassCount ?? 0) > 0,
    achievementReward: (conditions.claimableAchievementCount ?? 0) > 0,
    codexReward: (conditions.claimableCodexCount ?? 0) > 0,
    // 패스 달성 보상은 로비 패스 카드에서 받으므로 프리미엄 쪽에는 알리지 않는다.
    premiumNotice: (conditions.freeSupplyCategories?.length ?? 0) > 0 || (conditions.situationalOfferCount ?? 0) > 0 || (conditions.claimableSubscriptionBonusCount ?? 0) > 0 || conditions.patronClaimable === true,
    // 상황 특가는 결과판 위에 창을 띄우지 않고 프리미엄 「한정」 탭의 붉은 점으로만 알린다.
    premiumOffer: (conditions.situationalOfferCount ?? 0) > 0,
    premiumFree: (conditions.freeSupplyCategories?.length ?? 0) > 0,
    premiumFreeDaily: conditions.freeSupplyCategories?.includes("daily") ?? false,
    premiumFreeWeekly: conditions.freeSupplyCategories?.includes("weekly") ?? false,
    premiumFreeMonthly: conditions.freeSupplyCategories?.includes("monthly") ?? false,
    shopFree: conditions.shopFreeSupply === true,
    freeResearch: conditions.freeResearchAvailable === true,
    interactionReturned: (conditions.claimableInteractionCount ?? 0) > 0,
    duelSeasonReward: conditions.duelSeasonRewardReady === true,
    duelDefense: duelDefenseUnseen(conditions),
    // 로비 결투 입구는 시즌 보상과 방어덱 둘 중 하나만 있어도 점을 단다.
    duel: conditions.duelSeasonRewardReady === true || duelDefenseUnseen(conditions),
    premiumSubscription: (conditions.claimableSubscriptionBonusCount ?? 0) > 0,
    guildAttendance: conditions.guildAttendanceReady === true,
    patronDaily: conditions.patronClaimable === true,
  };
}

function duelDefenseUnseen(conditions: NotificationConditions): boolean {
  const notice = conditions.duelDefenseNotice ?? "";
  return notice !== "" && notice !== (conditions.duelDefenseSeen ?? "");
}

/** 첫 조회 전에는 데이터가 없는 알림을 임의로 켜지 않는 안전한 초기 상태다. */
export const EMPTY_NOTIFICATION_STATE: NotificationState = deriveNotificationState({
  claimableMissionCount: 0, excavationHarvestReady: false, pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0,
});
