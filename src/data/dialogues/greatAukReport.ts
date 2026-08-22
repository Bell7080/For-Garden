import type { DialogueStory } from "../../core/dialogue";

/** 첫 이벤트의 발굴 보고서 본문이며 완료 ID는 기존 회상 저장소와 공유한다. */
export const GREAT_AUK_REPORT: DialogueStory = {
  id: "event-great-auk-report",
  startNodeId: "specimen",
  nodes: [
    { id: "specimen", speaker: "토리카", body: "북대서양 표본함에서 큰바다쇠오리의 골격 표지가 발견됐어요.", standing: "torika", expression: "curious", motion: "idle", nextId: "site" },
    { id: "site", speaker: "연구원", body: "해안 발굴지를 확보하고 훼손된 기록 조각을 회수하자.", nextId: "result" },
    { id: "result", speaker: "토리카", body: "서식지와 멸종 원인을 대조했어요. 이제 발굴 보고서를 보존 기록으로 넘길게요.", standing: "torika", expression: "smile", motion: "attack" },
  ],
};

