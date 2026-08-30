import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { deriveNotificationState, EMPTY_NOTIFICATION_STATE, type NotificationKey, type NotificationState } from "../core/notifications";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";

/** API별 상태를 한 번 합성하고 키별 변경만 씬에 배포하는 알림 상태의 단일 소유자다. */
export class NotificationManager {
  private state: NotificationState = EMPTY_NOTIFICATION_STATE;
  private refreshGeneration = 0;

  constructor(private readonly api: GameApi, private readonly events: ManagerEvents = managerEvents) {}

  /** 구독 즉시 현재 값을 전달해 씬이 별도 초기 조회를 만들지 않게 한다. */
  subscribe(key: NotificationKey, listener: (visible: boolean) => void): () => void {
    let previous = this.state[key]; listener(previous);
    return this.events.subscribe("notification", ({ state }) => {
      this.state = { ...state };
      // manager 전체 스냅샷이 발행되어도 해당 키가 달라진 UI만 다시 그린다.
      if (state[key] === previous) return; previous = state[key]; listener(previous);
    });
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
    // 전체 조회 결과도 같은 manager 이벤트 계약으로 발행해 UI 구독 경로를 하나로 유지한다.
    this.state = next; this.events.publishNotification(next);
  }
}

/** 런타임의 모든 씬이 같은 스냅샷과 변경 이벤트를 공유하는 공개 인스턴스다. */
export const notificationManager = new NotificationManager(gameApi);
