import type Phaser from "phaser";
import { createDefaultSettings, normalizeSettings } from "../core/settings";
import { saveManager, type SaveManager } from "../state/SaveManager";
import { session, type GameSettings, type Session } from "../state/session";
import { platformFeedback, type HapticPattern, type PlatformFeedback, type ScheduledNotification } from "../api/PlatformFeedback";
import { setTextScale } from "../ui/textScale";
import { setFontLanguage } from "../ui/fonts";
import { adjustForQuietHours } from "../core/notificationSchedule";
import { applyFrameRateLimit } from "../config/gameConfig";

/** 설정 변경자가 저장과 알림을 빠뜨리지 않도록 한 공개 변경 경계다. */
export class SettingsManager extends EventTarget {
  /** 알림 변경을 한 줄로 세워 느린 플랫폼 취소가 뒤의 사용자 선택보다 늦게 반영되지 않게 한다. */
  private notificationChanges: Promise<void> = Promise.resolve();
  /** 부트가 등록한 Phaser 하나만 보관해 설정 변경을 코어 시계와 분리한다. */
  private runtimeGame?: Phaser.Game;

  constructor(private readonly state: Session = session, private readonly saves: Pick<SaveManager, "save"> = saveManager, private readonly platform: PlatformFeedback = platformFeedback) { super(); }

  /** 외부 참조로 세션이 변경되지 않도록 정규화된 독립 스냅샷을 반환한다. */
  get(): GameSettings { return normalizeSettings(this.state.settings); }

  /** 저장 로드 후와 사용자 변경이 같은 TimeStep 경계를 통과하게 한다. */
  syncRuntime(game: Phaser.Game): void { this.runtimeGame = game; applyFrameRateLimit(game, this.get().presentation.frameRateLimit); }

  /** 섹션 단위 부분 변경을 합친 뒤 보정·저장·이벤트를 항상 같은 순서로 수행한다. */
  update(patch: { [K in keyof GameSettings]?: Partial<GameSettings[K]> }): GameSettings {
    const merged = Object.fromEntries(Object.entries(this.get()).map(([key, value]) => [key, { ...value, ...(patch[key as keyof GameSettings] ?? {}) }])) as unknown as GameSettings;
    this.state.settings = normalizeSettings(merged);
    // 새로 그리는 모든 글자가 공용 스타일 배율을 사용하도록 한곳에서 동기화한다.
    setTextScale(this.state.settings.accessibility.textScale);
    // 글꼴 스택도 같은 저장 경계에서 함께 바뀌어야 한다 — 따로 두면 언어만 바뀌고 글자는 옛 글꼴로 남는다.
    setFontLanguage(this.state.settings.game.language);
    if (this.runtimeGame) applyFrameRateLimit(this.runtimeGame, this.state.settings.presentation.frameRateLimit);
    this.saves.save(this.state);
    this.dispatchEvent(new CustomEvent<GameSettings>("change", { detail: this.get() }));
    return this.get();
  }

  /** 진행 데이터와 계정 표시 상태에는 손대지 않고 사용자가 조정하는 환경설정만 기본값으로 되돌린다. */
  reset(): GameSettings {
    // 계정 연결은 환경설정이 아니므로 기본 게스트 값으로 덮지 않고 현재의 공개 표시 정보만 보존한다.
    const account = { ...this.get().account };
    this.state.settings = { ...createDefaultSettings(), account };
    // 씬을 다시 그리기 전에도 이후 생성되는 글자가 즉시 기본 배율을 사용하도록 공용 배율을 먼저 맞춘다.
    setTextScale(this.state.settings.accessibility.textScale);
    // 글꼴 스택도 같은 저장 경계에서 함께 바뀌어야 한다 — 따로 두면 언어만 바뀌고 글자는 옛 글꼴로 남는다.
    setFontLanguage(this.state.settings.game.language);
    if (this.runtimeGame) applyFrameRateLimit(this.runtimeGame, this.state.settings.presentation.frameRateLimit);
    this.saves.save(this.state);
    this.dispatchEvent(new CustomEvent<GameSettings>("change", { detail: this.get() }));
    return this.get();
  }

