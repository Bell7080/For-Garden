import type { ProductRefresh } from "../data/products";

/**
 * 상점 구매 한도가 되살아나는 시각 계산.
 *
 * **서버의 주기 키(`FakeServer.productPeriodKey`)와 같은 경계를 쓴다** — 일간은 UTC 자정, 주간은
 * UTC 월요일 자정, 월간은 UTC 달의 첫날 자정이다. 화면이 따로 경계를 정하면 표시가 0이 되는
 * 순간과 실제로 횟수가 돌아오는 순간이 갈린다.
 */
const DAY_MS = 86_400_000;

/** 영구·계정 제한은 되살아나지 않으므로 주기가 없다. */
export type ResettingRefresh = Extract<ProductRefresh, "daily" | "weekly" | "monthly">;

/** 짧은 주기일수록 앞선다 — 한 탭에 주기가 섞이면 가장 먼저 돌아오는 쪽을 알린다. */
const CADENCE_ORDER: readonly ResettingRefresh[] = ["daily", "weekly", "monthly"];

/** 상품 목록에서 가장 짧은 주기. 되살아나는 상품이 하나도 없으면 `undefined`. */
export function shortestRefresh(refreshes: readonly ProductRefresh[]): ResettingRefresh | undefined {
  return CADENCE_ORDER.find((cadence) => refreshes.includes(cadence));
}

/** 그 주기가 `nowMs` 다음에 되살아나는 시각(ms). */
export function nextRefreshAt(refresh: ResettingRefresh, nowMs: number): number {
  const now = new Date(nowMs);
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (refresh === "daily") return midnight + DAY_MS;
  if (refresh === "weekly") return midnight + (7 - ((now.getUTCDay() + 6) % 7)) * DAY_MS;
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1);
}

/**
 * `D6:23:48:12` 꼴의 남은 시간(일:시:분:초).
 *
 * 일간은 `D00:`, 주간은 한 자리, 월간은 두 자리 — 일 자리 폭만으로 어느 주기의 시계인지 읽힌다.
 * 초까지 적으므로 1초마다 글자가 바뀐다(`D00:23:48:12`).
 */
export function formatRefreshCountdown(refresh: ResettingRefresh, nowMs: number): string {
  const remain = Math.max(0, nextRefreshAt(refresh, nowMs) - nowMs);
  const totalSeconds = Math.floor(remain / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  const seconds = totalSeconds % 60;
  const pad = (value: number, width: number): string => String(value).padStart(width, "0");
  return `D${pad(days, refresh === "weekly" ? 1 : 2)}:${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`;
}
