import type { Element } from "./types";
import type { SquadId } from "../data/factions";
import type { InteractionCity, InteractionRewardEntry } from "../data/interactionCities";

/** 이름이 아닌 정적 특성만 담아 파견 규칙과 캐릭터 콘텐츠를 느슨하게 연결한다. */
export interface InteractionMemberTraits { readonly id: string; readonly element: Element; readonly squad: SquadId; readonly tags?: readonly string[]; }
export type InteractionFormationError = "party_size" | "duplicate" | "not_owned";

/** 1~3명·중복·소유권을 한 번에 검사하며 첫 오류를 안정적으로 반환한다. */
export function validateInteractionFormation(ids: readonly string[], owned: ReadonlySet<string>): InteractionFormationError | null {
  if (ids.length < 1 || ids.length > 3) return "party_size";
  if (new Set(ids).size !== ids.length) return "duplicate";
  return ids.some(id => !owned.has(id)) ? "not_owned" : null;
}

/** 연구 레벨은 서버 진행 스냅샷에서 읽으며 씬이 별도 개방 목록을 저장하지 않는다. */
export function isInteractionCityUnlocked(city: InteractionCity, researchLevel: number): boolean { return Number.isInteger(researchLevel) && researchLevel >= city.unlock.researchLevel; }

/** 추천 속성/스쿼드/태그의 일치 수마다 8%씩, 최대 36%까지 시간을 단축한다. */
export function interactionSpeedMultiplier(city: InteractionCity, members: readonly InteractionMemberTraits[]): number {
  const matches = members.reduce((sum, member) => sum + Number(city.recommended.elements.includes(member.element)) + Number(city.recommended.squads.includes(member.squad)) + (member.tags ?? []).filter(tag => city.recommended.tags.includes(tag)).length, 0);
  return 1 + Math.min(0.36, matches * 0.08);
}

/** 소수점 밀리초를 없애 서버·클라이언트 표시가 같은 종료 경계를 사용하게 한다. */
export function interactionDurationMs(city: InteractionCity, members: readonly InteractionMemberTraits[]): number { return Math.ceil(city.durationMinutes * 60_000 / interactionSpeedMultiplier(city, members)); }

/** 보상 태그는 이름 조건문 없이 편성 특성 집합과 만나면 항목 가중치를 25% 올린다. */
export function interactionRewardWeights(entries: readonly InteractionRewardEntry[], members: readonly InteractionMemberTraits[]): number[] {
  const tags = new Set(members.flatMap(member => [member.element, member.squad, ...(member.tags ?? [])]));
  return entries.map(entry => entry.weight * (entry.tags?.some(tag => tags.has(tag)) ? 1.25 : 1));
}

/** 완료 판정은 서버가 확정한 ISO 종료 시각과 조회 기준 시각만 비교한다. */
export function isInteractionDispatchComplete(completesAt: string, nowMs: number): boolean { const end = Date.parse(completesAt); return Number.isFinite(end) && nowMs >= end; }
