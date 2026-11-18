import type { GameApi } from "../api/contracts";
import { gameApi } from "../api/FakeServer";
import { deriveNotificationState, EMPTY_NOTIFICATION_STATE, type NotificationKey, type NotificationState } from "../core/notifications";
import { session } from "../state/session";
import { onAccountSwitch } from "../core/accountScope";
import { managerEvents, type ManagerEvents } from "./ManagerEvents";

const FREE_CATEGORIES = ["daily", "weekly", "monthly"] as const;
const FREE_KEYS = ["premiumFreeDaily", "premiumFreeWeekly", "premiumFreeMonthly"] as const;

/** API별 상태를 한 번 합성하고 키별 변경만 씬에 배포하는 알림 상태의 단일 소유자다. */
export class NotificationManager {
  private state: NotificationState = EMPTY_NOTIFICATION_STATE;
  private refreshGeneration = 0;

  private refreshQueued = false;
  /** 지금 서버에 나가 있는 조회. 겹친 요청은 새로 보내지 않고 끝난 뒤 한 번만 다시 읽는다. */
  private refreshRunning?: Promise<void>;
  private refreshFollowUp?: { light: boolean; readonly promise: Promise<void> };

  constructor(private readonly api: GameApi, private readonly events: ManagerEvents = managerEvents) {
    // 받을 임무 보상 수가 바뀌면 곧바로 다시 읽는다 — 로비 판 위에서 급여·수확으로 임무가 차도 점이 선다.
    api.subscribeMissionNotice?.(() => this.queueRefresh());
    events.subscribe("inventory", () => this.queueRefresh());
    // 계정이 바뀌면 앞 계정의 점을 지우고 새 계정으로 다시 읽는다.
    onAccountSwitch(() => { this.state = EMPTY_NOTIFICATION_STATE; this.refreshGeneration += 1; this.queueRefresh(); });
    // 부분 영수증(우편 등)도 구독 UI의 유무와 무관하게 다음 조회의 기준 상태로 보관한다.
    events.subscribe("notification", ({ state }) => { this.state = { ...state }; this.refreshGeneration += 1; });
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

  /**
   * 서로 독립된 계약을 병렬 조회하되 최신 refresh만 상태를 확정한다.
   *
   * **조회 하나가 나가 있는 동안 새 조회를 겹쳐 보내지 않는다.** 이 조회들은 서버에서 같은 계정의 저장을
   * 거치므로 겹치면 같은 계정 잠금을 두고 서로 기다린다. 응답이 15초를 넘던 날, 씬 시계·실시간 폴링·저장
   * 신호가 끝나지 않은 조회 위에 계속 새 조회를 얹어 한 사람의 요청이 연결 풀을 다 먹었다(2026-11-18 운영 로그).
   * 겹친 요청은 지금 조회가 끝난 뒤 **한 번만** 다시 읽는다 — 그사이 바뀐 값은 그 한 번이 가져온다.
   */
  refresh(options: { readonly light?: boolean } = {}): Promise<void> {
    const light = options.light === true;
    if (!this.refreshRunning) return this.startRefresh(light);
    if (this.refreshFollowUp) {
      if (!light) this.refreshFollowUp.light = false;
      return this.refreshFollowUp.promise;
    }
    const running = this.refreshRunning;
    const followUp: { light: boolean; promise: Promise<void> } = { light, promise: Promise.resolve() };
    followUp.promise = running.catch(() => undefined).then(() => {
      this.refreshFollowUp = undefined;
      return this.refresh({ light: followUp.light });
    });
    this.refreshFollowUp = followUp;
    return followUp.promise;
  }

  private startRefresh(light: boolean): Promise<void> {
    const run = this.loadNotifications(light).finally(() => { if (this.refreshRunning === run) this.refreshRunning = undefined; });
    this.refreshRunning = run;
    return run;
  }

  private async loadNotifications(light: boolean): Promise<void> {
    const generation = ++this.refreshGeneration;
    // 가벼운 조회(실시간 폴링)는 알림 신호 하나만 묻는다. 임무·발굴은 제 조작이 이미 다시 읽게 한다.
    // **하나가 실패해도 나머지는 확정한다.** 셋을 한꺼번에 기다리던 때는 발굴·알림 조회 하나가 실패하면
    // 받을 임무가 있는데도 임무 점까지 통째로 꺼진 채 남았다. 실패한 쪽만 지난 값을 둔다.
    const [missions, excavation, signals] = await Promise.allSettled([
      light ? Promise.reject(new Error("light")) : this.api.getMissions(),
      light ? Promise.reject(new Error("light")) : this.api.getIdleExcavation(),
      this.api.getNotificationSignals(),
    ]);
    if (generation !== this.refreshGeneration) return;
    const previous = this.state;
    const next = deriveNotificationState({
      claimableRaidCount: signals.status === "fulfilled" ? signals.value.claimableRaidCount ?? 0 : Number(previous.raidReward),
      claimableExpeditionCount: signals.status === "fulfilled" ? signals.value.claimableExpeditionCount ?? 0 : Number(previous.expeditionReward),
      claimableMissionCount: missions.status === "fulfilled" ? missions.value.claimableCount : Number(previous.missionReward),
      // 서버가 정수 수확 가능성까지 확정하므로 클라이언트는 비율을 재계산하지 않는다.
      excavationHarvestReady: excavation.status === "fulfilled" ? excavation.value.harvestNotice : previous.excavationHarvestReady,
      pendingFriendRequestCount: signals.status === "fulfilled" ? signals.value.pendingFriendRequestCount : Number(previous.friendRequest),
      unseenEventCount: signals.status === "fulfilled" ? signals.value.unseenEventCount : Number(previous.newEvent),
      adOnlyEventCount: signals.status === "fulfilled" ? signals.value.adOnlyEventCount ?? 0 : 0,
      showAdDots: session.settings.game.adRewardDot,
      unreadMailCount: signals.status === "fulfilled" ? signals.value.unreadMailCount : Number(previous.mail),
      claimableMailCount: signals.status === "fulfilled" ? signals.value.claimableMailCount ?? 0 : Number(previous.mail),
      claimablePassCount: signals.status === "fulfilled" ? signals.value.claimablePassCount ?? 0 : Number(previous.passReward),
      claimableAchievementCount: signals.status === "fulfilled" ? signals.value.claimableAchievementCount ?? 0 : Number(previous.achievementReward),
      claimableCodexCount: signals.status === "fulfilled" ? signals.value.claimableCodexCount ?? 0 : Number(previous.codexReward),
      freeSupplyCategories: signals.status === "fulfilled" ? signals.value.freeSupplyCategories ?? [] : FREE_CATEGORIES.filter((_, index) => previous[FREE_KEYS[index]]),
      situationalOfferCount: signals.status === "fulfilled" ? signals.value.situationalOfferCount ?? 0 : Number(previous.premiumOffer),
      shopFreeSupply: signals.status === "fulfilled" ? signals.value.shopFreeSupply === true : previous.shopFree,
      freeResearchAvailable: signals.status === "fulfilled" ? signals.value.freeResearchAvailable === true : previous.freeResearch,
      claimableInteractionCount: signals.status === "fulfilled" ? signals.value.claimableInteractionCount ?? 0 : Number(previous.interactionReturned),
      duelSeasonRewardReady: signals.status === "fulfilled" ? signals.value.duelSeasonRewardReady === true : previous.duelSeasonReward,
      claimableSubscriptionBonusCount: signals.status === "fulfilled" ? signals.value.claimableSubscriptionBonusCount ?? 0 : Number(previous.premiumSubscription),
      guildAttendanceReady: signals.status === "fulfilled" ? signals.value.guildAttendanceReady === true : previous.guildAttendance,
      patronClaimable: signals.status === "fulfilled" ? signals.value.patronClaimable === true : previous.patronDaily,
    });
    // 전체 조회 결과도 같은 manager 이벤트 계약으로 발행해 UI 구독 경로를 하나로 유지한다.
    this.state = next; this.events.publishNotification(next);
    // 운영팀 조정은 서버가 응답 상태(session)에 이미 반영했다. 지갑·가방 표시를 갱신하고 안내를 띄운다.
    const notices = signals.status === "fulfilled" ? signals.value.opsNotices : undefined;
    if (notices?.length) {
      this.events.publish("wallet", { wallet: session.wallet });
      this.events.publishInventory();
      this.events.publish("opsNotice", { notices });
    }
  }
}

/** 런타임의 모든 씬이 같은 스냅샷과 변경 이벤트를 공유하는 공개 인스턴스다. */
export const notificationManager = new NotificationManager(gameApi);
