import type { DialogueStory } from "../../core/dialogue";
import { RAID_TRIO, ROGUE_TRIO } from "./openingTrain";
import { registerDialogueTexts } from "./registerDialogue";

/*
 * **1-1 뒤의 짧은 막 — 공멸 삼인조의 퇴각.**
 *
 * 오프닝에서 곧장 들어간 1-1을 이기면 로비로 나가기 전에 이 막이 돈다. 셋이 아쉬워하며
 * "두고 보자~"를 외치고 하늘로 날아가 별이 되는 우당탕탕 퇴장이다(`leave: "blastOff"`).
 * 쓰러뜨려 없애는 싸움이 아니라 **다음에 또 올** 상대라는 것 — 1장 내내 이 셋이 관문마다
 * 다시 서는 이유다. 공멸도 연구원을 해치려는 게 아니라 데려가려는 쪽이라 대사에 적의가 없다.
 *
 * 쁘띠 로그의 마지막 말이 이터널 시티로 향하는 길을 열어 로비(도시)로 이어진다.
 */
export const OPENING_RETREAT: DialogueStory = {
  id: "opening-retreat",
  startNodeId: "groan",
  backdrop: "battlefield",
  nodes: [
    { id: "groan", speaker: "토비", body: "끄아악! 이, 이럴 리가 없는데!", standing: "toby", cast: RAID_TRIO, act: "shake", cue: "impact", nextId: "sigh" },
    { id: "sigh", speaker: "아모", body: "그러니까… 조용히 가자고 했잖아…", standing: "amo", act: "shrink", nextId: "grin" },
    { id: "grin", speaker: "리파", body: "에이, 그래도 재밌었잖아? 저쪽 셋, 생각보다 세더라~", standing: "ripa", act: "hop", nextId: "vow" },
    { id: "vow", speaker: "토비", body: "기억해 둬, 연구원! 다음엔 꼭 데려간다!", standing: "toby", act: "hopTwice", nextId: "away" },
    { id: "away", speaker: "토비·아모·리파", body: "두고 보자아아아~!!", cast: [], leave: "blastOff", cue: "impact", nextId: "gone" },
    { id: "gone", speaker: "토리카", body: "…날아가 버렸네요. 대장님, 다치신 데는 없죠?", standing: "torika", cast: ROGUE_TRIO, act: "hop", nextId: "log" },
    { id: "log", speaker: "도디", body: "첫 전투 기록 완료! 적은 하늘의 별이 되었다… 이렇게 적어 둬야지!", standing: "dodi", act: "hopTwice", nextId: "watch" },
    { id: "watch", speaker: "파루아", body: "…또 올 거야. 포기할 얼굴이 아니었어.", standing: "parua", act: "nod", nextId: "onward" },
    { id: "onward", speaker: "토리카", body: "그럼 우리도 서둘러요. 이터널 시티까지 제가 안내할게요!", standing: "torika", act: "nod" },
  ],
};

registerDialogueTexts(OPENING_RETREAT);
