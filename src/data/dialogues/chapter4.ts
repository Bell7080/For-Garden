import type { DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **4장 — 합류선 (4-1 ~ 4-10).**
 *
 * 3장 끝에서 이카닉시아는 물러났지만 회수는 멈추지 않았다. 위는 회수조와 코마 조(테러조)를 한 선로에 세워 합동 추격을 명령한다.
 * 회수된 삼인조는 명령이라 앞을 막고, 코마는 「대상 확보 후 복귀」라는 마지막 기회를 받았다. 추격은 연구원을 아래로 몰아
 * 낙하 승강기(4-8)를 지나 지부가 묻어 둔 지하 감금동의 문 앞(4-10 후)에 세운다 — 5장의 문이다.
 * 코마의 입장은 3장 그대로 모호하게 — 말로 밝히지 않고, 명령을 따르는 걸음과 짧은 침묵으로만 남긴다.
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

/** 4-3 전 — 점검 통로. 회수된 삼인조가 명령이라서 앞을 막는다. */
export const STAGE_4_3_PRE: DialogueStory = {
  id: "stage-4-3-pre",
  startNodeId: "whisper",
  backdrop: "battlefield",
  nodes: linear([
    { id: "whisper", speaker: "토비", body: "야, 우리 진심으로 싸우는 거 아니다? …아니, 진심으로 해야 돼. 대충 하면 또 끌려가.", standing: "toby", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }], act: "shake" },
    { id: "ripa", speaker: "리파", body: "뒤에서 미르가 세고 있어. 몇 번 맞았는지까지.", standing: "ripa", act: "shrink" },
    { id: "amo", speaker: "아모", body: "…연구원. 그러니까 세게 와. 우리가 져도 아무도 뭐라 못 하게.", standing: "amo", act: "nod" },
    { id: "torika", speaker: "토리카", body: "대장님, 저 셋… 싸우기 싫은 얼굴이에요.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "amo", slot: "right" }], act: "tremble" },
  ]),
};

/** 4-4 전 — 아트라와 아모가 갱도를 막고, 코마가 돌아가라고 말한다. */
export const STAGE_4_4_PRE: DialogueStory = {
  id: "stage-4-4-pre",
  startNodeId: "block",
  backdrop: "battlefield",
  nodes: linear([
    { id: "block", speaker: "", body: "봉인된 갱도 앞에 아트라와 아모가 나란히 서 있다. 그 뒤로 가리개를 쓴 그림자가 지나간다.", standing: "atra", cast: [{ id: "atra", slot: "left" }, { id: "amo", slot: "right" }], cue: "rumble" },
    { id: "atra", speaker: "아트라", body: "아, 안 비켜요… 명, 명령이라서… 죄, 죄송해요…", standing: "atra", act: "tremble" },
    { id: "amo", speaker: "아모", body: "…나도. 여기는 비켜 줄 수가 없어.", standing: "amo", act: "shrink" },
    { id: "koma", speaker: "코마", body: "…여기는 지나갈 수 없다. 돌아가라.", standing: "koma", cast: [{ id: "koma", slot: "center" }], act: "lean" },
  ]),
};

/** 4-6 전 — 네우리가 같은 간부인 코마를 한 단계 낮춰 본다. */
export const STAGE_4_6_PRE: DialogueStory = {
  id: "stage-4-6-pre",
  startNodeId: "neuri",
  backdrop: "battlefield",
  nodes: linear([
    { id: "neuri", speaker: "네우리", body: "코마 님, 이번에는 꼭 성공해 주세요. 저희 간부님 체면도 걸려 있거든요.", standing: "neuri", cast: [{ id: "koma", slot: "left" }, { id: "neuri", slot: "right" }], act: "nod" },
    { id: "koma", speaker: "코마", body: "…같은 간부다. 네 대장한테 그렇게 전해라.", standing: "koma", act: "lean" },
    { id: "neuri2", speaker: "네우리", body: "어머, 전해 드릴게요. 웃으실 거예요.", standing: "neuri", act: "lean" },
    { id: "ripa", speaker: "리파", body: "…선배, 저쪽이 연구원이야. 이번엔 정말 해야 돼?", standing: "ripa", cast: [{ id: "ripa", slot: "left" }, { id: "koma", slot: "right" }], act: "shrink" },
    { id: "koma2", speaker: "코마", body: "…앞만 봐라.", standing: "koma", act: "nod" },
  ]),
};

/** 4-8 후 — 끊어진 승강기가 지도에 없는 아래로 떨어진다. */
export const STAGE_4_8_POST: DialogueStory = {
  id: "stage-4-8-post",
  startNodeId: "snap",
  backdrop: "battlefield",
  nodes: linear([
    { id: "snap", speaker: "", body: "승강기 줄이 끊어지는 소리. 바닥 표시등이 깜빡이며 아래로, 아래로 숫자를 지워 나간다.", cast: [{ id: "lexia", slot: "left" }, { id: "torika", slot: "right" }], cue: "explosion" },
    { id: "lexia", speaker: "렉시아", body: "마스터, 손잡이 꽉 잡아요! 제가 앞에서 받을게요!", standing: "lexia", act: "shake" },
    { id: "radio", speaker: "스피나", body: "…무전 확인. 그 아래는 지도에 없다. 떨어지면 거기가 어디든, 소리부터 죽여라.", standing: "seira", cast: [{ id: "lexia", slot: "left" }, { id: "seira", slot: "right", remote: true }], act: "nod", cue: "rumble" },
    { id: "torika", speaker: "토리카", body: "지도에 없는 곳이요? 그럼 우리가 처음 그리는 거네요!", standing: "torika", cast: [{ id: "torika", slot: "center" }], act: "hop" },
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

/** 4-10 후 — 두 무리가 물러난다. 사령실 아래에 묻혀 있던 문이 드러나고, 코마에게 다음 명령이 내려온다. */
export const STAGE_4_10_POST: DialogueStory = {
  id: "stage-4-10-post",
  startNodeId: "retreat",
  backdrop: "battlefield",
  nodes: linear([
    { id: "retreat", speaker: "이카닉시아", body: "…이렇게까지 하셨는데도 닿지 않다니. 오늘은 물러나겠습니다. 정말, 서두를 이유가 없으니까요.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], act: "lean" },
    { id: "wing", speaker: "", body: "날개 망토가 허공으로 올라가고, 회수조의 그림자가 하나씩 선로 너머로 사라진다.", standing: "ikanixia", leave: "blastOff", cast: [] },
    { id: "floor", speaker: "", body: "사령실 바닥이 낮게 울린다. 금이 간 바닥판 아래로 녹슨 철문 하나가 드러난다. 문 위의 글씨만은 또렷하다. 「제1지부 지하 감금동 — 출입 금지」.", cue: "rumble" },
    { id: "order", speaker: "???", body: "…072. 감금동을 열어라. 부대장을 데려와라.", cast: [{ id: "koma", slot: "center" }], cue: "alarm" },
    { id: "koma", speaker: "코마", body: "…다음 목록에서 다시 만난다.", standing: "koma", act: "shrink" },
    { id: "gone", speaker: "", body: "코마는 대답 대신 철문의 손잡이를 잡는다. 문이 열리고, 아래에서 차가운 바람이 올라온다." },
  ]),
};

export const CHAPTER_4_STORIES: readonly DialogueStory[] = [
  STAGE_4_1_PRE, STAGE_4_3_PRE, STAGE_4_4_PRE, STAGE_4_6_PRE, STAGE_4_8_POST, STAGE_4_10_PRE, STAGE_4_10_POST,
];
