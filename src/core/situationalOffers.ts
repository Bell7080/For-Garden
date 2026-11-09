/**
 * **상황 특가** — 막힌 순간에 한 번 나타나는 72시간짜리 결제 상품(응태 승인 2026-11-09).
 *
 * 무엇이 막혔는지는 서버가 상태에서 읽고(돌파 파편 부족 · 같은 관문 3연패 · 스테미나 젬 충전 5회 · 천장 10회 앞 ·
 * 연구원 레벨 10/20/30/40 · 이번 달 지층 10층), 그 순간 그 상황에 맞는 상품 하나를 프리미엄 「한정」 탭에 세운다.
 *
 * 남발하지 않는 것이 이 콘텐츠의 전부라 규칙은 셋이다 —
 * - **동시에 셋까지**, **하루에 새로 하나까지**, **같은 종류는 7일 쉬고** 다시 선다.
 * - 한 번 낸 특가(키)는 다시 내지 않는다. 키가 주기를 갖는다 — 등급마다 한 번(돌파), 장마다 한 번(연패), 주마다 한 번(스테미나),
 *   천장 한 바퀴마다 한 번(SSR이 나와 천장이 돌아가면 그 키를 지운다), 레벨마다 한 번, 달마다 한 번(지층).
 * - **전투 중·결과판에는 세우지 않는다** — 화면은 프리미엄 탭의 붉은 점으로만 알린다. 진 판 위에 결제 창을 띄우는 것은
 *   상대의 실망을 파는 일이다.
 *
 * 순수 규칙만 둔다. 언제 무엇을 내는지 판단하는 일(상태 읽기)과 저장은 서버(`FakeServer.evaluateSituationalOffers`)가 한다.
 */
export const SITUATIONAL_OFFER_TRIGGERS = ["breakthroughShort", "stageLoss", "staminaOut", "pityNear", "playerLevel", "ancientBest"] as const;
export type SituationalOfferTrigger = (typeof SITUATIONAL_OFFER_TRIGGERS)[number];

export const SITUATIONAL_OFFER_RULES = {
  durationHours: 72,
  maxActive: 3,
  cooldownDays: 7,
  /** 같은 관문을 몇 번 내리 지면 연패 특가가 서는가. */
  lossStreak: 3,
  /** 스테미나를 젬으로 오늘 몇 번 채우면 스테미나 특가가 서는가. */
  staminaGemRecharges: 5,
  /** SSR 천장까지 남은 연구가 이 수 이하이면 천장 특가가 선다. */
  pityWindow: 10,
  playerLevels: [10, 20, 30, 40] as readonly number[],
  /** 이번 달 지층 최고층이 이 층에 닿으면 지층 특가가 선다. */
  ancientFloor: 10,
} as const;

export interface ActiveSituationalOffer {
  productId: string;
  trigger: SituationalOfferTrigger;
  key: string;
  issuedAt: string;
  expiresAt: string;
}

export interface SituationalOfferState {
  active: ActiveSituationalOffer[];
  /** 이미 낸 특가의 키. 같은 키는 다시 내지 않는다. */
  issuedKeys: string[];
  /** 종류마다 마지막으로 낸 시각 — 7일 쉬는 규칙이 읽는다. */
  lastIssuedAt: Partial<Record<SituationalOfferTrigger, string>>;
  /** 같은 스토리 관문을 내리 진 횟수. 이기거나 다른 관문으로 가면 처음부터 센다. */
  storyLoss?: { stageId: string; count: number };
}

export interface SituationalOfferCandidate {
  trigger: SituationalOfferTrigger;
  key: string;
  productId: string;
}

export function createEmptySituationalOfferState(): SituationalOfferState {
  return { active: [], issuedKeys: [], lastIssuedAt: {} };
}

const isTrigger = (value: unknown): value is SituationalOfferTrigger => typeof value === "string" && (SITUATIONAL_OFFER_TRIGGERS as readonly string[]).includes(value);
const isIso = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

/** 저장값을 믿지 않고 모양이 맞는 것만 남긴다. 예전 저장은 빈 상태다. */
export function normalizeSituationalOfferState(value: unknown): SituationalOfferState {
  const source = (value && typeof value === "object" ? value : {}) as Partial<SituationalOfferState>;
  const active = Array.isArray(source.active) ? source.active.filter((offer): offer is ActiveSituationalOffer => !!offer && typeof offer.productId === "string" && isTrigger(offer.trigger) && typeof offer.key === "string" && isIso(offer.issuedAt) && isIso(offer.expiresAt)).map((offer) => ({ ...offer })) : [];
  const issuedKeys = Array.isArray(source.issuedKeys) ? [...new Set(source.issuedKeys.filter((key): key is string => typeof key === "string"))] : [];
  const lastIssuedAt: SituationalOfferState["lastIssuedAt"] = {};
  if (source.lastIssuedAt && typeof source.lastIssuedAt === "object") {
    for (const [trigger, at] of Object.entries(source.lastIssuedAt)) if (isTrigger(trigger) && isIso(at)) lastIssuedAt[trigger] = at;
  }
  const loss = source.storyLoss;
  const storyLoss = loss && typeof loss.stageId === "string" && Number.isInteger(loss.count) && loss.count > 0 ? { stageId: loss.stageId, count: loss.count } : undefined;
  return { active, issuedKeys, lastIssuedAt, ...(storyLoss ? { storyLoss } : {}) };
}

