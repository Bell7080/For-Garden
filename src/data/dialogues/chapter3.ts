import type { DialogueCastMember, DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **3장 — 회수 구간 (3-1 ~ 3-10).**
 *
 * 2장에서는 연구원이 코마를 쫓았고, 3장에서는 연구원이 쫓긴다. 이카닉시아의 회수조는 연구원을 해치지 않고 「데려가려」 하며,
 * 지부의 병력이 한 팀씩 합류해 길을 연다. 코마의 입장은 끝까지 모호하게 둔다(그녀의 비밀은 쓰지 않는다).
 * 직책(`docs/lore.md` §4): 코마·이카닉시아는 같은 급의 간부, 아트라는 회수조 부간부, 삼인조와 펄시·네우리·미르는 조원이다.
 * 나이트 기어는 무전, 앱솔루트 팽(렉시아·엘라·파치·아크·유티)은 직접 선다.
 */

const REMOTE_PAIR = (voice: "seira" | "luka", other: "torika" | "dodi" | "lexia"): readonly DialogueCastMember[] => [
  { id: other, slot: "left" }, { id: voice, slot: "right", remote: true },
];

/**
 * 3-1 전 — 배턴. 코마가 무릎을 꿇은 자리에 이카닉시아가 내려선다.
 *
 * 2-10에서 삼인조는 연구원을 따라가겠다고 했다. 회수조의 「회수」는 실패한 팀을 거두어 가는 일이기도 해서, 그 셋도 함께 끌려
 * 돌아간다 — 3장과 4장에서 셋이 다시 앞을 막는 것은 마음이 바뀌어서가 아니라 회수되었기 때문이다.
 */
export const STAGE_3_1_PRE: DialogueStory = {
  id: "stage-3-1-pre",
  startNodeId: "land",
  backdrop: "battlefield",
  nodes: linear([
    { id: "land", speaker: "", body: "무릎 꿇은 코마의 뒤로 찢어진 날개 망토가 천천히 내려선다. 서두르는 기색이라고는 없다.", standing: "ikanixia", cast: [{ id: "koma", slot: "left" }, { id: "ikanixia", slot: "right" }], cue: "rumble" },
    { id: "greet", speaker: "이카닉시아", body: "수고하셨어요, 코마 님. 같은 간부끼리 이런 자리에서 뵙게 되다니, 조금 민망하네요.", standing: "ikanixia", act: "lean" },
    { id: "mask", speaker: "", body: "코마가 입을 가린 가리개를 처음으로 천천히 내린다.", standing: "koma", act: "recoil" },
    { id: "atra", speaker: "아트라", body: "아, 안 돼요… 선, 선배는 아직… 회수 전이라서…", standing: "atra", cast: [{ id: "koma", slot: "left" }, { id: "atra", slot: "center" }, { id: "ikanixia", slot: "right" }], act: "tremble" },
    { id: "smile", speaker: "이카닉시아", body: "어머, 우리 아트라는 상냥하기도 하지. 그럼 선배는 마지막에 모시죠.", standing: "ikanixia", act: "nod" },
    { id: "haul", speaker: "", body: "아트라의 마디진 꼬리 끝에 세 그림자가 묶인 채 끌려 나온다. 아모, 토비, 리파다.", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }], cue: "impact" },
    { id: "toby", speaker: "토비", body: "놔, 놔 봐! 우리 따라가기로 했다니까! 진짜라고!", standing: "toby", act: "shake" },
    { id: "rule", speaker: "이카닉시아", body: "실패한 팀은 거두어 오는 게 회수조의 일이랍니다. 세 분은 한 번만 더 일해 주셔야겠어요.", standing: "ikanixia", cast: [{ id: "toby", slot: "left" }, { id: "ikanixia", slot: "right" }], act: "lean" },
    { id: "ripa", speaker: "리파", body: "…이번에도 위에서 정했네. 우리가 정한 게 아니고.", standing: "ripa", cast: [{ id: "ripa", slot: "left" }, { id: "amo", slot: "right" }], act: "shrink" },
    { id: "amo", speaker: "아모", body: "…연구원, 미안. 따라간다고 했는데, 아직 못 갔어.", standing: "amo", act: "tremble" },
    { id: "you", speaker: "이카닉시아", body: "연구원님이시군요. 소문은 많이 들었어요. 이번에는 제가 정중히 모셔 가겠습니다.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], act: "lean" },
  ]),
};

/** 3-4 후 — 나이트 기어가 불을 끄고 퇴로를 연다. */
export const STAGE_3_4_POST: DialogueStory = {
  id: "stage-3-4-post",
  startNodeId: "radio",
  backdrop: "battlefield",
  nodes: linear([
    { id: "radio", speaker: "스피나", body: "…무전 확인. 3번 통로의 조명을 내렸다. 눈이 적응하면 오른쪽으로 빠져라.", standing: "seira", cast: REMOTE_PAIR("seira", "torika"), act: "nod", cue: "alarm" },
    { id: "luka", speaker: "루카", body: "문 잠금은 내가 풀어 놨어. 대신 소리는 내지 마. 쟤네 귀가 좋거든.", standing: "luka", cast: REMOTE_PAIR("luka", "dodi"), act: "lean" },
    { id: "thanks", speaker: "토리카", body: "고맙습니다! 그런데 두 분은 어디 계세요?", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "right" }], act: "hop" },
    { id: "gone", speaker: "스피나", body: "…어둠 속이다. 그것이 우리 일이다.", standing: "seira", cast: REMOTE_PAIR("seira", "torika"), act: "shrink" },
  ]),
};

