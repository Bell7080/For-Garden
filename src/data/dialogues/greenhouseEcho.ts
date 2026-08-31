import type { DialogueStory } from "../../core/dialogue";

/** 1-5 뒤에 선택해서 읽는 짧은 기록으로, 본편 전투 진행과 보상을 분리한다. */
export const GREENHOUSE_ECHO: DialogueStory = {
  id: "stage-1-5-greenhouse-echo",
  startNodeId: "signal",
  nodes: [
    { id: "signal", speaker: "토리카", body: "잠깐, 주 통로 옆 온실에서 오래된 생체 신호가 들려.", standing: "torika", nextId: "seed" },
    { id: "seed", speaker: "렉시아", body: "전투 흔적은 없어. 누군가 남겨 둔 씨앗의 기억 같네.", standing: "lexia", nextId: "promise" },
    { id: "promise", speaker: "토리카", body: "기록해 두자. 길을 계속 가더라도, 이 작은 정원은 잊히지 않게.", standing: "torika" },
  ],
};
