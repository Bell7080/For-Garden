import type { DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **7장 — 최하층 구속실 (7-1 ~ 7-10).**
 *
 * 맨 아래로 떨어진 연구원을 사일런트 룬이 먼저 찾아 붙잡는다. 공멸은 마지막 자물쇠에 연구원의 손을 얹으려 하고, 위의 명령을 받은
 * 코마는 그 손을 데려와야 하는 자리에 선다. 7-5는 회수조 간부 이카닉시아가 혼자 서는 저지선, 7-10은 **공멸 부대장 카르**다.
 *
 * 코마는 7-9에서 카르의 명령을 거절한다 — 3장에서 「내 번호는 지웠다」고 한 말을 처음으로 행동으로 옮기는 자리다. 카르는 손을 쓰지
 * 않고 스스로 구속을 부수고(전투에서도 다칠수록 자물쇠가 풀린다), 감금조를 데리고 두 대장(기가노토·티타노)이 있는 위로 간다.
 * 연구원의 손은 끝내 쓰이지 않았다. 공멸의 목표(야성 증폭제)는 그대로 남아 다음 장으로 이어진다.
 *
 * 함께하는 것은 사일런트 룬(노도니아 「아가」, 테리사 「연구원님」, 메론·매디·안카 「연구원 씨」)이고, 후반에 쁘띠 로그와 앱솔루트 팽이 합류한다.
 */

/** 7-1 전 — 사일런트 룬이 떨어진 연구원을 받아 낸다. */
export const STAGE_7_1_PRE: DialogueStory = {
  id: "stage-7-1-pre",
  startNodeId: "wake",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "wake", speaker: "", body: "눈을 뜨자 차가운 바닥이 아니라 누군가의 무릎이 머리를 받치고 있었다. 머리 위에서 낮은 목소리가 숫자를 세고 있었다.", cast: [{ id: "nodonia", slot: "center" }] },
    { id: "nodonia", speaker: "노도니아", body: "아가, 정신 들어? 천천히 일어나. 어지럽진 않고? 다친 데부터 보자.", standing: "nodonia", act: "lean" },
    { id: "terisa", speaker: "테리사", body: "연구원님, 소매가 찢어졌어요. 팔 좀 보여 주실래요? 다친 데는 없는지 볼게요.", standing: "terisa", cast: [{ id: "nodonia", slot: "left" }, { id: "terisa", slot: "right" }], act: "nod" },
    { id: "anka", speaker: "안카", body: "연구원 씨, 여기는 조용히 걸어야 해요. 아래에 자는 척하는 게 너무 많아요.", standing: "anka", cast: [{ id: "anka", slot: "center" }], act: "shrink" },
  ]),
};

/** 7-2 후 — 냉동 수용실. 매디가 이곳이 무엇이었는지 알아챈다. */
export const STAGE_7_2_POST: DialogueStory = {
  id: "stage-7-2-post",
  startNodeId: "cold",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "cold", speaker: "매디", body: "와, 여기 냉장고 엄청 크다… 아이스크림 넣으면 백 년은 가겠어요.", standing: "maddy", cast: [{ id: "maddy", slot: "left" }, { id: "meron", slot: "right" }], act: "hop" },
    { id: "frost", speaker: "", body: "성에 낀 유리문 안쪽에 손바닥 자국이 남아 있었다. 바깥이 아니라 안쪽에서 찍힌 자국이었다.", cue: "rumble" },
    { id: "maddy2", speaker: "매디", body: "…아니에요. 여기 냉장고 아니에요, 연구원 씨. 사람을 넣어 두던 데예요.", standing: "maddy", act: "shrink" },
    { id: "meron", speaker: "메론", body: "…여기 있던 사람들, 나중에 제가 그려 둘게요. 아무도 기억해 주지 않았을 테니까.", standing: "meron", act: "nod" },
  ]),
};

