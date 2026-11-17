import type { DialogueStory } from "../../core/dialogue";
import { registerDialogueTexts } from "./registerDialogue";

/** 중앙 정원구에서 회수하는 분기형 현장 기록이다. 원문과 분기는 씬이 아니라 정적 데이터가 소유한다. */
export const INTERACTION_CENTRAL_JOURNAL: DialogueStory = {
  id: "interaction-central-dialogue-02",
  backdrop: "greenhouse", startNodeId: "signal", nodes: [
    { id: "signal", speaker: "토리카", body: "대장님, 유리 회랑 아래에서 오래된 호출 신호가 계속 울리고 있어요.", standing: "torika", act: "lean", nextId: "choice" },
    { id: "choice", speaker: "연구원", body: "기록 장치에서 어느 층부터 복원해 볼까?", choices: [
      { id: "voice", label: "음성층을 먼저 복원한다", nextId: "voice-result" },
      { id: "route", label: "이동 경로를 먼저 복원한다", nextId: "route-result" },
    ] },
    { id: "voice-result", speaker: "토리카", body: "매일 같은 인사가, 매일 다른 목소리로 남아 있어요. 시민들이 복원 개체한테 말을 걸어 준 기록이에요.", standing: "torika", act: "nod" },
    { id: "route-result", speaker: "토리카", body: "발자국이 전부 온실 한가운데로 이어져 있어요. 첫 만남을 기다리던 사람들이 다녀간 길 같아요.", standing: "torika", act: "nod" },
  ],
};

registerDialogueTexts(INTERACTION_CENTRAL_JOURNAL);
