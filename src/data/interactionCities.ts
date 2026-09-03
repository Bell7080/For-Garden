import type { Wallet } from "../core/gacha";
import type { Element } from "../core/types";
import type { SquadId } from "./factions";

/** 교류 보상의 한 행이다. weight는 확률이 아니라 같은 표 안에서의 상대 가중치다. */
export interface InteractionRewardEntry { readonly currency: keyof Wallet; readonly amount: number; readonly weight: number; readonly tags?: readonly string[]; }

/** 종료 시각은 포함하지 않는 운영 정적 정의다. 실제 시각은 출발 API가 서버 시계로 확정한다. */
export interface InteractionCity {
  readonly id: string; readonly displayName: string; readonly description: string;
  readonly unlock: { readonly researchLevel: number };
  readonly baseDurationHours: number; readonly partySize: { readonly min: 1; readonly max: 3 };
  readonly recommended: { readonly elements: readonly Element[]; readonly squads: readonly SquadId[]; readonly tags: readonly string[] };
  readonly rewards: readonly InteractionRewardEntry[]; readonly clueJournalId: string;
}

/** 초반 12시간에서 후반 24시간까지 이어지는 교류 도시 정적 카탈로그다. */
export const INTERACTION_CITIES: readonly InteractionCity[] = [
  { id: "central-garden", displayName: "중앙 정원구", description: "복원 개체와 시민이 처음 인사를 나누는 푸른 온실 회랑.", unlock: { researchLevel: 1 }, baseDurationHours: 12, partySize: { min: 1, max: 3 }, recommended: { elements: ["water"], squads: ["rune"], tags: ["garden"] }, rewards: [{ currency: "gold", amount: 1800, weight: 6 }, { currency: "cheesecake", amount: 2, weight: 2 }], clueJournalId: "interaction-central-01" },
  { id: "night-ward", displayName: "나이트 시티", description: "밤에도 구조 신호가 끊이지 않는 침수 외곽 의료 구역.", unlock: { researchLevel: 3 }, baseDurationHours: 18, partySize: { min: 1, max: 3 }, recommended: { elements: ["wind"], squads: ["gear"], tags: ["night-gear"] }, rewards: [{ currency: "gold", amount: 3200, weight: 5, tags: ["night-gear"] }, { currency: "gems", amount: 12, weight: 1, tags: ["wind"] }], clueJournalId: "interaction-night-01" },
  { id: "abyss-port", displayName: "심해 항만구", description: "도시 끝의 인양조가 고대 화물과 잃어버린 기록을 건져 올린다.", unlock: { researchLevel: 6 }, baseDurationHours: 24, partySize: { min: 1, max: 3 }, recommended: { elements: ["water", "wind"], squads: ["gear"], tags: ["salvage"] }, rewards: [{ currency: "fossil", amount: 420, weight: 5 }, { currency: "amber", amount: 2, weight: 1 }], clueJournalId: "interaction-abyss-01" },
] as const;

/** 외부 입력은 언제나 이 조회를 거쳐 알려진 도시만 사용한다. */
export function findInteractionCity(id: string): InteractionCity | undefined { return INTERACTION_CITIES.find(city => city.id === id); }
