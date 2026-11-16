/*
 * 후원 지층 — 결제 누적 등급(VIP)을 세계관 말로 옮긴 것(응태 결정 2026-11-16 · 설계
 * `analysis/vip-patron-strata-design-2026-11-16.md`).
 *
 * - 쌓이는 값은 「복원 기금」이다. 「마일리지」는 DNA 마일리지가 이미 쓰는 말이라 쓰지 않는다.
 * - 플랫폼 결제 ₩100마다 기금 1, 매일 후원 보급을 받을 때마다 기금 1(무료 몫 — 상한 없음, 「어차피 못 닿는다」).
 * - 등급은 무료 몫 + 결제 몫의 합이 정하고 내려가지 않는다(환불만 결제 몫을 깎는다).
 * - 혜택은 전투·경제 배율이 아니라 매일 보급 · 승급 기념품(한 번) · 치장(테두리·수식어)뿐이다. 다른 사람에게 등급을 보이지 않는다.
 *
 * 상태는 업적 저장(`AchievementState.patron`) 안에 산다 — 새 저장 필드·DB 표 없이 저장 왕복을 그대로 탄다.
 * 이 파일은 `achievementState.ts`가 읽으므로 무거운 데이터 표를 끌어오지 않는다.
 */

import { PATRON_TIERS, type PatronTierDefinition, type PatronTierId } from "../data/patronStrata";

export { PATRON_TIERS, type PatronTierDefinition, type PatronTierId };

export const PATRON_TIER_IDS: readonly PatronTierId[] = PATRON_TIERS.map(({ id }) => id);
/** 지층 기념품으로 여는 테두리 — `profileFrames.ts`의 `unlockGift: "patronStrata"` 테두리와 같아야 한다. */
export const PATRON_FRAME_IDS: readonly string[] = PATRON_TIERS.flatMap(({ frameId }) => (frameId ? [frameId] : []));
/** 결제 몫으로 처음 닿은 지층의 기념품은 이만큼 지나야 받는다 — 결제 직후 환불로 기념품만 챙기는 길을 닫는다. */
export const PATRON_SETTLE_MS = 7 * 86_400_000;
/** 매일 보급 한 번에 쌓이는 무료 기금. */
export const PATRON_DAILY_FUND = 1;
/** 결제 기금 — 정가(원) ₩100마다 1. */
export const PATRON_KRW_PER_FUND = 100;
/** 저장 안전선(지핵의 열 배) — 손상된 값이 끝없이 커지지 않게. */
const FUND_LIMIT = 10_000_000;

export interface PatronState {
  /** 매일 보급으로 쌓은 무료 기금. */
  free: number;
  /** 결제로 쌓은 기금(환불이 깎는다). */
  paid: number;
  /** 마지막으로 매일 보급을 받은 UTC 날짜(`YYYY-MM-DD`). */
  dailyDate?: string;
  /** 기념품을 받은 지층 ID. */
  claimed?: PatronTierId[];
  /** 지층마다 기념품을 받을 수 있게 되는 시각(ISO) — 처음 닿은 순간에 굳힌다. */
  reachedAt?: Partial<Record<PatronTierId, string>>;
}

export const createEmptyPatronState = (): PatronState => ({ free: 0, paid: 0 });

export function fundForPriceKrw(priceKrw: number): number {
  return Number.isFinite(priceKrw) && priceKrw > 0 ? Math.floor(priceKrw / PATRON_KRW_PER_FUND) : 0;
}

export const patronFund = (state: PatronState): number => state.free + state.paid;

export function patronTierIndex(fund: number): number {
  let index = 0;
  PATRON_TIERS.forEach((tier, at) => { if (fund >= tier.threshold) index = at; });
  return index;
}

export const patronTierOf = (state: PatronState): PatronTierDefinition => PATRON_TIERS[patronTierIndex(patronFund(state))];
/** 매일 보급의 하루 — 다른 일일 갱신과 같은 UTC 자정이다. */
const dayKey = (now: Date): string => now.toISOString().slice(0, 10);
export const patronDailyAvailable = (state: PatronState, now: Date): boolean => state.dailyDate !== dayKey(now);

/**
 * 기금을 더하고 새로 닿은 지층의 기념품 시각을 굳힌다. 결제 몫이 닿게 한 지층은 7일 뒤, 무료 몫만으로 닿은 지층은 곧바로다.
 * 이미 시각이 있는 지층은 건드리지 않는다(환불로 내려갔다가 다시 닿아도 처음 시각이다).
 */
