import { describe, expect, it, vi } from "vitest";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { createDefaultSession } from "../../src/state/session";
import type { PlatformFeedback, ScheduledNotification } from "../../src/api/PlatformFeedback";

/** 브라우저 API 없이 권한·예약·취소 호출을 관찰하는 테스트 전용 어댑터다. */
function fakePlatform(permission: "default" | "granted" | "denied" | "unsupported" = "granted") {
  const platform: PlatformFeedback = {
    notificationScheduling: "foreground-only", haptic: vi.fn(() => true), getNotificationPermission: vi.fn(() => permission),
    requestNotificationPermission: vi.fn(async () => permission === "default" ? "denied" : permission),
    scheduleNotification: vi.fn(async (notification: ScheduledNotification) => notification.id), cancelNotification: vi.fn(async () => true),
  };
  return platform;
}

/** 설정의 순수 보정과 manager 저장 경계를 Phaser 없이 고정한다. */
describe("settings", () => {
  it("독립된 기본값을 만들고 음량 범위와 허용 목록 밖 값을 복구한다", () => {
    const first = createDefaultSettings(); const second = createDefaultSettings(); first.sound.masterVolume = 0;
    expect(second.sound.masterVolume).toBe(1);
    expect(normalizeSettings({ sound: { masterVolume: 8, musicVolume: -2 }, accessibility: { textScale: 9, reduceMotion: true }, game: { battleSpeed: 99, textSpeed: "fast", language: "xx" }, account: { provider: "token", token: "secret" } })).toMatchObject({ sound: { masterVolume: 1, musicVolume: 0 }, accessibility: { textScale: 1, reduceMotion: true, reduceFlashes: false, colorAssist: false, subtitles: true }, game: { battleSpeed: 1, textSpeed: 1, language: "ko" }, account: { provider: "guest" } });
  });

  it("부분 변경을 보정해 저장하고 초기화하되 진행은 보존한다", () => {
    const state = createDefaultSession(); state.wallet.gold = 77; const save = vi.fn(); const manager = new SettingsManager(state, { save });
    manager.update({ sound: { musicVolume: 0.25 }, game: { autoUltimate: true } });
    expect(manager.get()).toMatchObject({ sound: { musicVolume: 0.25 }, game: { autoUltimate: true } }); expect(save).toHaveBeenCalledTimes(1);
    manager.reset(); expect(manager.get()).toEqual(createDefaultSettings()); expect(state.wallet.gold).toBe(77); expect(save).toHaveBeenCalledTimes(2);
  });

  it("전투의 3배속과 자동 궁극기를 다음 판에 복원할 설정으로 함께 저장한다", () => {
    const state = createDefaultSession(); const save = vi.fn(); const manager = new SettingsManager(state, { save });
    manager.update({ game: { battleSpeed: 3, autoUltimate: true } });
    // 전투 씬은 이 정규화된 스냅샷을 읽으므로 판을 새로 만들어도 두 선택이 유지된다.
    expect(manager.get().game).toMatchObject({ battleSpeed: 3, autoUltimate: true });
    expect(state.settings.game).toMatchObject({ battleSpeed: 3, autoUltimate: true });
    expect(save).toHaveBeenCalledOnce();
  });

  it("미지원 햅틱과 설정 비활성화는 플랫폼 호출 없이 조용히 실패한다", () => {
    const state = createDefaultSession(); const platform = fakePlatform(); const manager = new SettingsManager(state, { save: vi.fn() }, platform);
    manager.update({ vibration: { enabled: false } }); expect(manager.haptic("battleHit")).toBe(false); expect(platform.haptic).not.toHaveBeenCalled();
    manager.update({ vibration: { enabled: true, combatHit: false } }); expect(manager.haptic("battleHit")).toBe(false); expect(platform.haptic).not.toHaveBeenCalled();
  });

  it("토글만으로 권한을 묻지 않고 명시적 확인에서 거부를 처리한다", async () => {
    const state = createDefaultSession(); const platform = fakePlatform("default"); const manager = new SettingsManager(state, { save: vi.fn() }, platform);
    manager.update({ notifications: { staminaFull: true } }); expect(platform.requestNotificationPermission).not.toHaveBeenCalled();
    await expect(manager.confirmNotifications()).resolves.toBe(false); expect(platform.requestNotificationPermission).toHaveBeenCalledOnce(); expect(manager.get().notifications.enabled).toBe(false);
  });

  it("실제 만료 시각 예약, 이전 예약 취소, 마지막 식별자 저장을 연결한다", async () => {
    const state = createDefaultSession(); const platform = fakePlatform(); const save = vi.fn(); const manager = new SettingsManager(state, { save }, platform);
    manager.update({ notifications: { enabled: true, lastScheduledIds: { staminaFull: "old" } } });
    const request: ScheduledNotification = { id: "stamina-42", kind: "staminaFull", title: "충전 완료", body: "스테미나가 가득 찼습니다.", expiresAt: new Date(Date.now() + 60_000) };
    await expect(manager.scheduleNotification(request)).resolves.toBe("stamina-42"); expect(platform.cancelNotification).toHaveBeenCalledWith("old"); expect(platform.scheduleNotification).toHaveBeenCalledWith(request); expect(manager.get().notifications.lastScheduledIds.staminaFull).toBe("stamina-42");
    await expect(manager.cancelNotification("staminaFull")).resolves.toBe(true); expect(manager.get().notifications.lastScheduledIds.staminaFull).toBeUndefined();
  });

  it("알림 설정 비활성화와 권한 거부에서는 예약하지 않는다", async () => {
    const state = createDefaultSession(); const denied = fakePlatform("denied"); const manager = new SettingsManager(state, { save: vi.fn() }, denied);
    const request: ScheduledNotification = { id: "daily", kind: "dailyMission", title: "임무", body: "마감", expiresAt: new Date(Date.now() + 1000) };
    await expect(manager.scheduleNotification(request)).resolves.toBeNull(); expect(denied.scheduleNotification).not.toHaveBeenCalled();
    manager.update({ notifications: { enabled: true } }); await expect(manager.scheduleNotification(request)).resolves.toBeNull(); expect(denied.scheduleNotification).not.toHaveBeenCalled();
  });
});
