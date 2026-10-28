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
 * 함께하는 것은 사일런트 룬(노도니아·테리사 「아가」, 메론·매디·안카 「연구원 씨」)이고, 후반에 쁘띠 로그와 앱솔루트 팽이 합류한다.
 */

/** 7-1 전 — 사일런트 룬이 떨어진 연구원을 받아 낸다. */
export const STAGE_7_1_PRE: DialogueStory = {
  id: "stage-7-1-pre",
  startNodeId: "wake",
  backdrop: "battlefield",
  nodes: linear([
    { id: "wake", speaker: "", body: "눈을 뜨자 차가운 바닥 대신 누군가의 무릎이 있다. 머리 위에서 낮은 목소리가 숫자를 세고 있다.", cast: [{ id: "nodonia", slot: "center" }] },
    { id: "nodonia", speaker: "노도니아", body: "아가, 정신 들었어? 셋까지 세는 동안 숨 쉬었으니까 괜찮아. 다친 데 먼저 보자.", standing: "nodonia", act: "lean" },
    { id: "terisa", speaker: "테리사", body: "…소매가 찢어졌구나, 아가. 걸으면서 꿰매 줄게.", standing: "terisa", cast: [{ id: "nodonia", slot: "left" }, { id: "terisa", slot: "right" }], act: "nod" },
    { id: "anka", speaker: "안카", body: "연구원 씨, 여기는 조용히 걸어야 해요. 아래에 자는 척하는 게 너무 많아요.", standing: "anka", cast: [{ id: "anka", slot: "center" }], act: "shrink" },
  ]),
};

/** 7-2 후 — 냉동 수용실. 매디가 이곳이 무엇이었는지 알아챈다. */
export const STAGE_7_2_POST: DialogueStory = {
  id: "stage-7-2-post",
  startNodeId: "cold",
  backdrop: "battlefield",
  nodes: linear([
    { id: "cold", speaker: "매디", body: "와, 여기 냉장고 엄청 크다… 아이스크림 넣으면 백 년은 가겠어요.", standing: "maddy", cast: [{ id: "maddy", slot: "left" }, { id: "meron", slot: "right" }], act: "hop" },
    { id: "frost", speaker: "", body: "성에 낀 유리문 안쪽에 손바닥 자국이 남아 있다. 바깥이 아니라 안쪽에서 찍힌 자국이다.", cue: "rumble" },
    { id: "maddy2", speaker: "매디", body: "…아니에요. 여기 냉장고 아니에요, 연구원 씨. 사람을 넣어 두던 데예요.", standing: "maddy", act: "shrink" },
    { id: "meron", speaker: "메론", body: "…이 얼굴들, 나중에 다 그려 둘게요. 아무도 안 그려 줬을 테니까.", standing: "meron", act: "nod" },
  ]),
};

/** 7-4 후 — 봉인 제어반. 코마가 자기가 받은 명령을 말한다. */
export const STAGE_7_4_POST: DialogueStory = {
  id: "stage-7-4-post",
  startNodeId: "panel",
  backdrop: "battlefield",
  nodes: linear([
    { id: "panel", speaker: "", body: "제어반의 마지막 칸에는 손바닥 모양의 판이 박혀 있다. 그 앞에 코마가 등을 보이고 서 있다.", standing: "koma", cast: [{ id: "koma", slot: "center" }], cue: "alarm" },
    { id: "koma", speaker: "코마", body: "…맨 아래 자물쇠는 사람 손이어야 열린다. 나는 그 손을 데려오라는 명령을 받았다.", standing: "koma", act: "lean" },
    { id: "nodonia", speaker: "노도니아", body: "그 말을 왜 우리 아가 앞에서 하니? 데려갈 거면 숨겼어야지.", standing: "nodonia", cast: [{ id: "nodonia", slot: "left" }, { id: "koma", slot: "right" }], act: "shake" },
    { id: "koma2", speaker: "코마", body: "…그러니까 하는 말이다.", standing: "koma", act: "shrink" },
  ]),
};

