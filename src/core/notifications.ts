/** 화면 이름과 무관하게 서버 상태에서 판별할 수 있는 공용 알림 키다. */
export const NOTIFICATION_KEYS = ["missionReward", "excavationHarvestReady", "friendRequest", "newEvent", "mail"] as const;
export type NotificationKey = (typeof NOTIFICATION_KEYS)[number];

/** API 응답을 합성하기 전의 최소 조건이며, 항목이 없으면 추측하지 않고 false로 둔다. */
export interface NotificationConditions {
  claimableMissionCount: number;
  excavationHarvestReady: boolean;
  pendingFriendRequestCount: number;
  unseenEventCount: number;
  unreadMailCount: number;
}

/** 모든 씬이 공유하는 판정 결과라 UI가 개별 숫자나 날짜를 다시 계산하지 않는다. */
export type NotificationState = Readonly<Record<NotificationKey, boolean>>;

/** 수량은 양수일 때만 켜고 서버가 직접 판정한 발굴 상한 상태는 그대로 사용한다. */
export function deriveNotificationState(conditions: NotificationConditions): NotificationState {
  return {
    missionReward: conditions.claimableMissionCount > 0,
    excavationHarvestReady: conditions.excavationHarvestReady,
    friendRequest: conditions.pendingFriendRequestCount > 0,
    newEvent: conditions.unseenEventCount > 0,
    mail: conditions.unreadMailCount > 0,
  };
}

/** 첫 조회 전에는 데이터가 없는 알림을 임의로 켜지 않는 안전한 초기 상태다. */
export const EMPTY_NOTIFICATION_STATE: NotificationState = deriveNotificationState({
  claimableMissionCount: 0, excavationHarvestReady: false, pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0,
});