/** 7-4 후 — 봉인 제어반. 코마가 자기가 받은 명령을 말한다. */
export const STAGE_7_4_POST: DialogueStory = {
  id: "stage-7-4-post",
  startNodeId: "panel",
  backdrop: "restraint",
  nodes: linear([
    { id: "panel", speaker: "", body: "제어반 마지막 칸에는 손바닥 모양의 판이 박혀 있었다. 그 앞에 코마가 등을 보인 채 서 있었다.", standing: "koma", cast: [{ id: "koma", slot: "center" }], cue: "alarm" },
    { id: "koma", speaker: "코마", body: "…맨 아래 자물쇠는 사람 손이어야 열린다. 나는 그 손을 데려오라는 명령을 받았다.", standing: "koma", act: "lean" },
    { id: "nodonia", speaker: "노도니아", body: "…그런데 왜 알려 주는 거니? 명령대로 할 생각이면 숨기는 편이 나았을 텐데.", standing: "nodonia", cast: [{ id: "nodonia", slot: "left" }, { id: "koma", slot: "right" }], act: "shake" },
    { id: "koma2", speaker: "코마", body: "…그러니까 하는 말이다.", standing: "koma", act: "shrink" },
  ]),
};

/** 7-5 전 — 회수조 저지선. 이카닉시아가 마지막으로 정중히 앞을 막는다. */
export const STAGE_7_5_PRE: DialogueStory = {
  id: "stage-7-5-pre",
  startNodeId: "line",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "line", speaker: "", body: "좁은 통로를 날개 망토가 가득 메우고 있었다. 이번에는 위에서 내려서지 않고, 처음부터 그 자리에 버티고 서 있었다.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], cue: "rumble" },
    { id: "ika", speaker: "이카닉시아", body: "여기부터는 회수조가 모셔 가겠어요, 연구원님. 이번만큼은 정말 서두를게요.", standing: "ikanixia", act: "lean" },
    { id: "why", speaker: "이카닉시아", body: "이상하게 여기실 것 없어요. 아래까지 모셔 오는 동안은 서두를 이유가 없었거든요. 물러날 때마다 길은 늘 한쪽만 열어 뒀으니까요. …이제는 있어요, 서두를 이유가.", standing: "ikanixia", act: "nod", cue: "heartbeat" },
    { id: "anka", speaker: "안카", body: "연구원 씨, 제 뒤에 있어요. 제가 틈을 만들면 바로 지나가요.", standing: "anka", cast: [{ id: "anka", slot: "left" }, { id: "ikanixia", slot: "right" }], act: "nod" },
  ]),
};

/** 7-5 후 — 이카닉시아가 코마를 돌아본다. */
export const STAGE_7_5_POST: DialogueStory = {
  id: "stage-7-5-post",
  startNodeId: "fall",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "fall", speaker: "이카닉시아", body: "…후훗. 서둘렀더니 이렇게 되네요. 역시 저한테는 천천히가 맞나 봐요.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "left" }, { id: "koma", slot: "right" }], act: "faint" },
    { id: "ask", speaker: "이카닉시아", body: "코마 님. 설마 명령을 거스르실 생각은 아니시죠? 같은 간부로서 묻는 거예요.", standing: "ikanixia", act: "lean" },
    { id: "koma", speaker: "", body: "코마는 대답하지 않았다. 이카닉시아 곁을 지나쳐, 연구원보다 한 걸음 앞에서 걷기 시작했다." },
  ]),
};

/** 7-7 후 — 쁘띠 로그가 연구원을 찾아낸다. */
export const STAGE_7_7_POST: DialogueStory = {
  id: "stage-7-7-post",
  startNodeId: "found",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "found", speaker: "토리카", body: "대장님! 찾았다! 진짜 대장님이다!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "right" }], act: "hopTwice", cue: "impact" },
    { id: "dodi", speaker: "도디", body: "다치신 데는요? …아, 다행이다. 저희 계속 찾아다녔어요. 또 놓친 줄 알고…", standing: "dodi", act: "hop" },
    { id: "parua", speaker: "파루아", body: "…대장님. 저 앞에 큰 게 묶여 있어요. 숨 안 쉬는 척하고 있어요.", standing: "parua", cast: [{ id: "parua", slot: "center" }], act: "tremble" },
  ]),
};

