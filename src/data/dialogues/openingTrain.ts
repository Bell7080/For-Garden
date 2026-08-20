import type { DialogueStory } from "../../core/dialogue";

/** 오프닝의 문장과 분기는 씬에서 분리해 번역·검수와 회상 재사용이 가능하게 둔다. */
export const OPENING_TRAIN: DialogueStory = {
  id: "opening-train",
  startNodeId: "wake",
  nodes: [
    { id: "wake", speaker: "???", body: "연구원님, 곧 이터널 시티에 도착해요.", standing: "torika", expression: "soft", motion: "idle", nextId: "window" },
    { id: "window", speaker: "토리카", body: "창밖을 봐요. 멸종의 기억 위에 세운, 우리들의 마지막 도시예요.", standing: "torika", expression: "smile", motion: "hit", nextId: "answer" },
    {
      id: "answer", speaker: "토리카", body: "도착하면 제일 먼저 무엇을 하고 싶으세요?", standing: "torika", expression: "curious", motion: "idle",
      choices: [
        { id: "promise", label: "너희를 더 알고 싶어", nextId: "warm", effect: { type: "bondXp", relicId: "anky", amount: 5 } },
        { id: "work", label: "도시부터 둘러볼게", nextId: "ready" },
      ],
    },
    { id: "warm", speaker: "토리카", body: "그 말, 잊지 않을게요. 함께 새로운 기억을 만들어요.", standing: "torika", expression: "happy", motion: "attack", nextId: "arrival" },
    { id: "ready", speaker: "토리카", body: "역시 연구원님답네요. 제가 안내할게요.", standing: "torika", expression: "proud", motion: "attack", nextId: "arrival" },
    { id: "arrival", speaker: "안내 방송", body: "이터널 시티 중앙역에 도착했습니다.", nextId: "end" },
    { id: "end", speaker: "토리카", body: "어서 와요, 연구원님.", standing: "torika", expression: "smile", motion: "idle" },
  ],
};
