import type { DialogueStory } from "../../core/dialogue";
import { registerDialogueTexts } from "./registerDialogue";

/** 첫 이벤트의 발굴 보고서 본문이며 완료 ID는 기존 회상 저장소와 공유한다. */
export const GREAT_AUK_REPORT: DialogueStory = {
  id: "event-great-auk-report",
  startNodeId: "specimen",
  nodes: [
    { id: "specimen", speaker: "토리카", body: "대장님, 북대서양 표본함에서 큰바다쇠오리 골격 표지가 나왔어요!", standing: "torika", act: "lean", nextId: "site" },
    { id: "site", speaker: "연구원", body: "그럼 해안 발굴지부터 확보하자. 훼손된 기록 조각도 빠짐없이 챙기고.", nextId: "result" },
    { id: "result", speaker: "토리카", body: "서식지 기록이랑 멸종 원인을 맞춰 봤어요. 발굴 보고서는 보존 기록으로 넘겨 둘게요.", standing: "torika", act: "nod" },
  ],
};

registerDialogueTexts(GREAT_AUK_REPORT);