/** 7-8 후 — 앱솔루트 팽이 돌아온다. */
export const STAGE_7_8_POST: DialogueStory = {
  id: "stage-7-8-post",
  startNodeId: "wall",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "wall", speaker: "", body: "옆 벽이 안쪽으로 터져 나왔다. 먼지 속에서 머리를 감싼 파치와 렉시아가 함께 뛰어들었다.", cast: [{ id: "pachi", slot: "left" }, { id: "lexia", slot: "right" }], cue: "explosion" },
    { id: "lexia", speaker: "렉시아", body: "마스터, 늦어서 미안해요! 위에서부터 벽을 세 개나 뚫고 왔어요. 앞은 이제 제가 맡을게요!", standing: "lexia", act: "hop" },
    { id: "pachi", speaker: "파치", body: "네 개야, 보스. 하나는 렉시아가 문이라고 우겼어.", standing: "pachi", act: "nod" },
    { id: "ella", speaker: "엘라", body: "다들 무사하군요. 연구원님, 걸으실 수 있겠습니까? 돌아가는 길은 저희가 열겠습니다.", standing: "ella", cast: [{ id: "ella", slot: "center" }], act: "shrink" },
  ]),
};

/** 7-9 후 — 최하층 구속실. 카르가 코마에게 명령하고, 코마가 거절한다. */
export const STAGE_7_9_POST: DialogueStory = {
  id: "stage-7-9-post",
  startNodeId: "room",
  backdrop: "restraint",
  nodes: linear([
    { id: "room", speaker: "", body: "방 한가운데에 구속복째 묶인 거구가 앉아 있었다. 몸 곳곳에 매달린 자물쇠가 숨 쉴 때마다 서로 부딪쳤다.", standing: "carno", cast: [{ id: "carno", slot: "center" }], cue: "rumble" },
    { id: "rattle", speaker: "", body: "연구원이 문턱을 넘어서자 자물쇠들이 일제히 덜컹거렸다. 거구는 꿈쩍도 하지 않았는데, 쇠붙이만이 무언가에 끌리듯 이쪽으로 몸을 틀었다.", cue: "heartbeat" },
    { id: "kneel", speaker: "", body: "마가사와 노아, 라자가 그 앞에 나란히 무릎을 꿇었다. 마가사가 먼저 고개를 들었다.", cast: [{ id: "raja", slot: "left" }, { id: "magasa", slot: "center" }, { id: "noa", slot: "right" }] },
    { id: "magasa", speaker: "마가사", body: "부대장님, 다녀왔어요. 밥은 위에 가서 따뜻하게 차려 드릴게요.", standing: "magasa", act: "nod" },
    { id: "carno", speaker: "카르", body: "…072. 늦었어.", standing: "carno", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right" }], act: "lean" },
    { id: "order", speaker: "카르", body: "사람을 데려와. 그 손을 자물쇠에 얹게 해.", standing: "carno", act: "nod" },
    { id: "koma", speaker: "코마", body: "…싫다.", standing: "koma", act: "lean" },
    { id: "koma2", speaker: "코마", body: "내 번호는 지웠다. 명령도 같이 지웠다.", standing: "koma", act: "shrink" },
    { id: "carno2", speaker: "카르", body: "…그럼 내가 직접 한다.", standing: "carno", act: "rage", cue: "impact", voice: "heavy" },
  ]),
};

/** 7-10 전 — 카르가 코마를 밀쳐 내고 연구원에게 다가온다. */
export const STAGE_7_10_PRE: DialogueStory = {
  id: "stage-7-10-pre",
  startNodeId: "shove",
  backdrop: "restraint",
  nodes: linear([
    { id: "shove", speaker: "", body: "묶인 어깨 하나가 코마를 벽까지 밀쳐 냈다. 자물쇠 하나가 터져 바닥을 굴렀다.", standing: "carno", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right" }], cue: "explosion" },
    { id: "carno", speaker: "카르", body: "…연구원. 도망칠 것 없다. 필요한 건 네 손뿐이다.", standing: "carno", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "마스터 손에는 아무도 못 대! 다들, 전열 정렬!", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "carno", slot: "right" }], act: "hop", voice: "shout" },
    { id: "nodonia", speaker: "노도니아", body: "아가는 내 뒤에 있어. 저 자물쇠가 다 풀리기 전에 끝내자.", standing: "nodonia", cast: [{ id: "nodonia", slot: "center" }], act: "nod" },
  ]),
};

