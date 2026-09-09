import { describe, expect, it, vi } from "vitest";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { createDefaultSession } from "../../src/state/session";
import type { PlatformFeedback, ScheduledNotification } from "../../src/api/PlatformFeedback";
import { adjustForQuietHours, nextUtcDay } from "../../src/core/notificationSchedule";

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
    expect(second.game.skipUltimatePresentation).toBe(false);
    expect(normalizeSettings({ sound: { masterVolume: 8, musicVolume: -2 }, accessibility: { textScale: 9, reduceMotion: true }, game: { battleSpeed: 99, skipUltimatePresentation: "yes", textSpeed: "fast", language: "xx" }, account: { provider: "token", token: "secret" } })).toMatchObject({ sound: { masterVolume: 1, musicVolume: 0 }, accessibility: { textScale: 1, reduceMotion: true, reduceFlashes: false, colorAssist: false }, game: { battleSpeed: 1, skipUltimatePresentation: false, textSpeed: 1, language: "ko" }, account: { provider: "guest" } });
  });

  it("보이스 없는 필수 대사를 숨기던 옛 자막 값을 폐기한다", () => {
    // 자막은 향후 보이스가 연결된 비필수 콘텐츠에 별도 의미로 도입하기 전까지 저장 계약에 두지 않는다.
    expect(normalizeSettings({ accessibility: { subtitles: false } }).accessibility).not.toHaveProperty("subtitles");
  });

  it("옛 컷인 끄기를 새 전투 스킵으로 옮기고 폐기 필드는 저장 모델에서 제거한다", () => {
    const migrated = normalizeSettings({ presentation: { ultimateCutIn: false }, game: {} });
    // 옛 false만 스킵 true로 뒤집으며 새 필드를 이미 저장한 사용자의 선택은 마이그레이션보다 우선한다.
    expect(migrated.game.skipUltimatePresentation).toBe(true);
    expect(migrated.presentation).not.toHaveProperty("ultimateCutIn");
    expect(normalizeSettings({ presentation: { ultimateCutIn: false }, game: { skipUltimatePresentation: false } }).game.skipUltimatePresentation).toBe(false);
  });

  it("전투 UI 움직임의 세 단계만 허용하고 이전 저장에는 기본 연출을 부여한다", () => {
    // 필드가 없던 저장과 알 수 없는 값은 모두 기존 체감인 기본 강도로 복구한다.
    expect(normalizeSettings({ presentation: {} }).presentation.battleUiMotion).toBe("default");
    expect(normalizeSettings({ presentation: { battleUiMotion: "reduced" } }).presentation.battleUiMotion).toBe("reduced");
    expect(normalizeSettings({ presentation: { battleUiMotion: "invalid" } }).presentation.battleUiMotion).toBe("default");
  });

  it("부분 변경을 보정해 저장하고 초기화하되 진행은 보존한다", () => {
    const state = createDefaultSession(); state.wallet.gold = 77; const save = vi.fn(); const manager = new SettingsManager(state, { save });
    manager.update({ sound: { musicVolume: 0.25 }, game: { autoUltimate: true } });
    expect(manager.get()).toMatchObject({ sound: { musicVolume: 0.25 }, game: { autoUltimate: true } }); expect(save).toHaveBeenCalledTimes(1);
    manager.reset(); expect(manager.get()).toEqual(createDefaultSettings()); expect(state.wallet.gold).toBe(77); expect(save).toHaveBeenCalledTimes(2);
  });

  it("전투의 3배속과 자동 궁극기를 다음 판에 복원할 설정으로 함께 저장한다", () => {
    const state = createDefaultSession(); const save = vi.fn(); const manager = new SettingsManager(state, { save });
    manager.update({ game: { battleSpeed: 3, autoUltimate: true, skipUltimatePresentation: true } });
    // 전투 씬은 이 정규화된 스냅샷을 읽으므로 판을 새로 만들어도 두 선택이 유지된다.
    expect(manager.get().game).toMatchObject({ battleSpeed: 3, autoUltimate: true, skipUltimatePresentation: true });
    expect(state.settings.game).toMatchObject({ battleSpeed: 3, autoUltimate: true, skipUltimatePresentation: true });
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
    manager.update({ notifications: { enabled: true, quietHours: false, lastScheduledIds: { staminaFull: "old" } } });
    const request: ScheduledNotification = { id: "stamina-42", kind: "staminaFull", title: "충전 완료", body: "스테미나가 가득 찼습니다.", expiresAt: new Date(Date.now() + 60_000) };
    await expect(manager.scheduleNotification(request)).resolves.toBe("stamina-42"); expect(platform.cancelNotification).toHaveBeenCalledWith("old"); expect(platform.scheduleNotification).toHaveBeenCalledWith(request); expect(manager.get().notifications.lastScheduledIds.staminaFull).toBe("stamina-42");
    await expect(manager.cancelNotification("staminaFull")).resolves.toBe(true); expect(manager.get().notifications.lastScheduledIds.staminaFull).toBeUndefined();
  });

  it("자정을 넘는 야간 제한과 같은 날 제한을 종료 시각으로 미룬다", () => {
    // 제한 밖은 원래 시각을 보존하고 시작=종료는 하루 전체가 아닌 빈 구간이다.
    expect(adjustForQuietHours(new Date("2026-09-09T23:30:00"), true, "22:00", "08:00")).toEqual(new Date("2026-09-10T08:00:00"));
    expect(adjustForQuietHours(new Date("2026-09-09T06:30:00"), true, "22:00", "08:00")).toEqual(new Date("2026-09-09T08:00:00"));
    expect(adjustForQuietHours(new Date("2026-09-09T14:00:00"), true, "13:00", "15:00")).toEqual(new Date("2026-09-09T15:00:00"));
    expect(adjustForQuietHours(new Date("2026-09-09T12:00:00"), true, "12:00", "12:00")).toEqual(new Date("2026-09-09T12:00:00"));
    expect(nextUtcDay(new Date("2026-12-31T23:59:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("구형 미지원 알림 키와 예약 ID를 정규화에서 폐기한다", () => {
    const notifications = normalizeSettings({ notifications: { freeRecruit: true, event: true, mail: true, lastScheduledIds: { staminaFull: "ok", freeRecruit: "old", event: "old" } } }).notifications;
    expect(notifications).not.toHaveProperty("freeRecruit"); expect(notifications).not.toHaveProperty("event"); expect(notifications).not.toHaveProperty("mail");
    expect(notifications.lastScheduledIds).toEqual({ staminaFull: "ok" });
  });

  it("알림 설정 비활성화와 권한 거부에서는 예약하지 않는다", async () => {
    const state = createDefaultSession(); const denied = fakePlatform("denied"); const manager = new SettingsManager(state, { save: vi.fn() }, denied);
    const request: ScheduledNotification = { id: "daily", kind: "dailyMission", title: "임무", body: "마감", expiresAt: new Date(Date.now() + 1000) };
    await expect(manager.scheduleNotification(request)).resolves.toBeNull(); expect(denied.scheduleNotification).not.toHaveBeenCalled();
    manager.update({ notifications: { enabled: true } }); await expect(manager.scheduleNotification(request)).resolves.toBeNull(); expect(denied.scheduleNotification).not.toHaveBeenCalled();
  });
});
