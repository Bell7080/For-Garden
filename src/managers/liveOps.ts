import { notificationManager } from "./NotificationManager";

/** 운영팀 우편·재화 조정이 계정에 닿는 속도다. 서버가 한 분에 180번까지 읽기를 받으므로 한참 못 미친다. */
export const LIVE_OPS_POLL_MS = 15_000;

let timer: ReturnType<typeof setInterval> | undefined;
let removeVisibility: (() => void) | undefined;
let running = false;

const visible = (): boolean => typeof document === "undefined" || document.visibilityState !== "hidden";

function poll(): void {
  if (running || !visible()) return;
  running = true;
  // 실패는 다음 주기가 다시 묻는다. 가벼운 조회는 알림 신호 하나만 부른다.
  void notificationManager.refresh({ light: true }).catch(() => undefined).finally(() => { running = false; });
}

/** 서버에 연결된 뒤 한 번 켠다. 여러 번 불러도 타이머는 하나다. 탭이 숨어 있으면 쉬고 돌아오면 곧바로 읽는다. */
export function startLiveOps(): void {
  if (timer !== undefined) return;
  timer = setInterval(poll, LIVE_OPS_POLL_MS);
  if (typeof document !== "undefined") {
    const onVisible = (): void => { if (visible()) poll(); };
    document.addEventListener("visibilitychange", onVisible);
    removeVisibility = () => document.removeEventListener("visibilitychange", onVisible);
  }
  poll();
}

export function stopLiveOps(): void {
  if (timer !== undefined) clearInterval(timer);
  timer = undefined;
  removeVisibility?.(); removeVisibility = undefined;
}