  /**
   * 개별/전체 설정이 모두 켜진 경우에만 의미 기반 햅틱을 플랫폼으로 전달한다.
   * 이 메서드는 런타임의 유일한 진동 게이트다. 씬과 UI는 `PlatformFeedback.haptic`을 직접
   * 호출하지 않아야 하며, 미지원 플랫폼의 false 반환도 성공으로 바꾸지 않고 그대로 돌려준다.
   */
  haptic(pattern: HapticPattern): boolean {
    const v = this.get().vibration;
    const allowed = v.enabled && ({ uiTap: v.uiInput, battleHit: v.combatHit, ultimateReady: v.ultimate, rareExcavation: v.excavationResult })[pattern];
    return allowed ? this.platform.haptic(pattern) : false;
  }

  /** 단순 토글과 분리된 명시적 확인 동작만 브라우저 권한을 요청한다. */
  async confirmNotifications(): Promise<boolean> {
    const permission = this.platform.getNotificationPermission();
    const resolved = permission === "default" ? await this.platform.requestNotificationPermission() : permission;
    await this.updateNotificationPreferences({ enabled: resolved === "granted" });
    return resolved === "granted";
  }

  /**
   * 알림 선택 저장과 이미 등록된 플랫폼 예약 해제를 직렬화하는 전용 변경 경계다.
   * 조용한 시간 및 시작·종료 시각 변경에는 원래 만료 시각이 저장되어 있지 않으므로 기존 ID로
   * 시각을 추측해 재예약하지 않는다. 해당 변경은 콘텐츠 소유자가 다음 예약을 만들 때부터 적용한다.
   */
  updateNotificationPreferences(patch: Partial<Omit<GameSettings["notifications"], "lastScheduledIds">>): Promise<GameSettings> {
    let result!: GameSettings;
    const apply = async (): Promise<void> => {
      const previous = this.get().notifications;
      result = this.update({ notifications: patch });
      const current = result.notifications;
      const kinds: ScheduledNotification["kind"][] = ["staminaFull", "dailyMission"];
      // 전체 OFF는 두 종류를, 개별 ON→OFF는 그 종류만 정리한다.
      const targets = !current.enabled
        ? kinds
        : kinds.filter(kind => previous[kind] && !current[kind]);
      for (const kind of targets) await this.cancelNotification(kind);
      result = this.get();
    };
    // 앞 작업이 실패해도 큐를 복구해 이후 사용자의 선택이 막히지 않게 한다.
    const queued = this.notificationChanges.then(apply, apply);
    this.notificationChanges = queued.then(() => undefined, () => undefined);
    return queued.then(() => result);
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
    // 조용한 시간에는 알림을 버리지 않고 사용자가 정한 종료 시각으로 순수하게 이동한다.
    const expiresAt = adjustForQuietHours(notification.expiresAt, settings.notifications.quietHours, settings.notifications.quietHoursStart, settings.notifications.quietHoursEnd);
    const id = await this.platform.scheduleNotification({ ...notification, expiresAt });
    this.update({ notifications: { lastScheduledIds: { ...settings.notifications.lastScheduledIds, ...(id ? { [notification.kind]: id } : {}) } } });
    return id;
  }

  /** 설정 해제나 콘텐츠 갱신 시 저장된 예약 식별자까지 함께 정리한다. */
  async cancelNotification(kind: ScheduledNotification["kind"]): Promise<boolean> {
    const settings = this.get(); const id = settings.notifications.lastScheduledIds[kind]; if (!id) return false;
    const cancelled = await this.platform.cancelNotification(id);
    // 실패한 ID는 재시도할 수 있게 남기고, 대기 중 새 예약이 같은 종류를 대체했다면 새 ID도 보존한다.
    if (!cancelled || this.get().notifications.lastScheduledIds[kind] !== id) return cancelled;
    const next = { ...this.get().notifications.lastScheduledIds }; delete next[kind];
    this.update({ notifications: { lastScheduledIds: next } }); return true;
  }
}

/** 모든 씬이 공유하는 단일 설정 진입점이다. */
export const settingsManager = new SettingsManager();