/** 3-5 전 — 아트라가 앞을 막는다. */
export const STAGE_3_5_PRE: DialogueStory = {
  id: "stage-3-5-pre",
  startNodeId: "block",
  backdrop: "battlefield",
  nodes: linear([
    { id: "block", speaker: "", body: "통로 한복판에 소매로 얼굴을 반쯤 가린 아트라가 서 있다. 한 걸음도 비키지 않는다.", standing: "atra", cast: [{ id: "atra", slot: "center" }], cue: "rumble" },
    { id: "stutter", speaker: "아트라", body: "그, 그러니까… 같이 가, 가 주시면… 아프지 않아요.", standing: "atra", act: "tremble" },
    { id: "refuse", speaker: "토리카", body: "죄송해요, 지금은 갈 수 없어요!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "atra", slot: "right" }], act: "shake" },
    { id: "sorry", speaker: "아트라", body: "아, 아니에요… 괜찮아요. 조, 조금 아플 수는 있는데…", standing: "atra", act: "shrink" },
  ]),
};

/** 3-5 후 — 쓰러진 아트라. 코마가 데리러 온다. */
export const STAGE_3_5_POST: DialogueStory = {
  id: "stage-3-5-post",
  startNodeId: "down",
  backdrop: "battlefield",
  nodes: linear([
    { id: "down", speaker: "아트라", body: "…아, 아프지 않아요. 지, 진짜… 지네는 마디가 많아서… 괜, 괜찮아요…", standing: "atra", cast: [{ id: "atra", slot: "center" }], act: "faint" },
    { id: "koma", speaker: "코마", body: "…그만 일어나라.", standing: "koma", cast: [{ id: "atra", slot: "left" }, { id: "koma", slot: "right" }], act: "lean" },
    { id: "atra", speaker: "아트라", body: "선, 선배… 저, 저 졌어요… 그래도 선배보다는… 오래 버텼죠?", standing: "atra", act: "hop" },
    { id: "koma2", speaker: "코마", body: "…그건 맞다.", standing: "koma", act: "shrink" },
  ]),
};

/** 3-6 후 — 거대한 벽 앞. 파치가 벽을 머리로 부순다. */
export const STAGE_3_6_POST: DialogueStory = {
  id: "stage-3-6-post",
  startNodeId: "dead",
  backdrop: "battlefield",
  nodes: linear([
    { id: "dead", speaker: "", body: "막다른 길. 눈앞에는 격벽이 천장까지 서 있다. 등 뒤에서는 회수조의 발소리가 가까워진다.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "right" }], cue: "alarm" },
    { id: "mir", speaker: "미르", body: "연구원님~ 거기 계셨네요! 같이 가요! 저희가 모실게요!", standing: "mir", cast: [{ id: "mir", slot: "center" }], act: "hop" },
    { id: "pulsi", speaker: "펄시", body: "막다른 길이잖아? 도망 연습은 이쯤 하고 이제 놀자고.", standing: "pulsi", cast: [{ id: "pulsi", slot: "center" }], act: "hopTwice" },
    { id: "crash", speaker: "", body: "굉음과 함께 격벽 한가운데가 안쪽으로 터져 나온다. 먼지 속에서 머리를 감싼 그림자가 튀어나온다.", cue: "explosion", cast: [{ id: "pachi", slot: "center" }] },
    { id: "pachi", speaker: "파치", body: "보스, 길 열었어! 늦어서 미안!", standing: "pachi", act: "bounce" },
    { id: "pulsi2", speaker: "펄시", body: "…벽을 머리로 깼어? 진짜로?", standing: "pulsi", cast: [{ id: "pulsi", slot: "left" }, { id: "pachi", slot: "right" }], act: "fright" },
  ]),
};

/** 3-8 후 — 펄시의 기습을 엘라가 몸으로 막는다. */
export const STAGE_3_8_POST: DialogueStory = {
  id: "stage-3-8-post",
  startNodeId: "ambush",
  backdrop: "battlefield",
  nodes: linear([
    { id: "ambush", speaker: "펄시", body: "깜짝 선물이야, 연구원! 받아!", standing: "pulsi", cast: [{ id: "pulsi", slot: "right" }, { id: "torika", slot: "left" }], act: "hop", cue: "impact" },
    { id: "block", speaker: "엘라", body: "…연구원님, 뒤로. 이쪽은 제가 막겠습니다.", standing: "ella", cast: [{ id: "ella", slot: "center" }], act: "lean" },
    { id: "neuri", speaker: "네우리", body: "후훗… 방벽이라니, 정말 존경스럽네요. 다 부수고 나면 어떤 서류가 나올지 기대돼요.", standing: "neuri", cast: [{ id: "ella", slot: "left" }, { id: "neuri", slot: "right" }], act: "nod" },
    { id: "ella", speaker: "엘라", body: "그 서류는 제가 쓰겠습니다. 이번 달 시말서는 이미 다 정해 두었거든요.", standing: "ella", act: "shake" },
  ]),
};

/** 3-9 후 — 측면 돌파. 유티와 아크가 두 조를 갈라 놓는다. */
export const STAGE_3_9_POST: DialogueStory = {
  id: "stage-3-9-post",
  startNodeId: "split",
  backdrop: "battlefield",
  nodes: linear([
    { id: "split", speaker: "네우리", body: "어흠, 그건 그렇고… 어머, 왼쪽에서 오는 저 소리는 뭘까요?", standing: "neuri", cast: [{ id: "neuri", slot: "left" }, { id: "mir", slot: "right" }], act: "lean", cue: "rumble" },
    { id: "yuti", speaker: "유티", body: "보, 보스! 아니 연구원님! 제가 옆에서 갈라 놓을게요!", standing: "yuti", cast: [{ id: "yuti", slot: "center" }], act: "bounce", cue: "impact" },
    { id: "ark", speaker: "아크", body: "…더는 못 지나갑니다. 마스터, 앞은 제가 서겠습니다.", standing: "ark", cast: [{ id: "ark", slot: "left" }, { id: "yuti", slot: "right" }], act: "nod" },
    { id: "mir", speaker: "미르", body: "에이, 놓쳤네요! 근데 이 사람들 진짜 튼튼하다!", standing: "mir", cast: [{ id: "mir", slot: "center" }], act: "hopTwice" },
  ]),
};

/** 3-10 전 — 앱솔루트 팽이 한 줄로 선다. */
export const STAGE_3_10_PRE: DialogueStory = {
  id: "stage-3-10-pre",
  startNodeId: "hall",
  backdrop: "battlefield",
  nodes: linear([
    { id: "hall", speaker: "", body: "회수 구간의 마지막 홀. 높은 천장에서 날개 그림자가 천천히 내려온다.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], cue: "rumble" },
    { id: "ika", speaker: "이카닉시아", body: "여기까지 오셨군요, 연구원님. 이제 쫓는 시간은 끝이에요. 제 앞에 서 주세요.", standing: "ikanixia", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "그 부탁은 거절이야! 앱솔루트 팽, 전열 정렬!", standing: "lexia", cast: [{ id: "lexia", slot: "center" }], act: "hop" },
    { id: "line", speaker: "", body: "연구원의 앞에 렉시아, 엘라, 파치, 아크, 유티가 한 줄로 나란히 선다.", cast: [{ id: "ella", slot: "left" }, { id: "lexia", slot: "center" }, { id: "pachi", slot: "right" }], cue: "impact" },
    { id: "ika2", speaker: "이카닉시아", body: "어머, 줄까지 서 주시다니. 정말 정중하시네요… 이겠지요.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], act: "nod" },
  ]),
};

/** 3-10 후 — 이카닉시아가 물러난다. 코마는 끝내 대답하지 않는다. */
export const STAGE_3_10_POST: DialogueStory = {
  id: "stage-3-10-post",
  startNodeId: "fall",
  backdrop: "battlefield",
  nodes: linear([
    { id: "fall", speaker: "이카닉시아", body: "…후훗. 오늘은 여기까지로 해 두죠. 아쉽지만 서두를 이유는 없으니까요.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], act: "lean" },
    { id: "wing", speaker: "", body: "날개 망토가 천천히 허공으로 올라간다. 회수조의 그림자가 하나씩 따라 사라진다.", standing: "ikanixia", leave: "blastOff", cast: [] },
    { id: "koma", speaker: "코마", body: "…당신은 아직 목록에 있다.", standing: "koma", cast: [{ id: "koma", slot: "center" }], act: "lean" },
    { id: "koma2", speaker: "코마", body: "내 번호는, 지웠다. 그건 내가 정했다.", standing: "koma", act: "shrink" },
    { id: "lexia", speaker: "렉시아", body: "…지웠다니, 무슨 소리야? 그럼 너는 이제 어디로 가는데?", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "koma", slot: "right" }], act: "nod" },
    { id: "koma3", speaker: "", body: "대답은 없다. 코마는 가리개를 고쳐 쓰고, 연구원 쪽을 한 번 돌아본 뒤 회수조가 사라진 반대편 통로로 걸어간다." },
  ]),
};

export const CHAPTER_3_STORIES: readonly DialogueStory[] = [
  STAGE_3_1_PRE, STAGE_3_4_POST, STAGE_3_5_PRE, STAGE_3_5_POST, STAGE_3_6_POST,
  STAGE_3_8_POST, STAGE_3_9_POST, STAGE_3_10_PRE, STAGE_3_10_POST,
];
