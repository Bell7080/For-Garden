import type { DialogueStory } from "../../core/dialogue";

/** 중앙 정원구에서 회수하는 분기형 현장 기록이다. 원문과 분기는 씬이 아니라 정적 데이터가 소유한다. */
export const INTERACTION_CENTRAL_JOURNAL: DialogueStory = {
  id: "interaction-central-dialogue-02", startNodeId: "signal", nodes: [
    { id: "signal", speaker: "토리카", body: "유리 회랑 아래에서 오래된 호출 신호가 반복되고 있어요.", standing: "torika", expression: "curious", motion: "idle", nextId: "choice" },
    { id: "choice", speaker: "연구원", body: "기록 장치의 어느 층부터 복원할까?", choices: [
      { id: "voice", label: "음성층을 먼저 복원한다", nextId: "voice-result" },
      { id: "route", label: "이동 경로를 먼저 복원한다", nextId: "route-result" },
    ] },
    { id: "voice-result", speaker: "토리카", body: "같은 인사가 매일 다른 목소리로 남아 있어요. 시민들이 복원 개체에게 말을 건 기록이에요.", standing: "torika", expression: "smile", motion: "attack" },
    { id: "route-result", speaker: "토리카", body: "발자국은 모두 온실 가운데로 향해요. 첫 만남을 기다리던 사람들의 동선 같아요.", standing: "torika", expression: "smile", motion: "attack" },
  ],
};
