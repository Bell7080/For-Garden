import type { DialogueStory } from "../core/dialogue";
import { INTERACTION_CENTRAL_JOURNAL } from "./dialogues/interactionCentralJournal";

/** 교류에서 발견하는 기록 정의다. 본문과 분기 대사는 서로 배타적이라 잠긴 기록의 원문을 읽을 수 없다. */
export type InteractionJournal = { readonly id: string; readonly cityId: string; readonly title: string; readonly discoveryOrder: number }
  & ({ readonly body: string; readonly dialogueStory?: never } | { readonly body?: never; readonly dialogueStory: DialogueStory });

/** 도시 안의 discoveryOrder는 중복 표본 대체 순서이자 열람 정렬 순서다. */
export const INTERACTION_JOURNALS: readonly InteractionJournal[] = [
  { id: "interaction-central-01", cityId: "central-garden", title: "푸른 회랑의 표찰", discoveryOrder: 1, body: "온실의 첫 안내판에는 복원 개체를 구경거리가 아닌 새 이웃으로 맞아 달라는 문장이 남아 있다." },
  { id: "interaction-central-02", cityId: "central-garden", title: "되풀이되는 인사", discoveryOrder: 2, dialogueStory: INTERACTION_CENTRAL_JOURNAL },
  { id: "interaction-night-01", cityId: "night-ward", title: "침수 구역 당직표", discoveryOrder: 1, body: "물때가 가장 높은 시간에도 구조등을 끄지 않았던 의료조의 교대 기록. 마지막 칸은 아직 비어 있다." },
  { id: "interaction-abyss-01", cityId: "abyss-port", title: "인양 상자의 항로", discoveryOrder: 1, body: "봉인 상자에는 멸종 직전의 표본을 연구 도시로 옮기려던 항로와 되돌아오지 못한 배의 좌표가 겹쳐 적혀 있다." },
] as const;

/** 화면과 수집 규칙이 같은 안정 정렬을 공유한다. 원본 카탈로그는 절대 제자리 정렬하지 않는다. */
export function journalsForCity(cityId: string): InteractionJournal[] { return INTERACTION_JOURNALS.filter((journal) => journal.cityId === cityId).sort((a, b) => a.discoveryOrder - b.discoveryOrder || a.id.localeCompare(b.id)); }
/** 저장 검증과 manager 입력 검증이 표시 문자열 대신 정적 ID만 신뢰하도록 한다. */
export function findInteractionJournal(id: string): InteractionJournal | undefined { return INTERACTION_JOURNALS.find((journal) => journal.id === id); }
