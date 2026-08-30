import type { MailListResponse } from "../api/contracts";
import type { NotificationState } from "../core/notifications";
import { EMPTY_NOTIFICATION_STATE } from "../core/notifications";
import type { Wallet } from "../core/gacha";
import type { PlayerProfileDisplay } from "../state/playerProfile";

/** UI가 API DTO를 해석하지 않도록 manager가 확정한 네 종류의 읽기 모델만 노출한다. */
export interface ManagerEventMap {
  wallet: { readonly wallet: Readonly<Wallet> };
  inventory: { readonly revision: number };
  publicProfile: { readonly profile: PlayerProfileDisplay };
  notification: { readonly state: Readonly<NotificationState> };
  mail: { readonly list: MailListResponse };
}

/** 구독 해제 함수를 계약에 포함한 작은 동기 이벤트 허브다. 한 API 영수증의 이벤트는 같은 tick에 발행된다. */
export class ManagerEvents {
  private readonly listeners = new Map<keyof ManagerEventMap, Set<(payload: never) => void>>();
  private inventoryRevision = 0;
  private notificationState: NotificationState = EMPTY_NOTIFICATION_STATE;

  /** 소유자가 닫힐 때 보관했다 호출할 수 있는 멱등 해제 함수를 반환한다. */
  subscribe<K extends keyof ManagerEventMap>(type: K, listener: (payload: ManagerEventMap[K]) => void): () => void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener as (payload: never) => void); this.listeners.set(type, listeners);
    return () => { listeners.delete(listener as (payload: never) => void); };
  }

  /** 검증을 마친 manager만 호출하며, 변경 가능한 응답 객체는 구독자 사이에 공유하지 않는다. */
  publish<K extends keyof ManagerEventMap>(type: K, payload: ManagerEventMap[K]): void {
    this.listeners.get(type)?.forEach((listener) => listener(structuredClone(payload) as never));
  }

  /** 인벤토리 UI에는 서버 행 대신 재조회 신호만 주어 Session 기반 표시 모델 경계를 지킨다. */
  publishInventory(): void { this.publish("inventory", { revision: ++this.inventoryRevision }); }

  /** 전체 알림 조회와 우편 영수증이 공유하는 최신 알림 스냅샷을 교체한다. */
  publishNotification(state: NotificationState): void { this.notificationState = { ...state }; this.publish("notification", { state }); }

  /** 우편 응답은 자신이 확정한 키만 바꾸고 임무·발굴 등 다른 manager의 값을 보존한다. */
  publishMailNotification(visible: boolean): void { this.publishNotification({ ...this.notificationState, mail: visible }); }
}

/** 씬과 팝업이 동일한 manager 이벤트 스트림을 공유하는 런타임 인스턴스다. */
export const managerEvents = new ManagerEvents();
