import { describe, expect, it, vi } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession, createEmptyProgressPassState } from "../../src/state/session";
import { ManagerEvents } from "../../src/managers/ManagerEvents";
import type { GameApi } from "../../src/api/contracts";
import { deriveNotificationState, NOTIFICATION_KEYS } from "../../src/core/notifications";
import { NotificationManager } from "../../src/managers/NotificationManager";
import { NOTIFICATION_DOT_STYLE, perspectiveButtonNotificationAnchor, rotatedNotificationAnchor } from "../../src/ui/notificationDotStyle";

/** 알림별 조건과 공용 시각 규격이 화면별 구현으로 다시 갈라지지 않게 고정한다. */
describe("notifications", () => {
  it("maps only positive or explicit conditions to each stable key", () => {
    expect(NOTIFICATION_KEYS).toEqual(["missionReward", "excavationHarvestReady", "friendRequest", "newEvent", "mail", "premiumFree", "premiumFreeDaily", "premiumFreeWeekly", "premiumFreeMonthly", "passReward", "premiumNotice", "achievementReward"]);
    expect(deriveNotificationState({ claimableMissionCount: 2, excavationHarvestReady: true, pendingFriendRequestCount: 1, unseenEventCount: 3, unreadMailCount: 4 }))
      .toEqual({ missionReward: true, excavationHarvestReady: true, friendRequest: true, newEvent: true, mail: true, premiumFree: false, premiumFreeDaily: false, premiumFreeWeekly: false, premiumFreeMonthly: false, passReward: false, premiumNotice: false, achievementReward: false });
    expect(deriveNotificationState({ claimableMissionCount: 0, excavationHarvestReady: false, pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 }))
      .toEqual({ missionReward: false, excavationHarvestReady: false, friendRequest: false, newEvent: false, mail: false, premiumFree: false, premiumFreeDaily: false, premiumFreeWeekly: false, premiumFreeMonthly: false, passReward: false, premiumNotice: false, achievementReward: false });
    expect(deriveNotificationState({ claimableMissionCount: 0, excavationHarvestReady: false, pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0, freeSupplyCategories: ["weekly"] }))
      .toMatchObject({ premiumFree: true, premiumFreeDaily: false, premiumFreeWeekly: true, premiumFreeMonthly: false, passReward: false, premiumNotice: true });
  });

  it("읽은 우편의 미수령 보상과 패스 보상도 알리고 전부 수령하면 꺼진다", () => {
    const base = { claimableMissionCount: 0, excavationHarvestReady: false, pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 };
    expect(deriveNotificationState({ ...base, claimableMailCount: 1, claimablePassCount: 1 })).toMatchObject({ mail: true, passReward: true, premiumNotice: true, premiumFree: false });
    expect(deriveNotificationState({ ...base, claimableMailCount: 0, claimablePassCount: 0 })).toMatchObject({ mail: false, passReward: false, premiumNotice: false });
  });

  it("조회 중 우편을 수령한 최신 영수증을 이전 응답이 덮지 않는다", async () => {
    let resolve!: (value: unknown) => void;
    const events = new ManagerEvents();
    const api = { getMissions: vi.fn().mockResolvedValue({ claimableCount: 0 }), getIdleExcavation: vi.fn().mockResolvedValue({ harvestNotice: false }), getNotificationSignals: vi.fn().mockImplementation(() => new Promise((done) => { resolve = done; })) } as unknown as GameApi;
    const manager = new NotificationManager(api, events);
    const values: boolean[] = [];
    const unsubscribe = manager.subscribe("mail", (value) => values.push(value));
    const refresh = manager.refresh();
    events.publishMailNotification(false);
    resolve({ unreadMailCount: 1, claimableMailCount: 1, pendingFriendRequestCount: 0, unseenEventCount: 0, freeSupplyCategories: [] });
    await refresh;
    expect(values).toEqual([false]);
    unsubscribe();
  });

  it("레이드 무료 패스 보상 달성·수령을 실제 API 신호에 반영한다", async () => {
    const state = createDefaultSession();
    const api = new FakeServer(state, { latencyMs: 0 });
    const before = (await api.getNotificationSignals()).claimablePassCount!;
    state.progressPasses = { ...createEmptyProgressPassState(), raidRuns: 1 };
    expect((await api.getNotificationSignals()).claimablePassCount).toBe(before + 1);
    await api.claimProgressPass({ passId: "raid", requestId: "notice-pass-claim" });
    expect((await api.getNotificationSignals()).claimablePassCount).toBe(before);
  });

  it("무료 일간 보급은 수령하면 꺼지고 다음 UTC 날짜에 다시 켜진다", async () => {
    let now = new Date("2026-08-30T23:59:59Z");
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => now });
    expect((await api.getNotificationSignals()).freeSupplyCategories).toContain("daily");
    await api.purchaseProduct({ storefront: "premium", productId: "premium-free-daily", quantity: 1 });
    expect((await api.getNotificationSignals()).freeSupplyCategories).not.toContain("daily");
    now = new Date("2026-08-31T00:00:00Z");
    expect((await api.getNotificationSignals()).freeSupplyCategories).toContain("daily");
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
    const manager = new NotificationManager(api, new ManagerEvents()); const values: boolean[] = [];
    const unsubscribe = manager.subscribe("missionReward", (value) => values.push(value));
    await manager.refresh(); await manager.refresh(); unsubscribe();
    expect(values).toEqual([false, true]);
    expect(api.getMissions).toHaveBeenCalledTimes(2);
  });

  it("다른 조회 하나가 실패해도 임무 점은 확정하고, 실패한 쪽은 지난 값을 둔다", async () => {
    // 셋을 한꺼번에 기다리던 때는 발굴 조회 하나가 실패하면 받을 임무가 있어도 임무 점이 꺼진 채 남았다.
    const getIdleExcavation = vi.fn().mockResolvedValueOnce({ excavation: {}, serverTime: "", storageFillRatio: 1, harvestNotice: true }).mockRejectedValue(new Error("down"));
    const api = { getMissions: vi.fn().mockResolvedValue({ missions: [], claimableCount: 2 }), getIdleExcavation, getNotificationSignals: vi.fn().mockRejectedValue(new Error("down")) } as unknown as GameApi;
    const manager = new NotificationManager(api, new ManagerEvents()); const missions: boolean[] = []; const harvest: boolean[] = [];
    manager.subscribe("missionReward", (value) => missions.push(value));
    manager.subscribe("excavationHarvestReady", (value) => harvest.push(value));
    await manager.refresh(); await manager.refresh();
    expect(missions).toEqual([false, true]);
    expect(harvest).toEqual([false, true]);
  });

  it("서버가 받을 보상 수가 바뀌었다고 알리면 곧바로 다시 읽는다", async () => {
    let notify: () => void = () => undefined;
    const getMissions = vi.fn().mockResolvedValueOnce({ missions: [], claimableCount: 0 }).mockResolvedValue({ missions: [], claimableCount: 1 });
    const api = { getMissions, getIdleExcavation: vi.fn().mockResolvedValue({ excavation: {}, serverTime: "", storageFillRatio: 0, harvestNotice: false }), getNotificationSignals: vi.fn().mockResolvedValue({ pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 }),
      subscribeMissionNotice: (listener: () => void) => { notify = listener; return () => undefined; } } as unknown as GameApi;
    const manager = new NotificationManager(api, new ManagerEvents()); const values: boolean[] = [];
    manager.subscribe("missionReward", (value) => values.push(value));
    await manager.refresh();
    notify(); notify(); // 한 처리 안의 여러 저장은 한 번만 다시 읽는다.
    await vi.waitFor(() => expect(values).toEqual([false, true]));
    expect(getMissions).toHaveBeenCalledTimes(2);
  });

  it("팝업 출입이나 앱 재진입을 읽음 처리하지 않고 서버 확정 수확 상태를 복원한다", async () => {
    const getIdleExcavation = vi.fn().mockResolvedValue({ excavation: {}, serverTime: "", storageFillRatio: 0.5, harvestNotice: true });
    const api = { getMissions: vi.fn().mockResolvedValue({ missions: [], claimableCount: 0 }), getIdleExcavation, getNotificationSignals: vi.fn().mockResolvedValue({ pendingFriendRequestCount: 0, unseenEventCount: 0, unreadMailCount: 0 }) } as unknown as GameApi;
    const firstManager = new NotificationManager(api, new ManagerEvents()); const first: boolean[] = [];
    firstManager.subscribe("excavationHarvestReady", (value) => first.push(value)); await firstManager.refresh(); await firstManager.refresh();
    // 새 manager는 앱 재진입을 나타내며, 로컬 읽음 플래그 없이 같은 서버 true를 다시 받는다.
    const restoredManager = new NotificationManager(api, new ManagerEvents()); const restored: boolean[] = [];
    restoredManager.subscribe("excavationHarvestReady", (value) => restored.push(value)); await restoredManager.refresh();
    expect(first).toEqual([false, true]); expect(restored).toEqual([false, true]); expect(getIdleExcavation).toHaveBeenCalledTimes(3);
  });
});