/** 7-5 전 — 회수조 저지선. 이카닉시아가 마지막으로 정중히 앞을 막는다. */
export const STAGE_7_5_PRE: DialogueStory = {
  id: "stage-7-5-pre",
  startNodeId: "line",
  backdrop: "battlefield",
  nodes: linear([
    { id: "line", speaker: "", body: "좁은 통로를 날개 망토가 가득 메운다. 이번에는 내려서지 않고 처음부터 그 자리에 서 있었다.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], cue: "rumble" },
    { id: "ika", speaker: "이카닉시아", body: "여기부터는 회수조가 모셔 가겠어요, 연구원님. 이번만큼은 정말 서두를게요.", standing: "ikanixia", act: "lean" },
    { id: "anka", speaker: "안카", body: "연구원 씨, 제 뒤에 있어요. 저 사람 박수 소리, 제가 재워 볼게요.", standing: "anka", cast: [{ id: "anka", slot: "left" }, { id: "ikanixia", slot: "right" }], act: "nod" },
  ]),
};

/** 7-5 후 — 이카닉시아가 코마를 돌아본다. */
export const STAGE_7_5_POST: DialogueStory = {
  id: "stage-7-5-post",
  startNodeId: "fall",
  backdrop: "battlefield",
  nodes: linear([
    { id: "fall", speaker: "이카닉시아", body: "…후훗. 서둘렀더니 이렇게 되네요. 역시 저한테는 천천히가 맞나 봐요.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "left" }, { id: "koma", slot: "right" }], act: "faint" },
    { id: "ask", speaker: "이카닉시아", body: "코마 님. 설마 명령을 거스르실 생각은 아니시죠? 같은 간부로서 묻는 거예요.", standing: "ikanixia", act: "lean" },
    { id: "koma", speaker: "", body: "코마는 대답하지 않는다. 이카닉시아의 곁을 지나 연구원보다 한 걸음 앞에서 걷기 시작한다." },
  ]),
};

/** 7-7 후 — 쁘띠 로그가 연구원을 찾아낸다. */
export const STAGE_7_7_POST: DialogueStory = {
  id: "stage-7-7-post",
  startNodeId: "found",
  backdrop: "battlefield",
  nodes: linear([
    { id: "found", speaker: "토리카", body: "대장님! 찾았다! 진짜 대장님이다!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "right" }], act: "hopTwice", cue: "impact" },
    { id: "dodi", speaker: "도디", body: "일지에 다 적었어요, 대장님이 사라진 시각부터 전부요! 이제 찾은 시각도 적을게요!", standing: "dodi", act: "hop" },
    { id: "parua", speaker: "파루아", body: "…대장님. 저 앞, 큰 게 묶여 있어요. 숨을 안 쉬는 척하고 있어요.", standing: "parua", cast: [{ id: "parua", slot: "center" }], act: "tremble" },
  ]),
};

/** 7-8 후 — 앱솔루트 팽이 돌아온다. */
export const STAGE_7_8_POST: DialogueStory = {
  id: "stage-7-8-post",
  startNodeId: "wall",
  backdrop: "battlefield",
  nodes: linear([
    { id: "wall", speaker: "", body: "옆 벽이 안쪽으로 터져 나온다. 먼지 속에서 머리를 감싼 파치와 렉시아가 함께 뛰어든다.", cast: [{ id: "pachi", slot: "left" }, { id: "lexia", slot: "right" }], cue: "explosion" },
    { id: "lexia", speaker: "렉시아", body: "마스터, 늦어서 미안해요! 위에서부터 벽을 세 개나 뚫고 왔어요. 앞은 이제 제가 서요!", standing: "lexia", act: "hop" },
    { id: "pachi", speaker: "파치", body: "네 개야, 보스. 하나는 렉시아가 문이라고 우겼어.", standing: "pachi", act: "nod" },
    { id: "ella", speaker: "엘라", body: "…시말서는 위에 올라가서 한꺼번에 쓰겠습니다.", standing: "ella", cast: [{ id: "ella", slot: "center" }], act: "shrink" },
  ]),
};

/** 7-9 후 — 최하층 구속실. 카르가 코마에게 명령하고, 코마가 거절한다. */
export const STAGE_7_9_POST: DialogueStory = {
  id: "stage-7-9-post",
  startNodeId: "room",
  backdrop: "battlefield",
  nodes: linear([
    { id: "room", speaker: "", body: "방 한가운데에 구속복째 묶인 거구가 앉아 있다. 자물쇠가 몸 곳곳에 매달려 숨 쉴 때마다 부딪힌다.", standing: "carno", cast: [{ id: "carno", slot: "center" }], cue: "rumble" },
    { id: "kneel", speaker: "", body: "마가사와 노아, 라자가 그 앞에 나란히 무릎을 꿇는다. 마가사가 먼저 고개를 든다.", cast: [{ id: "raja", slot: "left" }, { id: "magasa", slot: "center" }, { id: "noa", slot: "right" }] },
    { id: "magasa", speaker: "마가사", body: "부대장님, 다녀왔어요. 밥은 위에 가서 따뜻하게 차려 드릴게요.", standing: "magasa", act: "nod" },
    { id: "carno", speaker: "카르", body: "…072. 늦었어.", standing: "carno", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right" }], act: "lean" },
    { id: "order", speaker: "카르", body: "사람을 데려와. 그 손을 자물쇠에 얹게 해.", standing: "carno", act: "nod" },
    { id: "koma", speaker: "코마", body: "…싫다.", standing: "koma", act: "lean" },
    { id: "koma2", speaker: "코마", body: "내 번호는 지웠다. 명령도 같이 지웠다.", standing: "koma", act: "shrink" },
    { id: "carno2", speaker: "카르", body: "…그럼 내가 직접 한다.", standing: "carno", act: "rage", cue: "impact" },
  ]),
};

/** 7-10 전 — 카르가 코마를 밀쳐 내고 연구원에게 다가온다. */
export const STAGE_7_10_PRE: DialogueStory = {
  id: "stage-7-10-pre",
  startNodeId: "shove",
  backdrop: "battlefield",
  nodes: linear([
    { id: "shove", speaker: "", body: "묶인 어깨 하나가 코마를 벽까지 밀쳐 낸다. 자물쇠 하나가 터져 바닥을 구른다.", standing: "carno", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right" }], cue: "explosion" },
    { id: "carno", speaker: "카르", body: "…연구원. 비켜 설 것 없다. 손만 있으면 된다.", standing: "carno", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "마스터 손에는 아무도 못 대! 다들, 전열 정렬!", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "carno", slot: "right" }], act: "hop" },
    { id: "nodonia", speaker: "노도니아", body: "아가는 내 뒤야. 저 자물쇠가 다 풀리기 전에 끝내자.", standing: "nodonia", cast: [{ id: "nodonia", slot: "center" }], act: "nod" },
  ]),
};

/** 7-10 후 — 카르가 스스로 구속을 부수고 감금조와 함께 위로 간다. 코마는 남는다. */
export const STAGE_7_10_POST: DialogueStory = {
  id: "stage-7-10-post",
  startNodeId: "last",
  backdrop: "battlefield",
  nodes: linear([
    { id: "last", speaker: "", body: "마지막 자물쇠가 혼자 터진다. 손바닥 판은 끝내 아무도 건드리지 않았다.", standing: "carno", cast: [{ id: "carno", slot: "center" }], cue: "explosion" },
    { id: "carno", speaker: "카르", body: "…손은 필요 없었군. 맞을수록 풀리니까.", standing: "carno", act: "nod" },
    { id: "magasa", speaker: "마가사", body: "부대장님, 위로 가요. 노아도 라자도 다 데려갈게요.", standing: "magasa", cast: [{ id: "magasa", slot: "left" }, { id: "carno", slot: "right" }], act: "lean" },
    { id: "carno2", speaker: "카르", body: "대장들이 기다린다. 연구원은 다음에 데려간다.", standing: "carno", act: "lean" },
    { id: "carno3", speaker: "카르", body: "072. 지운 번호는 내가 다시 적는다.", standing: "carno", cast: [{ id: "koma", slot: "left" }, { id: "carno", slot: "right" }], act: "nod" },
    { id: "leave", speaker: "", body: "카르가 천장을 뚫고 위로 사라진다. 감금조가 차례로 그 뒤를 따른다.", standing: "carno", leave: "blastOff", cast: [] },
    { id: "far", speaker: "???", body: "…궁니르, 철갑. 부대장 귀환 확인.", cast: [{ id: "koma", slot: "center" }], cue: "alarm" },
    { id: "koma", speaker: "코마", body: "…위까지는 같이 간다. 그 다음은 모른다.", standing: "koma", act: "shrink" },
  ]),
};

export const CHAPTER_7_STORIES: readonly DialogueStory[] = [
  STAGE_7_1_PRE, STAGE_7_2_POST, STAGE_7_4_POST, STAGE_7_5_PRE, STAGE_7_5_POST, STAGE_7_7_POST,
  STAGE_7_8_POST, STAGE_7_9_POST, STAGE_7_10_PRE, STAGE_7_10_POST,
];
