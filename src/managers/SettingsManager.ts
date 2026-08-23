import { createDefaultSettings, normalizeSettings } from "../core/settings";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type GameSettings, type Session } from "../state/session";
import { platformFeedback, type HapticPattern, type PlatformFeedback, type ScheduledNotification } from "../api/PlatformFeedback";

/** 설정 변경자가 저장과 알림을 빠뜨리지 않도록 한 공개 변경 경계다. */
export class SettingsManager extends EventTarget {
  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager, private readonly platform: PlatformFeedback = platformFeedback) { super(); }

  /** 외부 참조로 세션이 변경되지 않도록 정규화된 독립 스냅샷을 반환한다. */
  get(): GameSettings { return normalizeSettings(this.state.settings); }

  /** 섹션 단위 부분 변경을 합친 뒤 보정·저장·이벤트를 항상 같은 순서로 수행한다. */
  update(patch: { [K in keyof GameSettings]?: Partial<GameSettings[K]> }): GameSettings {
    const merged = Object.fromEntries(Object.entries(this.get()).map(([key, value]) => [key, { ...value, ...(patch[key as keyof GameSettings] ?? {}) }])) as unknown as GameSettings;
    this.state.settings = normalizeSettings(merged);
    this.saves.save(this.state);
    this.dispatchEvent(new CustomEvent<GameSettings>("change", { detail: this.get() }));
    return this.get();
  }

  /** 진행 데이터에는 손대지 않고 환경설정만 초기 상태로 되돌린다. */
  reset(): GameSettings { this.state.settings = createDefaultSettings(); this.saves.save(this.state); this.dispatchEvent(new CustomEvent<GameSettings>("change", { detail: this.get() })); return this.get(); }

  /** 개별/전체 설정이 모두 켜진 경우에만 의미 기반 햅틱을 플랫폼으로 전달한다. */
  haptic(pattern: HapticPattern): boolean {
    const v = this.get().vibration;
    const allowed = v.enabled && ({ uiTap: v.uiInput, battleHit: v.combatHit, ultimateReady: v.ultimate, rareExcavation: v.excavationResult })[pattern];
    return allowed ? this.platform.haptic(pattern) : false;
  }

  /** 단순 토글과 분리된 명시적 확인 동작만 브라우저 권한을 요청한다. */
  async confirmNotifications(): Promise<boolean> {
    const permission = this.platform.getNotificationPermission();
    const resolved = permission === "default" ? await this.platform.requestNotificationPermission() : permission;
    this.update({ notifications: { enabled: resolved === "granted" } });
    return resolved === "granted";
  }

  /** 콘텐츠 시스템이 계산한 실제 만료 시각을 그대로 예약하고 마지막 ID를 저장한다. */
  async scheduleNotification(notification: ScheduledNotification): Promise<string | null> {
    const settings = this.get(); const previous = settings.notifications.lastScheduledIds[notification.kind];
    if (!settings.notifications.enabled || !settings.notifications[notification.kind]) {
      if (previous) await this.platform.cancelNotification(previous);
      return null;
    }
    if (this.platform.getNotificationPermission() !== "granted") return null;
    if (previous) await this.platform.cancelNotification(previous);
    const id = await this.platform.scheduleNotification(notification);
    this.update({ notifications: { lastScheduledIds: { ...settings.notifications.lastScheduledIds, ...(id ? { [notification.kind]: id } : {}) } } });
    return id;
  }

  /** 설정 해제나 콘텐츠 갱신 시 저장된 예약 식별자까지 함께 정리한다. */
  async cancelNotification(kind: ScheduledNotification["kind"]): Promise<boolean> {
    const settings = this.get(); const id = settings.notifications.lastScheduledIds[kind]; if (!id) return false;
    const cancelled = await this.platform.cancelNotification(id); const next = { ...settings.notifications.lastScheduledIds }; delete next[kind];
    this.update({ notifications: { lastScheduledIds: next } }); return cancelled;
  }
}

/** 모든 씬이 공유하는 단일 설정 진입점이다. */
export const settingsManager = new SettingsManager();
