import type { DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **4장 — 합류선 (4-1 ~ 4-10).**
 *
 * 3장 끝에서 이카닉시아는 물러났지만 회수는 멈추지 않았다. 지부는 회수조와 코마 조(테러조)를 한 선로에 세워
 * 합동 추격을 명령한다. 본편 줄거리가 확정되기 전이라 이 장의 대사는 장의 문을 여는 것(4-1 전), 코마가 길을 막는 것(4-4 전),
 * 마감 정예 둘(4-10 전·후)만 둔다. 코마의 입장은 3장 그대로 모호하게 — 말로 밝히지 않고, 명령을 따르는 걸음과 짧은 침묵으로만 남긴다.
 */

/** 4-1 전 — 합동 추격의 시작. 두 무리가 한 선로에 선다. */
export const STAGE_4_1_PRE: DialogueStory = {
  id: "stage-4-1-pre",
  startNodeId: "radio",
  backdrop: "battlefield",
  nodes: linear([
    { id: "radio", speaker: "", body: "승강장 스피커에서 낮은 안내가 흐른다. 「합동 추격 개시. 대상 확보 후 코마 조 복귀.」", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], cue: "alarm" },
    { id: "ika", speaker: "이카닉시아", body: "두 무리가 한 선로에 서는 일이 흔하지는 않죠. 서두를 이유는 없지만, 이번에는 누구도 놓치지 않을 거예요.", standing: "ikanixia", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "합동이라니, 숫자가 늘었다는 소리잖아! 그래도 한 줄로 서면 똑같이 뚫으면 돼!", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "ikanixia", slot: "right" }], act: "hop" },
  ]),
};

/** 4-4 전 — 코마가 선로 한가운데에서 길을 막는다. */
export const STAGE_4_4_PRE: DialogueStory = {
  id: "stage-4-4-pre",
  startNodeId: "block",
  backdrop: "battlefield",
  nodes: linear([
    { id: "block", speaker: "", body: "봉인된 갱도 앞에 아트라와 아모가 나란히 서 있다. 그 뒤로 가리개를 쓴 그림자가 지나간다.", standing: "atra", cast: [{ id: "atra", slot: "center" }], cue: "rumble" },
    { id: "atra", speaker: "아트라", body: "아, 안 비켜요… 명, 명령이라서… 죄, 죄송해요…", standing: "atra", act: "tremble" },
    { id: "koma", speaker: "코마", body: "…여기는 지나갈 수 없다. 돌아가라.", standing: "koma", cast: [{ id: "koma", slot: "center" }], act: "lean" },
  ]),
};

/** 4-10 전 — 합류선 종점. 코마와 이카닉시아가 나란히 선다. */
export const STAGE_4_10_PRE: DialogueStory = {
  id: "stage-4-10-pre",
  startNodeId: "end",
  backdrop: "battlefield",
  nodes: linear([
    { id: "end", speaker: "", body: "사령실 문이 열린다. 가리개를 쓴 코마와 날개 망토의 이카닉시아가 한 걸음 사이를 두고 서 있다.", standing: "ikanixia", cast: [{ id: "koma", slot: "left" }, { id: "ikanixia", slot: "right" }], cue: "rumble" },
    { id: "ika", speaker: "이카닉시아", body: "코마 님이 앞에 서 주시니 든든하네요. 저는 뒤에서 천천히 하겠습니다.", standing: "ikanixia", act: "nod" },
    { id: "koma", speaker: "코마", body: "…내가 앞이다. 뒤는 당신이 맡아라.", standing: "koma", act: "lean" },
  ]),
};

/** 4-10 후 — 두 무리가 물러난다. 해결되지 않은 채로. */
export const STAGE_4_10_POST: DialogueStory = {
  id: "stage-4-10-post",
  startNodeId: "retreat",
  backdrop: "battlefield",
  nodes: linear([
    { id: "retreat", speaker: "이카닉시아", body: "…이렇게까지 하셨는데도 닿지 않다니. 오늘은 물러나겠습니다. 정말, 서두를 이유가 없으니까요.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], act: "lean" },
    { id: "wing", speaker: "", body: "날개 망토가 허공으로 올라가고, 회수조의 그림자가 하나씩 선로 너머로 사라진다.", standing: "ikanixia", leave: "blastOff", cast: [] },
    { id: "koma", speaker: "코마", body: "…다음 목록에서 다시 만난다.", standing: "koma", cast: [{ id: "koma", slot: "center" }], act: "shrink" },
  ]),
};

export const CHAPTER_4_STORIES: readonly DialogueStory[] = [
  STAGE_4_1_PRE, STAGE_4_4_PRE, STAGE_4_10_PRE, STAGE_4_10_POST,
];
