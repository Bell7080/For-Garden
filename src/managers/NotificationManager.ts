import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { deriveNotificationState, EMPTY_NOTIFICATION_STATE, type NotificationKey, type NotificationState } from "../core/notifications";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";

/** API별 상태를 한 번 합성하고 키별 변경만 씬에 배포하는 알림 상태의 단일 소유자다. */
export class NotificationManager {
  private state: NotificationState = EMPTY_NOTIFICATION_STATE;
  private refreshGeneration = 0;

  private refreshQueued = false;

  constructor(private readonly api: GameApi, private readonly events: ManagerEvents = managerEvents) {
    // 받을 임무 보상 수가 바뀌면 곧바로 다시 읽는다 — 로비 판 위에서 급여·수확으로 임무가 차도 점이 선다.
    api.subscribeMissionNotice?.(() => this.queueRefresh());
  }

  /** 한 처리에서 저장이 여러 번 일어나도 한 번만 다시 읽는다. 실패는 기존 상태를 둔다. */
  private queueRefresh(): void {
    if (this.refreshQueued) return;
    this.refreshQueued = true;
    queueMicrotask(() => { this.refreshQueued = false; void this.refresh().catch(() => undefined); });
  }

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
    // **하나가 실패해도 나머지는 확정한다.** 셋을 한꺼번에 기다리던 때는 발굴·알림 조회 하나가 실패하면
    // 받을 임무가 있는데도 임무 점까지 통째로 꺼진 채 남았다. 실패한 쪽만 지난 값을 둔다.
    const [missions, excavation, signals] = await Promise.allSettled([
      this.api.getMissions(), this.api.getIdleExcavation(), this.api.getNotificationSignals(),
    ]);
    if (generation !== this.refreshGeneration) return;
    const previous = this.state;
    const next = deriveNotificationState({
      claimableMissionCount: missions.status === "fulfilled" ? missions.value.claimableCount : Number(previous.missionReward),
      // 서버가 정수 수확 가능성까지 확정하므로 클라이언트는 비율을 재계산하지 않는다.
      excavationHarvestReady: excavation.status === "fulfilled" ? excavation.value.harvestNotice : previous.excavationHarvestReady,
      pendingFriendRequestCount: signals.status === "fulfilled" ? signals.value.pendingFriendRequestCount : Number(previous.friendRequest),
      unseenEventCount: signals.status === "fulfilled" ? signals.value.unseenEventCount : Number(previous.newEvent),
      unreadMailCount: signals.status === "fulfilled" ? signals.value.unreadMailCount : Number(previous.mail),
    });
    // 전체 조회 결과도 같은 manager 이벤트 계약으로 발행해 UI 구독 경로를 하나로 유지한다.
    this.state = next; this.events.publishNotification(next);
  }
}

/** 런타임의 모든 씬이 같은 스냅샷과 변경 이벤트를 공유하는 공개 인스턴스다. */
export const notificationManager = new NotificationManager(gameApi);