export function addPatronFund(state: PatronState, source: "free" | "paid", amount: number, now: Date): PatronState {
  if (!(amount > 0)) return state;
  const before = patronTierIndex(patronFund(state));
  const next: PatronState = { ...state, [source]: Math.min(FUND_LIMIT, state[source] + Math.floor(amount)) };
  const after = patronTierIndex(patronFund(next));
  if (after <= before) return next;
  const reachedAt = { ...(state.reachedAt ?? {}) };
  const at = new Date(now.getTime() + (source === "paid" ? PATRON_SETTLE_MS : 0)).toISOString();
  for (let index = before + 1; index <= after; index += 1) {
    const id = PATRON_TIERS[index].id;
    if (!reachedAt[id]) reachedAt[id] = at;
  }
  return { ...next, reachedAt };
}

/** 환불 — 결제 몫만 깎는다. 받은 기념품은 되돌리지 않고, 아직 안 받은 지층은 다시 닿을 때까지 받을 수 없다. */
export function refundPatronFund(state: PatronState, amount: number): PatronState {
  return amount > 0 ? { ...state, paid: Math.max(0, state.paid - Math.floor(amount)) } : state;
}

export type PatronRewardStatus = "claimed" | "ready" | "settling" | "locked";

export function patronRewardStatus(state: PatronState, tierId: PatronTierId, now: Date): PatronRewardStatus {
  const index = PATRON_TIER_IDS.indexOf(tierId);
  if (index <= 0) return "locked";
  if (state.claimed?.includes(tierId)) return "claimed";
  if (patronTierIndex(patronFund(state)) < index) return "locked";
  const at = state.reachedAt?.[tierId];
  return at && Date.parse(at) > now.getTime() ? "settling" : "ready";
}

/** 받을 것이 있는지 — 프리미엄 화면 칩의 붉은 점이 읽는다. */
export function patronHasClaimable(state: PatronState, now: Date): boolean {
  return patronDailyAvailable(state, now) || PATRON_TIERS.some(({ id }) => patronRewardStatus(state, id, now) === "ready");
}

const whole = (value: unknown): number => (Number.isInteger(value) && (value as number) >= 0 ? Math.min(FUND_LIMIT, value as number) : 0);
const isDateKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const isIso = (value: unknown): value is string => typeof value === "string" && value.length <= 40 && Number.isFinite(Date.parse(value));
const isTierId = (value: unknown): value is PatronTierId => typeof value === "string" && (PATRON_TIER_IDS as readonly string[]).includes(value);

export function normalizePatronState(value: unknown): PatronState {
  const source = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const claimed = Array.isArray(source.claimed) ? [...new Set(source.claimed.filter(isTierId))].filter((id) => id !== "topsoil") : [];
  const reachedSource = source.reachedAt && typeof source.reachedAt === "object" ? source.reachedAt as Record<string, unknown> : {};
  const reachedAt: Partial<Record<PatronTierId, string>> = {};
  for (const id of PATRON_TIER_IDS) if (id !== "topsoil" && isIso(reachedSource[id])) reachedAt[id] = reachedSource[id] as string;
  return {
    free: whole(source.free), paid: whole(source.paid),
    ...(isDateKey(source.dailyDate) ? { dailyDate: source.dailyDate } : {}),
    ...(claimed.length > 0 ? { claimed } : {}),
    ...(Object.keys(reachedAt).length > 0 ? { reachedAt } : {}),
  };
}

export function isValidPatronState(value: unknown): value is PatronState {
  if (!value || typeof value !== "object") return false;
  const state = value as PatronState;
  if (!Number.isInteger(state.free) || state.free < 0 || state.free > FUND_LIMIT) return false;
  if (!Number.isInteger(state.paid) || state.paid < 0 || state.paid > FUND_LIMIT) return false;
  if (state.dailyDate !== undefined && !isDateKey(state.dailyDate)) return false;
  if (state.claimed !== undefined && (!Array.isArray(state.claimed) || state.claimed.some((id) => !isTierId(id) || id === "topsoil") || new Set(state.claimed).size !== state.claimed.length)) return false;
  if (state.reachedAt !== undefined && (typeof state.reachedAt !== "object" || Object.entries(state.reachedAt).some(([id, at]) => !isTierId(id) || id === "topsoil" || !isIso(at)))) return false;
  return true;
}
