import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { deriveNotificationState, EMPTY_NOTIFICATION_STATE, type NotificationKey, type NotificationState } from "../core/notifications";

/** API별 상태를 한 번 합성하고 키별 변경만 씬에 배포하는 알림 상태의 단일 소유자다. */
export class NotificationManager {
  private state: NotificationState = EMPTY_NOTIFICATION_STATE;
  private listeners = new Map<NotificationKey, Set<(visible: boolean) => void>>();
  private refreshGeneration = 0;

  constructor(private readonly api: GameApi) {}

  /** 구독 즉시 현재 값을 전달해 씬이 별도 초기 조회를 만들지 않게 한다. */
  subscribe(key: NotificationKey, listener: (visible: boolean) => void): () => void {
    const listeners = this.listeners.get(key) ?? new Set();
    listeners.add(listener); this.listeners.set(key, listeners); listener(this.state[key]);
    return () => listeners.delete(listener);
  }

  /** 서로 독립된 계약을 병렬 조회하되 최신 refresh만 상태를 확정한다. */
  async refresh(): Promise<void> {
    const generation = ++this.refreshGeneration;
    const [missions, excavation, signals] = await Promise.all([
      this.api.getMissions(), this.api.getIdleExcavation(), this.api.getNotificationSignals(),
    ]);
    if (generation !== this.refreshGeneration) return;
    const next = deriveNotificationState({
      claimableMissionCount: missions.claimableCount,
      excavationStorageFull: excavation.storageFull === true,
      pendingFriendRequestCount: signals.pendingFriendRequestCount,
      unseenEventCount: signals.unseenEventCount,
      unreadMailCount: signals.unreadMailCount,
    });
    for (const key of Object.keys(next) as NotificationKey[]) {
      if (next[key] === this.state[key]) continue;
      this.state = { ...this.state, [key]: next[key] };
      this.listeners.get(key)?.forEach((listener) => listener(next[key]));
    }
  }
}

/** 런타임의 모든 씬이 같은 스냅샷과 변경 이벤트를 공유하는 공개 인스턴스다. */
export const notificationManager = new NotificationManager(gameApi);
