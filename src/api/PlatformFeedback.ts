/** 게임이 노출하는 의미 기반 햅틱 이름이다. 화면은 밀리초 배열을 알 필요가 없다. */
export type HapticPattern = "uiTap" | "battleHit" | "ultimateReady" | "rareExcavation";

/** 브라우저 권한과 미지원 상태를 한 계약으로 표현한다. */
export type NotificationPermission = "default" | "granted" | "denied" | "unsupported";

/** 실제 만료 시각을 포함하는 로컬 알림 예약 요청이다. */
export interface ScheduledNotification {
  id: string;
  kind: "staminaFull" | "freeRecruit" | "dailyMission";
  title: string;
  body: string;
  expiresAt: Date;
}

/** 씬과 브라우저/네이티브 기능을 분리하는 플랫폼 피드백 경계다. */
export interface PlatformFeedback {
  readonly notificationScheduling: "persistent" | "foreground-only" | "unsupported";
  haptic(pattern: HapticPattern): boolean;
  getNotificationPermission(): NotificationPermission;
  requestNotificationPermission(): Promise<NotificationPermission>;
  scheduleNotification(notification: ScheduledNotification): Promise<string | null>;
  cancelNotification(id: string): Promise<boolean>;
}

/** 진동 길이는 이 어댑터만 소유해 UI에 기기 단위가 새지 않게 한다. */
const HAPTICS: Readonly<Record<HapticPattern, readonly number[]>> = {
  uiTap: [12], battleHit: [18, 24, 26], ultimateReady: [35, 30, 70], rareExcavation: [30, 25, 30, 25, 90],
};

/** 웹 프로토타입 구현이다. 타이머는 탭이 살아 있는 동안만 유효하다. */
export class BrowserPlatformFeedback implements PlatformFeedback {
  readonly notificationScheduling = typeof globalThis.Notification === "undefined" ? "unsupported" : "foreground-only" as const;
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();

  /** API가 없거나 브라우저가 호출을 거절하면 예외를 전파하지 않는 폴백이다. */
  haptic(pattern: HapticPattern): boolean {
    const vibrate = globalThis.navigator?.vibrate?.bind(globalThis.navigator);
    if (!vibrate) return false;
    try { return vibrate([...HAPTICS[pattern]]); } catch { return false; }
  }

  /** 조회는 팝업을 만들지 않으며 권한 요청과 의도적으로 분리한다. */
  getNotificationPermission(): NotificationPermission {
    return typeof globalThis.Notification === "undefined" ? "unsupported" : globalThis.Notification.permission;
  }

  /** 명시적인 사용자 확인 흐름에서만 호출해야 하는 권한 요청이다. */
  async requestNotificationPermission(): Promise<NotificationPermission> {
    if (typeof globalThis.Notification === "undefined") return "unsupported";
    try { return await globalThis.Notification.requestPermission(); } catch { return "denied"; }
  }

  /** 영구 백그라운드를 가장하지 않고 현재 탭의 실제 만료 시각에만 알린다. */
  async scheduleNotification(notification: ScheduledNotification): Promise<string | null> {
    if (this.getNotificationPermission() !== "granted") return null;
    await this.cancelNotification(notification.id);
    const delay = notification.expiresAt.getTime() - Date.now();
    if (!Number.isFinite(delay) || delay <= 0) return null;
    const timer = setTimeout(() => {
      this.timers.delete(notification.id);
      try { new Notification(notification.title, { body: notification.body, tag: notification.id }); } catch { /* 알림 생성 실패도 게임 진행을 막지 않는다. */ }
    }, delay);
    this.timers.set(notification.id, timer);
    return notification.id;
  }

  /** 이미 사라진 예약 취소는 false로 조용히 끝낸다. */
  async cancelNotification(id: string): Promise<boolean> {
    const timer = this.timers.get(id); if (!timer) return false;
    clearTimeout(timer); this.timers.delete(id); return true;
  }
}

/** 런타임 전체가 공유하는 기본 브라우저 어댑터다. */
export const platformFeedback: PlatformFeedback = new BrowserPlatformFeedback();
