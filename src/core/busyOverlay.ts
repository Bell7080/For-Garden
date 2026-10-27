/**
 * 기다림 오버레이(`src/ui/BusyOverlay.ts`)의 타이밍 규칙. Phaser를 읽지 않는 순수 모듈이다.
 *
 * 응답이 곧바로 오는 요청마다 어두운 막이 번쩍이면 로딩이 아니라 깜빡임으로 읽힌다. 그래서
 * 일정 시간이 지나도 끝나지 않은 요청에만 막을 세우고, 한 번 섰으면 막이 번쩍 사라지지 않도록
 * 최소한 머문다.
 */
export const BUSY_OVERLAY = {
  /** 이 시간 안에 끝나는 요청에는 막을 세우지 않는다(ms). */
  showDelayMs: 250,
  /** 한 번 선 막이 사라지기 전에 최소로 머무는 시간(ms). */
  minVisibleMs: 450,
  /** 막이 나타나고 사라지는 시간(ms). */
  fadeMs: 160,
  /** 막의 진하기. 뒤 화면이 비쳐야 해서 불투명하게 덮지 않는다. */
  dimAlpha: 0.58,
} as const;

export interface BusyState {
  /** 아직 끝나지 않은 요청 수. */
  pending: number;
  /** 막이 서 있는 동안 선 시각(ms). 서 있지 않으면 null. */
  shownAt: number | null;
}

export const initialBusyState: BusyState = { pending: 0, shownAt: null };

export function beginBusy(state: BusyState): BusyState {
  return { ...state, pending: state.pending + 1 };
}

export function endBusy(state: BusyState): BusyState {
  return { ...state, pending: Math.max(0, state.pending - 1) };
}

/** 지연이 지난 뒤에도 요청이 남아 있을 때만 막을 세운다. */
export function shouldShowBusy(state: BusyState): boolean {
  return state.pending > 0 && state.shownAt === null;
}

export function markBusyShown(state: BusyState, now: number): BusyState {
  return { ...state, shownAt: now };
}

/** 막을 내려도 되는 순간까지 남은 시간(ms). 서 있지 않거나 요청이 남아 있으면 null이다. */
export function busyHideDelay(state: BusyState, now: number): number | null {
  if (state.pending > 0 || state.shownAt === null) return null;
  return Math.max(0, state.shownAt + BUSY_OVERLAY.minVisibleMs - now);
}

export function markBusyHidden(state: BusyState): BusyState {
  return { ...state, shownAt: null };
}