/** 7-10 후 — 카르가 스스로 구속을 부수고 감금조와 함께 위로 간다. 코마는 남는다. */
export const STAGE_7_10_POST: DialogueStory = {
  id: "stage-7-10-post",
  startNodeId: "last",
  backdrop: "restraint",
  nodes: linear([
    { id: "last", speaker: "", body: "마지막 자물쇠가 저절로 터졌다. 손바닥 판에는 끝내 아무도 손을 대지 않았다.", standing: "carno", cast: [{ id: "carno", slot: "center" }], cue: "explosion" },
    { id: "notice", speaker: "노도니아", body: "…아가, 봤어? 손을 댄 게 아니야. 아가가 한 걸음 다가설 때마다 저것들이 들썩였어.", standing: "nodonia", cast: [{ id: "nodonia", slot: "left" }, { id: "carno", slot: "right" }], act: "lean" },
    { id: "carno", speaker: "카르", body: "…풀렸군. 그렇게 오래 붙잡아 두더니, 고작 이거였나.", standing: "carno", act: "nod" },
    { id: "hand", speaker: "카르", body: "…손이 아니었군. 자물쇠가 기다린 건 손이 아니라, 너였다.", standing: "carno", act: "lean", voice: "heavy", cue: "heartbeat" },
    { id: "magasa", speaker: "마가사", body: "부대장님, 위로 가요. 노아도 라자도 다 데려갈게요.", standing: "magasa", cast: [{ id: "magasa", slot: "left" }, { id: "carno", slot: "right" }], act: "lean" },
    { id: "carno2", speaker: "카르", body: "대장들이 기다린다. 연구원은 다음에 데려간다.", standing: "carno", act: "lean" },
    { id: "carno3", speaker: "카르", body: "072. 지운 번호는 내가 다시 적는다.", standing: "carno", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right" }], act: "nod" },
    { id: "leave", speaker: "", body: "카르가 천장을 뚫고 위로 솟구쳤다. 감금조가 하나씩 그 구멍을 따라 올라갔다.", standing: "carno", leave: "rise", cast: [] },
    { id: "far", speaker: "???", body: "…궁니르, 철갑. 부대장 귀환 확인.", cast: [{ id: "koma", slot: "center" }], cue: "alarm" },
    { id: "whisper", speaker: "코마", body: "…그래서 데려오라고 한 거다. 처음부터, 손이 아니라 당신을.", standing: "koma", act: "lean", voice: "whisper" },
    { id: "koma", speaker: "코마", body: "…위까지는 같이 간다. 그 다음은 모른다.", standing: "koma", act: "shrink" },
  ]),
};

export const CHAPTER_7_STORIES: readonly DialogueStory[] = [
  STAGE_7_1_PRE, STAGE_7_2_POST, STAGE_7_4_POST, STAGE_7_5_PRE, STAGE_7_5_POST, STAGE_7_7_POST,
  STAGE_7_8_POST, STAGE_7_9_POST, STAGE_7_10_PRE, STAGE_7_10_POST,
];
