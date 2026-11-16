import { contentUnlockLevel } from "./contentUnlock";
import type { Element, Role } from "./types";
import type { SquadId } from "../data/factions";
import type { InteractionCity, InteractionRewardRange } from "../data/interactionCities";
import type { WalletItemKey } from "../data/items";

/** 이름이 아닌 정적 특성만 담아 파견 규칙과 캐릭터 콘텐츠를 느슨하게 연결한다. */
export interface InteractionMemberTraits { readonly id: string; readonly element: Element; readonly role: Role; readonly squad: SquadId; }
export type InteractionFormationError = "party_size" | "duplicate" | "not_owned";

/** 1~3명·중복·소유권을 한 번에 검사하며 첫 오류를 안정적으로 반환한다. */
export function validateInteractionFormation(ids: readonly string[], owned: ReadonlySet<string>): InteractionFormationError | null {
  if (ids.length < 1 || ids.length > 3) return "party_size";
  if (new Set(ids).size !== ids.length) return "duplicate";
  return ids.some(id => !owned.has(id)) ? "not_owned" : null;
}

/**
 * 그 도시가 열렸는가 — **연구원 레벨 하나만 본다**(`docs/interaction-cities.md` §3).
 *
 * 교류 입구가 열리는 레벨(`contentUnlockLevel("interaction")`)보다 낮게 적힌 도시도 입구 레벨
 * 전에는 열지 않는다 — 서버가 입구를 건너뛴 요청을 받아도 같은 답을 낸다.
 */
export function isInteractionCityUnlocked(city: InteractionCity, playerLevel: number): boolean {
  return playerLevel >= Math.max(city.unlock.level, contentUnlockLevel("interaction"));
}

/**
 * 파견의 수확을 정하는 두 축 — **몇 명이 갔나**와 **그 도시에 맞는 이가 갔나**.
 *
 * - 인원 몫(`party`): 혼자 가면 절반, 둘이면 3/4, 셋이 가야 표에 적힌 만큼이다. 빈 자리를 두고
 *   보내도 되지만 그만큼 덜 가져온다.
 * - 특화(`perMatch`): 도시마다 특화 속성·직군·스쿼드가 있고, 한 명이 셋 중 몇에 맞는지를 센다.
 *   맞는 칸 하나마다 10%가 더해지고 합은 90%에서 멈춘다 — 셋이 모두 세 칸에 맞으면 1.9배다.
 *
 * 시간은 건드리지 않는다. 특화가 시간을 줄이면 화면에 적힌 소요 시간이 거짓말이 된다.
 */
export const INTERACTION_YIELD = {
  party: [0, 0.5, 0.75, 1] as readonly number[],
  perMatch: 0.1,
  maxBonus: 0.9,
} as const;

/** 한 명이 그 도시의 특화 속성·직군·스쿼드 중 몇 칸에 맞는가(0~3). */
export function interactionSpecialtyMatches(city: InteractionCity, member: Pick<InteractionMemberTraits, "element" | "role" | "squad">): number {
  const { specialty } = city;
  return Number(specialty.elements.includes(member.element)) + Number(specialty.roles.includes(member.role)) + Number(specialty.squads.includes(member.squad));
}

/** 이 편성이 가져올 몫의 배율. 표에 적힌 범위에 곱한다. */
export function interactionYieldFactor(city: InteractionCity, members: readonly Pick<InteractionMemberTraits, "element" | "role" | "squad">[]): number {
  const share = INTERACTION_YIELD.party[Math.min(3, members.length)] ?? 0;
  const matches = members.reduce((sum, member) => sum + interactionSpecialtyMatches(city, member), 0);
  return share + Math.min(INTERACTION_YIELD.maxBonus, matches * INTERACTION_YIELD.perMatch);
}

/**
 * 배율을 곱한 한 줄의 범위. 화면의 「예상 보상」이 이 수를 그대로 적는다.
 *
 * 실제로 굴리는 값(`rollInteractionRewards`)은 배율을 곱한 **소수 범위**에서 뽑아 확률적으로
 * 반올림하므로, 여기서는 그 결과가 닿을 수 있는 가장 작은·큰 정수를 돌려준다.
 */
export function interactionRewardRange(entry: InteractionRewardRange, factor: number): { currency: WalletItemKey; min: number; max: number } {
  const low = entry.min * factor;
  const high = entry.max * factor;
  return { currency: entry.currency, min: Math.floor(low), max: Number.isInteger(high) ? high : Math.ceil(high) };
}

/**
 * 파견이 가져올 것을 굴린다 — **표의 모든 줄**에서 한 번씩.
 *
 * 줄마다 배율을 곱한 범위 안에서 고르게 뽑고, 소수 끝자리는 그 크기만큼의 확률로 올린다
 * (0.3이면 30%로 1). 그래서 「0~1개」인 귀한 줄도 인원이 적으면 덜 자주, 특화가 많으면 더
 * 자주 온다. 0이 나온 줄은 싣지 않는다.
 */
export function rollInteractionRewards(city: InteractionCity, members: readonly Pick<InteractionMemberTraits, "element" | "role" | "squad">[], random: () => number): { currency: WalletItemKey; amount: number }[] {
  const factor = interactionYieldFactor(city, members);
  return city.rewards.flatMap((entry) => {
    const low = entry.min * factor;
    const high = entry.max * factor;
    const amount = Math.floor(low + random() * (high - low) + random());
    const range = interactionRewardRange(entry, factor);
    const clamped = Math.max(range.min, Math.min(range.max, amount));
    return clamped > 0 ? [{ currency: entry.currency, amount: clamped }] : [];
  });
}

/** 파견에 드는 시간. 편성과 무관하게 도시가 정한다. */
export function interactionDurationMs(city: InteractionCity): number { return city.durationMinutes * 60_000; }

/** 완료 판정은 서버가 확정한 ISO 종료 시각과 조회 기준 시각만 비교한다. */
export function isInteractionDispatchComplete(completesAt: string, nowMs: number): boolean { const end = Date.parse(completesAt); return Number.isFinite(end) && nowMs >= end; }
