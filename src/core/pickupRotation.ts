/**
 * 한정 픽업 교대 — 호박석 픽업 배너는 **한 번에 하나만** 선다(응태 결정, 2026-11-14).
 *
 * 디안 픽업(`amber`)과 플레샤 픽업(`moonlit`)이 나란히 서 있던 것을 걷고, 정해 둔 길이마다 차례로 갈아 끼운다 —
 * 지금은 플레샤, 그 기간이 지나면 다시 디안이다. 정의의 끝 날짜(`endsAt`)로 내리지 않는 이유는 출시 전 유예
 * (`launchAnchor.ts`)가 끝 날짜를 걷기 때문이다 — 교대는 그 유예와 상관없이 돈다.
 *
 * **천장은 교대해도 이어진다**(같은 날 결정) — 두 배너가 같은 천장 그룹(`PITY_GROUP.LIMITED_PICKUP`)을 쓰므로 한 픽업에서
 * 쌓은 천장과 픽업 확정이 다음 픽업으로 넘어간다.
 *
 * 운영 일정(`live_schedule`)에 그 배너의 줄이 있으면 사람이 정한 기간이 이 교대를 덮는다(`bannerActive`).
 * 화면(연구소·로비 카드)과 서버(연구 확정)가 같은 함수를 읽어 보인 픽업과 받아 주는 픽업이 갈리지 않는다.
 */
const DAY_MS = 86_400_000;

export interface PickupRotation {
  /** 첫 차례가 시작한 시각(UTC 자정 — 다른 일일 갱신과 같은 오전 9시). */
  readonly anchor: number;
  /** 한 차례의 길이(일). */
  readonly periodDays: number;
  /** 차례 순서. 첫 칸이 `anchor`부터 선다. */
  readonly bannerIds: readonly string[];
}

/** 2026-11-13 09:00(KST)부터 플레샤 3주 → 디안 3주 → … (디안 임시 운영이 3주를 넘겨 플레샤로 넘어간다). */
export const PICKUP_ROTATION: PickupRotation = {
  anchor: Date.parse("2026-11-13T00:00:00Z"),
  periodDays: 21,
  bannerIds: ["moonlit", "amber"],
};

export function inPickupRotation(bannerId: string, rotation: PickupRotation = PICKUP_ROTATION): boolean {
  return rotation.bannerIds.includes(bannerId);
}

/** 지금 몇 번째 차례인가(교대 시작 전도 음수로 센다). */
function turnIndex(now: number, rotation: PickupRotation): number {
  return Math.floor((now - rotation.anchor) / (rotation.periodDays * DAY_MS));
}

/**
 * 지금 차례인 픽업 배너 ID. **교대가 시작하기 전에는 마지막 칸(디안)이 서 있었다** — 플레샤 픽업이 열리기 전의 임시 운영이
 * 디안 하나였기 때문이다.
 */
export function currentPickupBannerId(now: number, rotation: PickupRotation = PICKUP_ROTATION): string {
  const length = rotation.bannerIds.length;
  const turn = turnIndex(now, rotation);
  return turn < 0 ? rotation.bannerIds[length - 1] : rotation.bannerIds[turn % length];
}

/** 지금 차례의 기간(시작 포함 · 종료 제외). 화면의 남은 시간이 이 값을 읽는다. 교대 전은 교대가 시작하는 시각에 끝난다. */
export function currentPickupWindow(now: number, rotation: PickupRotation = PICKUP_ROTATION): { readonly startsAt?: string; readonly endsAt: string } {
  if (turnIndex(now, rotation) < 0) return { endsAt: new Date(rotation.anchor).toISOString() };
  const start = rotation.anchor + turnIndex(now, rotation) * rotation.periodDays * DAY_MS;
  return { startsAt: new Date(start).toISOString(), endsAt: new Date(start + rotation.periodDays * DAY_MS).toISOString() };
}

/** 교대에 든 배너가 지금 서는가. 교대에 들지 않은 배너는 막지 않는다. */
export function pickupRotationOpen(bannerId: string, now: number, rotation: PickupRotation = PICKUP_ROTATION): boolean {
  return !inPickupRotation(bannerId, rotation) || currentPickupBannerId(now, rotation) === bannerId;
}
