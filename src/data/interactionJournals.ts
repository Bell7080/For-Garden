import type { DialogueStory } from "../core/dialogue";
import { registerDataText } from "../i18n";
import { INTERACTION_CENTRAL_JOURNAL } from "./dialogues/interactionCentralJournal";

/** 교류에서 발견하는 기록 정의다. 본문과 분기 대사는 서로 배타적이라 잠긴 기록의 원문을 읽을 수 없다. */
export type InteractionJournal = { readonly id: string; readonly cityId: string; readonly title: string; readonly discoveryOrder: number }
  & ({ readonly body: string; readonly dialogueStory?: never } | { readonly body?: never; readonly dialogueStory: DialogueStory });

/** 도시 안의 discoveryOrder는 중복 표본 대체 순서이자 열람 정렬 순서다. */
export const INTERACTION_JOURNALS: readonly InteractionJournal[] = [
  { id: "interaction-doppel-01", cityId: "doppel-parlor", title: "응접실의 연구 일지", discoveryOrder: 1, body: "손님 탁자에 놓아 둔 일지의 첫 장. 어떤 표본을 어떤 순서로 되살렸는지가 담담하게 적혀 있고, 담당자 칸만 이름 없이 비어 있다." },
  { id: "interaction-doppel-02", cityId: "doppel-parlor", title: "되풀이되는 인사", discoveryOrder: 2, dialogueStory: INTERACTION_CENTRAL_JOURNAL },
  // 내부 연구기관은 이터널에 파견됐던 도플갱어 연구원들의 일기가 모이는 자리다(2단계).
  // 3~8단계 일지는 세계관 원고가 들어올 때 이 목록에 더한다.
  { id: "interaction-doppel-lab-01", cityId: "doppel-lab", title: "돌아오지 못한 파견 일기", discoveryOrder: 1, body: "이터널에 파견됐던 연구원의 일기. 마지막 장은 \"교대 인원이 도착했다\"는 한 줄이고, 그 아래 서명란은 비어 있다." },
] as const;

/** 화면과 수집 규칙이 같은 안정 정렬을 공유한다. 원본 카탈로그는 절대 제자리 정렬하지 않는다. */
export function journalsForCity(cityId: string): InteractionJournal[] { return INTERACTION_JOURNALS.filter((journal) => journal.cityId === cityId).sort((a, b) => a.discoveryOrder - b.discoveryOrder || a.id.localeCompare(b.id)); }
/** 저장 검증과 manager 입력 검증이 표시 문자열 대신 정적 ID만 신뢰하도록 한다. */
export function findInteractionJournal(id: string): InteractionJournal | undefined { return INTERACTION_JOURNALS.find((journal) => journal.id === id); }

/** 교류 기록의 제목과 본문을 언어별로 덮어쓸 수 있게 등록한다. */
for (const journal of INTERACTION_JOURNALS) {
  registerDataText(journal, "title", `journal.${journal.id}.title`);
  registerDataText(journal, "body", `journal.${journal.id}.body`);
}
