import type { DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **6장 — 중층 격리 회랑 (6-1 ~ 6-10).**
 *
 * 마가사의 말로 공멸이 연구원을 아래로 몰아온 이유가 드러났다. 연구원은 위로 빠져나가려 하고, 풀려난 감금조와 회수조는 연구원을
 * 맨 아래로 데려가려 한다. 감금조는 갇혀 있던 시간 동안 서로를 챙겨 온 무리라 지시보다 결속으로 움직인다 — 마가사가 먹이고,
 * 라자가 앞에 서고, 노아는 마가사 뒤에 붙어 다닌다. 6-5는 노아의 기습(혼자 서는 정예), 6-10은 마가사·노아 투톱 정예다.
 * 6-10 후에 회랑이 무너져 연구원은 결국 맨 아래로 떨어지고, 거기서 부대장 카르의 목소리가 처음 들린다.
 *
 * 함께하는 것은 시그널 아이다 — 관측·저격·오더의 결이다. 스테라·켄토는 「선배」「담당관」, 이르나·슈테는 「오더」라 부른다.
 */

/** 6-1 전 — 시그널 아이의 드론이 회랑에 들어온다. */
export const STAGE_6_1_PRE: DialogueStory = {
  id: "stage-6-1-pre",
  startNodeId: "drone",
  backdrop: "battlefield",
  nodes: linear([
    { id: "drone", speaker: "", body: "환기구에서 작은 드론 하나가 소리 없이 내려와 연구원의 눈높이에서 멈춘다.", cast: [{ id: "morphe", slot: "center" }], cue: "rumble" },
    { id: "morphe", speaker: "모르페", body: "담당관 확인. 위까지 가는 길, 지금부터 제가 위에서 봅니다.", standing: "morphe", act: "nod" },
    { id: "kento", speaker: "켄토", body: "담당관님은 여기 서 계세요. 내려앉을 자리는 제가 먼저 막아 둘게요.", standing: "kento", cast: [{ id: "kento", slot: "left" }, { id: "stella", slot: "right" }], act: "lean" },
    { id: "stella", speaker: "스테라", body: "선배, 바람이 전부 아래로 빨려 들어가요. 이 회랑, 숨을 거꾸로 쉬어요.", standing: "stella", act: "tremble" },
  ]),
};

/** 6-3 후 — 마가사가 회랑 한구석에서 감금조를 먹인다. */
export const STAGE_6_3_POST: DialogueStory = {
  id: "stage-6-3-post",
  startNodeId: "pot",
  backdrop: "battlefield",
  nodes: linear([
    { id: "pot", speaker: "", body: "무너진 순찰로 한구석에서 작은 불이 피어 있다. 마가사가 솥을 걸고 라자에게 그릇을 내민다.", cast: [{ id: "raja", slot: "left" }, { id: "magasa", slot: "right" }] },
    { id: "magasa", speaker: "마가사", body: "라자, 많이 먹어. 앞에 서는 사람이 제일 먼저 배고프잖아.", standing: "magasa", act: "nod" },
    { id: "raja", speaker: "라자", body: "…노아 몫은.", standing: "raja", act: "lean" },
    { id: "magasa2", speaker: "마가사", body: "벌써 덜어 놨지~ 아, 연구원님 몫도 남겨 뒀는데. 오시면 같이 드세요.", standing: "magasa", act: "hop" },
    { id: "keris", speaker: "케리스", body: "…기록했습니다, 선배. 적이 우리 몫의 그릇을 따로 덜어 둔 건 이번이 처음이에요.", standing: "keris", cast: [{ id: "keris", slot: "center" }], act: "shrink" },
  ]),
};

/** 6-4 후 — 스테라가 떨리는 바람 하나를 읽는다. */
export const STAGE_6_4_POST: DialogueStory = {
  id: "stage-6-4-post",
  startNodeId: "wind",
  backdrop: "battlefield",
  nodes: linear([
    { id: "wind", speaker: "스테라", body: "선배, 바람이 하나 더 있어요. 아주 작고… 계속 떨리는 바람이요.", standing: "stella", cast: [{ id: "stella", slot: "left" }, { id: "kento", slot: "right" }], act: "tremble", cue: "rumble" },
    { id: "kento", speaker: "켄토", body: "스테라, 내 뒤로. 떨리는 건 겁먹었다는 거고, 겁먹은 건 먼저 뛰어들어.", standing: "kento", act: "lean" },
    { id: "shaft", speaker: "", body: "환기 수직갱 위에서 손톱이 금속을 긁는 소리가 길게 이어진다.", cue: "impact" },
  ]),
};

/** 6-5 전 — 노아가 수직갱에서 떨어지며 기습한다. */
export const STAGE_6_5_PRE: DialogueStory = {
  id: "stage-6-5-pre",
  startNodeId: "drop",
  backdrop: "battlefield",
  nodes: linear([
    { id: "drop", speaker: "", body: "그림자가 위에서 떨어진다. 땅에 닿기도 전에 손톱이 먼저 공기를 가른다.", standing: "noa", cast: [{ id: "noa", slot: "center" }], cue: "impact" },
    { id: "noa", speaker: "노아", body: "오, 오지 마! 오지 말라니까! …왜 계속 오는 건데!", standing: "noa", act: "fright" },
    { id: "shute", speaker: "슈테", body: "오더, 저 아이는 제가 붙잡겠습니다. 한 명만, 끝까지.", standing: "shute", cast: [{ id: "shute", slot: "left" }, { id: "noa", slot: "right" }], act: "nod" },
  ]),
};

/** 6-5 후 — 쓰러진 노아 앞을 마가사가 막아선다. */
export const STAGE_6_5_POST: DialogueStory = {
  id: "stage-6-5-post",
  startNodeId: "curl",
  backdrop: "battlefield",
  nodes: linear([
    { id: "curl", speaker: "노아", body: "…아파. 그러니까 오지 말라고 했잖아.", standing: "noa", cast: [{ id: "noa", slot: "center" }], act: "shrink" },
    { id: "magasa", speaker: "마가사", body: "우리 노아한테 뭐 하는 거예요, 연구원님? 이 아이는 재료 아니에요. 식구예요.", standing: "magasa", cast: [{ id: "noa", slot: "left" }, { id: "magasa", slot: "right" }], act: "lean" },
    { id: "noa2", speaker: "노아", body: "마가사… 나 하나도 안 무서웠어. 진짜야.", standing: "noa", act: "tremble" },
    { id: "magasa2", speaker: "마가사", body: "알아, 알아. 가자. 밥 먹고 다시 하자.", standing: "magasa", act: "nod" },
  ]),
};

/** 6-7 후 — 무너진 면회실. 회수조가 부대장의 귀환을 두고 말을 나눈다. */
export const STAGE_6_7_POST: DialogueStory = {
  id: "stage-6-7-post",
  startNodeId: "glass",
  backdrop: "battlefield",
  nodes: linear([
    { id: "glass", speaker: "", body: "깨진 면회 창 너머에 의자 두 개가 마주 놓여 있다. 한쪽 의자에만 손톱자국이 깊다.", cast: [{ id: "ikanixia", slot: "left" }, { id: "neuri", slot: "right" }] },
    { id: "ika", speaker: "이카닉시아", body: "부대장님이 깨어나시면 저희도 줄을 서야겠죠. 그분 앞에서는 간부도 조원도 한 줄이니까요.", standing: "ikanixia", act: "lean" },
    { id: "neuri", speaker: "네우리", body: "저희 간부님은 줄 같은 거 안 서세요! …서시나요?", standing: "neuri", act: "shake" },
    { id: "ika2", speaker: "이카닉시아", body: "후훗. 서는 척은 잘하죠.", standing: "ikanixia", act: "nod" },
  ]),
};

/** 6-8 후 — 격리 관제실. 케리스가 최하층 수감 기록을 찾고, 이르나가 줄을 끊는다. */
export const STAGE_6_8_POST: DialogueStory = {
  id: "stage-6-8-post",
  startNodeId: "record",
  backdrop: "battlefield",
  nodes: linear([
    { id: "record", speaker: "케리스", body: "선배, 관제 기록이에요. 최하층 구속실, 수감 개체 하나. 이름 칸에는… 「카르」.", standing: "keris", cast: [{ id: "keris", slot: "left" }, { id: "irna", slot: "right" }], act: "lean" },
    { id: "keris2", speaker: "케리스", body: "다른 칸은 다 번호인데, 이 칸만 이름이에요. 지운 자국 위에 다시 적혀 있어요.", standing: "keris", act: "shrink" },
    { id: "irna", speaker: "이르나", body: "오더, 위로 가는 줄이 감겨 내려가고 있습니다. 끊겠습니다.", standing: "irna", act: "nod", cue: "impact" },
    { id: "lift", speaker: "", body: "총성 한 발. 아래로 끌려가던 짐 승강기가 멈춘다. 그 안에 빈 구속복 하나가 걸려 있다." },
  ]),
};

/** 6-10 전 — 회랑 최심부. 마가사와 노아가 나란히 선다. */
export const STAGE_6_10_PRE: DialogueStory = {
  id: "stage-6-10-pre",
  startNodeId: "deep",
  backdrop: "battlefield",
  nodes: linear([
    { id: "deep", speaker: "", body: "회랑의 끝, 위로 오르는 계단 앞에 둘이 서 있다. 하나는 솥을 내려놓았고, 하나는 그 등 뒤에 붙어 있다.", standing: "magasa", cast: [{ id: "magasa", slot: "left" }, { id: "noa", slot: "right" }], cue: "rumble" },
    { id: "magasa", speaker: "마가사", body: "연구원님, 위로는 못 가요. 부대장님이 아래에서 기다리시거든요.", standing: "magasa", act: "lean" },
    { id: "noa", speaker: "노아", body: "마가사, 내 뒤에 있어. …아니, 내가 뒤에 있을게. 근데 나도 할래.", standing: "noa", act: "tremble" },
    { id: "stella", speaker: "스테라", body: "선배, 둘의 바람이 하나로 묶여 있어요. 떼어 놓으면 흔들릴 거예요.", standing: "stella", cast: [{ id: "stella", slot: "center" }], act: "nod" },
  ]),
};

/** 6-10 후 — 회랑이 무너져 연구원이 맨 아래로 떨어진다. 카르의 목소리가 처음 들린다. */
export const STAGE_6_10_POST: DialogueStory = {
  id: "stage-6-10-post",
  startNodeId: "fall",
  backdrop: "battlefield",
  nodes: linear([
    { id: "fall", speaker: "마가사", body: "아하… 둘이서도 안 되네. 노아, 괜찮아?", standing: "magasa", cast: [{ id: "magasa", slot: "left" }, { id: "noa", slot: "right" }], act: "faint" },
    { id: "noa", speaker: "노아", body: "…응. 근데 바닥이, 바닥이 이상해.", standing: "noa", act: "fright" },
    { id: "crack", speaker: "", body: "회랑 바닥이 한가운데부터 꺼져 내린다. 위로 가는 계단이 멀어지고, 몸이 어둠 속으로 떨어진다.", cast: [], cue: "explosion" },
    { id: "koma", speaker: "코마", body: "…손을 잡아라. 놓치면 그 손을 쓰게 된다.", standing: "koma", cast: [{ id: "koma", slot: "center" }], act: "lean" },
    { id: "voice", speaker: "???", body: "…늦었어.", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right", veiled: true }], cue: "impact" },
  ]),
};

export const CHAPTER_6_STORIES: readonly DialogueStory[] = [
  STAGE_6_1_PRE, STAGE_6_3_POST, STAGE_6_4_POST, STAGE_6_5_PRE, STAGE_6_5_POST, STAGE_6_7_POST,
  STAGE_6_8_POST, STAGE_6_10_PRE, STAGE_6_10_POST,
];