export function isValidSituationalOfferState(value: unknown): boolean {
  if (value === undefined) return true;
  return JSON.stringify(normalizeSituationalOfferState(value)) === JSON.stringify(value);
}

/** 기한이 지난 특가를 걷는다. 바뀐 것이 없으면 같은 객체를 돌려준다. */
export function pruneSituationalOffers(state: SituationalOfferState, now: Date): SituationalOfferState {
  const active = state.active.filter(({ expiresAt }) => Date.parse(expiresAt) > now.getTime());
  return active.length === state.active.length ? state : { ...state, active };
}

/** 지금 그 상품을 살 수 있게 열어 둔 특가. */
export function activeSituationalOffer(state: SituationalOfferState | undefined, productId: string, now: Date): ActiveSituationalOffer | undefined {
  return state?.active.find((offer) => offer.productId === productId && Date.parse(offer.expiresAt) > now.getTime());
}

/**
 * 후보 하나를 낼 수 있으면 낸다. 규칙(셋까지 · 하루 하나 · 종류마다 7일 · 같은 키 한 번)을 하나라도 어기면 그대로 둔다.
 * 후보는 **먼저 온 것이 먼저**다 — 서버가 급한 순서로 넘긴다.
 */
export function issueSituationalOffer(state: SituationalOfferState, candidate: SituationalOfferCandidate, now: Date): { state: SituationalOfferState; issued: boolean } {
  const pruned = pruneSituationalOffers(state, now);
  const day = now.toISOString().slice(0, 10);
  const cooldownMs = SITUATIONAL_OFFER_RULES.cooldownDays * 86_400_000;
  const last = pruned.lastIssuedAt[candidate.trigger];
  const blocked = pruned.issuedKeys.includes(candidate.key)
    || pruned.active.length >= SITUATIONAL_OFFER_RULES.maxActive
    || pruned.active.some(({ productId }) => productId === candidate.productId)
    || Object.values(pruned.lastIssuedAt).some((at) => at?.slice(0, 10) === day)
    || (last !== undefined && now.getTime() - Date.parse(last) < cooldownMs);
  if (blocked) return { state: pruned, issued: false };
  const issuedAt = now.toISOString();
  const offer: ActiveSituationalOffer = { ...candidate, issuedAt, expiresAt: new Date(now.getTime() + SITUATIONAL_OFFER_RULES.durationHours * 3_600_000).toISOString() };
  return {
    state: { ...pruned, active: [...pruned.active, offer], issuedKeys: [...pruned.issuedKeys, candidate.key], lastIssuedAt: { ...pruned.lastIssuedAt, [candidate.trigger]: issuedAt } },
    issued: true,
  };
}

/** 산 특가를 걷는다. */
export function consumeSituationalOffer(state: SituationalOfferState, productId: string): SituationalOfferState {
  return { ...state, active: state.active.filter((offer) => offer.productId !== productId) };
}

/** 한 주기가 다시 돌아 같은 특가를 또 낼 수 있게 키를 지운다(천장이 SSR로 돌아간 때). */
export function forgetSituationalOfferKey(state: SituationalOfferState, key: string): SituationalOfferState {
  return state.issuedKeys.includes(key) ? { ...state, issuedKeys: state.issuedKeys.filter((entry) => entry !== key) } : state;
}

/** 스토리 관문 한 판의 결과를 연패 줄에 적는다. 이기면 줄을 지운다. */
export function recordStoryResult(state: SituationalOfferState, stageId: string, victory: boolean): SituationalOfferState {
  if (victory) {
    if (!state.storyLoss) return state;
    const { storyLoss: _cleared, ...rest } = state;
    return rest;
  }
  const count = state.storyLoss?.stageId === stageId ? state.storyLoss.count + 1 : 1;
  return { ...state, storyLoss: { stageId, count } };
}

/** 스토리 관문 ID의 장 번호(`1-5` · `normal:2-3` → 1 · 2). 장이 없으면 `undefined`. */
export function storyStageChapter(stageId: string): number | undefined {
  const match = /^(?:[a-z]+:)?(\d+)-\d+/.exec(stageId);
  return match ? Number(match[1]) : undefined;
}

/** 월요일 00:00 UTC로 끊는 주 키. */
export function situationalWeekKey(now: Date): string {
  const date = new Date(`${now.toISOString().slice(0, 10)}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return date.toISOString().slice(0, 10);
}
