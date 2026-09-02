import { describe, expect, it, vi } from "vitest";
import type { GameApi } from "../../src/api/contracts";
import { deriveNotificationState, NOTIFICATION_KEYS } from "../../src/core/notifications";
import { NotificationManager } from "../../src/managers/NotificationManager";
import { NOTIFICATION_DOT_STYLE, perspectiveButtonNotificationAnchor, rotatedNotificationAnchor } from "../../src/ui/notificationDotStyle";

/** 알림별 조건과 공용 시각 규격이 화면별 구현으로 다시 갈라지지 않게 고정한다. */
describe("notifications", () => {
  it("maps only positive or explicit conditions to each stable key", () => {
    expect(NOTIFICATION_KEYS).toEqual(["missionReward", "excavationHarvestReady", "friendRequest", "newEvent", "mail"]);
    expect(deriveNotificationState({ claimableMissionCount: 2, excavationHarvestReady: true, pendingFriendRequestCount: 1, unseenEventCount: 3, unreadMailCount: 4 }))
      .toEqual({ missionReward: true, excavationHarvestReady: true, friendRequest: true, newEvent: true, mail: true });
    expect(deriveNotificationState({ claimableMissionCount: 0, excavationHarvestReady: false, pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 }))
      .toEqual({ missionReward: false, excavationHarvestReady: false, friendRequest: false, newEvent: false, mail: false });
  });

  it("keeps one red, white-outlined, dark-shadow specification for every button", () => {
    expect(NOTIFICATION_DOT_STYLE).toEqual({ radius: 13, fill: 0xd92f45, outline: 0xffffff, outlineWidth: 4, shadow: 0x090b10, shadowAlpha: 0.82, shadowOffsetY: 7 });
  });

  it("기울어진 발굴 판의 우상단을 같은 각도로 따라간다", () => {
    // 90°로 단순화해 판과 별도 레이어인 점의 좌표 회전을 오차 없이 검증한다.
    const anchor = rotatedNotificationAnchor({ x: 10, y: -4, rotation: Math.PI / 2 });
    expect(anchor.x).toBeCloseTo(4); expect(anchor.y).toBeCloseTo(10);
  });

  it("발굴 알림점은 원근으로 짧아진 실제 오른쪽 변 안쪽에 머문다", () => {
    const anchor = perspectiveButtonNotificationAnchor({ width: 292, height: 106, tall: "left", rotation: Math.PI / 30, inset: 10 });
    // 예전 사각형 모서리 y=-46보다 아래에 있는 짧은 변을 따라가되 버튼 반폭 밖으로 새지 않는다.
    expect(anchor.x).toBeLessThan(146); expect(anchor.x).toBeGreaterThan(120);
    expect(anchor.y).toBeGreaterThan(-30); expect(anchor.y).toBeLessThan(0);
  });

  it("composes APIs once and emits only changed key values", async () => {
    const api = {
      getMissions: vi.fn().mockResolvedValue({ missions: [], claimableCount: 1 }),
      getIdleExcavation: vi.fn().mockResolvedValue({ excavation: {}, serverTime: "", storageFillRatio: 0.5, harvestNotice: true }),
      getNotificationSignals: vi.fn().mockResolvedValue({ pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 }),
    } as unknown as GameApi;
    const manager = new NotificationManager(api); const values: boolean[] = [];
    const unsubscribe = manager.subscribe("missionReward", (value) => values.push(value));
    await manager.refresh(); await manager.refresh(); unsubscribe();
    expect(values).toEqual([false, true]);
    expect(api.getMissions).toHaveBeenCalledTimes(2);
  });

  it("팝업 출입이나 앱 재진입을 읽음 처리하지 않고 서버 확정 수확 상태를 복원한다", async () => {
    const getIdleExcavation = vi.fn().mockResolvedValue({ excavation: {}, serverTime: "", storageFillRatio: 0.5, harvestNotice: true });
    const api = { getMissions: vi.fn().mockResolvedValue({ missions: [], claimableCount: 0 }), getIdleExcavation, getNotificationSignals: vi.fn().mockResolvedValue({ pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 }) } as unknown as GameApi;
    const firstManager = new NotificationManager(api); const first: boolean[] = [];
    firstManager.subscribe("excavationHarvestReady", (value) => first.push(value)); await firstManager.refresh(); await firstManager.refresh();
    // 새 manager는 앱 재진입을 나타내며, 로컬 읽음 플래그 없이 같은 서버 true를 다시 받는다.
    const restoredManager = new NotificationManager(api); const restored: boolean[] = [];
    restoredManager.subscribe("excavationHarvestReady", (value) => restored.push(value)); await restoredManager.refresh();
    expect(first).toEqual([false, true]); expect(restored).toEqual([false, true]); expect(getIdleExcavation).toHaveBeenCalledTimes(3);
  });
});
