import type { DialogueCastMember, DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";
import { RAID_TRIO } from "./openingTrain";

/*
 * **2장 — 잔향 지구 (2-1 ~ 2-10).**
 *
 * 1장에서 연구원이 건넨 「실패작이 아니야」를 삼인조가 곱씹다가 확인하러 따라온다. 이 회랑은 폐기된
 * 산물이 컨베이어를 타고 아래로 흘러간 길이고, 삼인조에게는 「집」이다. 연구원이 갇히는 장면(2-7)은
 * 같은 묶음 안에서 구해져 끝난다. 나이트 기어와 스피나·루카·델로피·데이는 무전으로만 나오므로 옅은 푸른 투영으로 세운다(얼굴은 가리지 않는다).
 */

/** 무전 너머의 목소리 하나를 가운데에 세우고 곁에 두 사람을 둔다. */
const VOICE = (
  voice: "seira" | "delopi" | "luka" | "deina",
  left: "torika" | "parua" | "lexia",
  right: "toby" | "dodi",
): readonly DialogueCastMember[] => [{ id: left, slot: "left" }, { id: voice, slot: "center", remote: true }, { id: right, slot: "right" }];

const SOLO = (id: "amo" | "toby" | "ripa" | "koma" | "dodi"): readonly DialogueCastMember[] => [{ id, slot: "center" }];
const PAIR = (id: "amo" | "toby" | "ripa" | "koma" | "lexia" | "dodi", other: "torika" | "parua" | "dodi" | "lexia" = "torika"): readonly DialogueCastMember[] => [
  { id: other, slot: "left" }, { id, slot: "right" },
];

/** 2-1 전 — 경계문 안쪽, 코마의 발자국이 멈춘 자리. */
export const STAGE_2_1_PRE: DialogueStory = {
  id: "stage-2-1-pre",
  startNodeId: "enter",
  backdrop: "battlefield",
  nodes: linear([
    { id: "enter", speaker: "렉시아", body: "문은 내가 열었다. 이제부터는 내가 앞장선다!", standing: "lexia", cast: PAIR("lexia"), act: "hop" },
    { id: "rule", speaker: "토리카", body: "렉시아 님, 문은 뽑는 게 아니라 여는 거예요.", standing: "torika", act: "lean" },
    { id: "huh", speaker: "렉시아", body: "…여는 것과 뽑는 것은 결과가 같다. 다만 소리가 다를 뿐이다.", standing: "lexia", act: "shrink" },
    { id: "print", speaker: "도디", body: "대장님, 여기 발자국이요. 코마의 발자국이 입구에서 딱 멈춰 있어요.", standing: "dodi", cast: [{ id: "dodi", slot: "left" }, { id: "lexia", slot: "right" }], act: "lean" },
    { id: "lost", speaker: "도디", body: "그리고 그 뒤로 어지러운 발자국이 셋이에요. 이쪽저쪽 헤맨 흔적… 쟤네도 길을 잃은 것 같아요.", standing: "dodi", act: "hopTwice" },
    { id: "again", speaker: "렉시아", body: "그렇다면 다시 쫓아올 것이다. 맞이할 준비를 하라.", standing: "lexia", act: "nod", cue: "rumble" },
  ]),
};

/** 2-2 후 — 멈춘 라인을 켜 버린 토비, 상자 안의 시제품. */
export const STAGE_2_2_POST: DialogueStory = {
  id: "stage-2-2-post",
  startNodeId: "line",
  backdrop: "battlefield",
  nodes: linear([
    { id: "line", speaker: "", body: "멈춰 있던 조립 라인이 덜컹, 하고 돌기 시작한다. 레버 앞에 토비가 서 있다.", standing: "toby", cast: PAIR("toby"), act: "squash", cue: "rumble" },
    { id: "denial", speaker: "토비", body: "이, 이건 아니야! 기대어 섰는데 저절로 내려간 거라고!", standing: "toby", act: "shake" },
    { id: "radio", speaker: "스피나", body: "…무전 확인. 라인이 돌고 있으니 소리가 다 퍼진다. 연구원, 상자를 받아라. 이쪽에서 보내는 보급이다.", cast: VOICE("seira", "torika", "toby"), act: "nod" },
    { id: "box", speaker: "", body: "컨베이어를 타고 상자 하나가 연구원 발치까지 흘러온다. 안에는 갓 구운 치즈케이크 시제품이 들어 있다.", standing: "torika" },
    { id: "torika", speaker: "토리카", body: "치즈케이크예요! 누가 보내신 거죠?", standing: "torika", act: "hopTwice" },
    { id: "spina", speaker: "스피나", body: "나이트 기어의 인사다. 이 회랑에서는 조용히, 빨리가 규칙이다. 토비라는 아이에게도 전해라." },
    { id: "toby", speaker: "토비", body: "…다 들었거든?! 나도 조용히 할 수 있어!", standing: "toby", act: "rage" },
  ]),
};

/** 2-4 전 — 정전된 중계실, 불이 들어오면 삼인조가 눈앞에 있다. */
export const STAGE_2_4_PRE: DialogueStory = {
  id: "stage-2-4-pre",
  startNodeId: "dark",
  backdrop: "battlefield",
  nodes: linear([
    { id: "dark", speaker: "", body: "중계실은 캄캄하다. 어딘가에서 숨소리가 셋 들린다.", cast: [] },
    { id: "dodi", speaker: "도디", body: "대장님, 벽에 표식이 있어요. 점 하나는 「쓸 수 없음」, 선 하나는 「옮김」이래요.", standing: "dodi", cast: PAIR("dodi", "parua"), act: "lean" },
    { id: "parua", speaker: "파루아", body: "…도디, 숨소리가 셋이에요. 우리 숨소리 말고.", standing: "parua", act: "tremble" },
    { id: "light", speaker: "", body: "스위치 소리와 함께 불이 들어온다. 눈앞에 아모와 토비, 리파가 나란히 서 있다.", cast: RAID_TRIO, cue: "impact" },
    { id: "toby", speaker: "토비", body: "으악! 불 켜지 말랬잖아!", standing: "toby", act: "fright" },
    { id: "ripa", speaker: "리파", body: "먼저 켠 건 쟤네잖아? 아, 그냥 얼굴 보니까 반갑다.", standing: "ripa", act: "hop" },
    { id: "amo", speaker: "아모", body: "…싸워야 하지? 정말 싸워야 해?", standing: "amo", act: "shrink" },
  ]),
};

/** 2-5 전 — 승강장의 끝에서 아모가 혼자 선로를 막는다. */
export const STAGE_2_5_PRE: DialogueStory = {
  id: "stage-2-5-pre",
  startNodeId: "end",
  backdrop: "battlefield",
  nodes: linear([
    { id: "end", speaker: "", body: "파손된 승강장의 끝. 두건을 눌러 쓴 아모가 선로 한가운데에 혼자 서 있다.", standing: "amo", cast: SOLO("amo") },
    { id: "alone", speaker: "토리카", body: "아모 씨 혼자예요? 토비 씨와 리파 씨는요?", standing: "torika", cast: PAIR("amo"), act: "lean" },
    { id: "away", speaker: "아모", body: "…내가 오지 말라고 했어. 여기는 내가 혼자 서야 하는 곳이야.", standing: "amo", act: "nod" },
    { id: "why", speaker: "아모", body: "저기 라인 끝, 저 자리에서 내가 처음 올라가 표식을 달고 내려졌어. 쓸 수 없음이라고.", standing: "amo", act: "shrink" },
    { id: "ask", speaker: "아모", body: "연구원이 한 말, 진짜인지 확인하러 왔어. 지나가려면… 내가 확인해야 해.", standing: "amo", act: "tremble" },
  ]),
};

/** 2-5 후 — 두건을 올린 아모. */
export const STAGE_2_5_POST: DialogueStory = {
  id: "stage-2-5-post",
  startNodeId: "down",
  backdrop: "battlefield",
  nodes: linear([
    { id: "down", speaker: "", body: "아모가 무릎을 꿇은 채 숨을 고른다. 눌러 쓴 두건이 흘러내린다.", standing: "amo", cast: PAIR("amo", "parua") },
    { id: "hood", speaker: "아모", body: "…이걸 벗은 적이 없었어. 표식이 보일까 봐.", standing: "amo", act: "shrink" },
    { id: "see", speaker: "파루아", body: "…지금은 안 보여요. 보이는 건 아모 씨 얼굴이에요.", standing: "parua", act: "lean" },
    { id: "up", speaker: "아모", body: "…그렇구나. 그럼 계속 올려 둘까.", standing: "amo", act: "nod" },
    { id: "pass", speaker: "아모", body: "지나가도 돼. 대신… 토비가 다치지 않게 해 줘.", standing: "amo", act: "hop" },
  ]),
};

/** 2-6 후 — 무인 생산선의 은신 구간. */
export const STAGE_2_6_POST: DialogueStory = {
  id: "stage-2-6-post",
  startNodeId: "belt",
  backdrop: "battlefield",
  nodes: linear([
    { id: "belt", speaker: "", body: "아무도 없는 생산선이 상자를 쉬지 않고 내보낸다. 상자마다 같은 표식이 붙어 있다.", standing: "dodi", cast: PAIR("dodi", "parua") },
    { id: "delopi", speaker: "델로피", body: "으히히, 라인을 거꾸로 돌렸더니 상자가 다 웃으면서 돌아오네? 연구원, 놀랐지?", cast: VOICE("delopi", "parua", "dodi"), act: "bounce" },
    { id: "parua", speaker: "파루아", body: "…델로피 씨, 그건 저희를 위험하게 해요.", standing: "parua", act: "tremble" },
    { id: "luka", speaker: "루카", body: "델로피는 내가 맡겠다. 연구원, 이제부터는 내 신호를 따라와라. 말 없이, 빨리.", cast: VOICE("luka", "parua", "dodi"), act: "nod" },
    { id: "hush", speaker: "도디", body: "그, 그럼 숨 죽이고… 이건 \"침묵 이동\"으로 적어 둘게요!", standing: "dodi", act: "hop" },
    { id: "quiet", speaker: "루카", body: "그 소리가 제일 크다.", act: "lean" },
  ]),
};

/** 2-7 전 — 닫힌 문. 연구원만 격실에 갇힌다. */
export const STAGE_2_7_PRE: DialogueStory = {
  id: "stage-2-7-pre",
  startNodeId: "room",
  backdrop: "battlefield",
  nodes: linear([
    { id: "room", speaker: "", body: "압력 격실에 들어서는 순간 등 뒤에서 문이 닫힌다. 안쪽에는 연구원 혼자다.", cast: [], cue: "impact" },
    { id: "toby", speaker: "토비", body: "어, 어! 문이 닫혔어! 안에서 소리가 안 나, 열어! 열라고!", standing: "toby", cast: RAID_TRIO, act: "shake" },
    { id: "amo", speaker: "아모", body: "…내가 안 그랬어. 레버는 안 건드렸어.", standing: "amo", act: "shrink" },
    { id: "ripa", speaker: "리파", body: "설비가 오작동한 거야. 우리가 싸우려던 것도 아닌데?", standing: "ripa", act: "recoil" },
    { id: "toby2", speaker: "토비", body: "비켜 봐! 내가 열게!", standing: "toby", act: "rage", cue: "rumble" },
  ]),
};

/** 2-7 후 — 토비가 문을 뜯고 구한다. 한 묶음 안에서 끝난다. */
export const STAGE_2_7_POST: DialogueStory = {
  id: "stage-2-7-post",
  startNodeId: "tear",
  backdrop: "battlefield",
  nodes: linear([
    { id: "tear", speaker: "", body: "경첩째 뽑힌 격실 문이 바닥에 쓰러진다. 문 앞에 토비가 숨을 몰아쉬며 서 있다.", standing: "toby", cast: PAIR("toby"), cue: "explosion" },
    { id: "safe", speaker: "토비", body: "괘, 괜찮아?! 다친 데는 없지?", standing: "toby", act: "fright" },
    { id: "torika", speaker: "토리카", body: "토비 씨가 문을 뜯었어요… 대장님을 구하려고요.", standing: "torika", act: "lean" },
    { id: "awkward", speaker: "토비", body: "그, 그게 아니라! 문이 거슬려서 그런 거야! …별 뜻 없어!", standing: "toby", act: "tremble" },
    { id: "silence", speaker: "", body: "아무도 말하지 않는다. 뽑힌 문짝만 천천히 쓰러진 자리에서 식는다." },
    { id: "thanks", speaker: "토리카", body: "고마워요, 토비 씨. 이제 가요.", standing: "torika", act: "nod" },
  ]),
};

/** 2-8 전 — 용광로 곁에서 코마가 표식을 닦고 있다. */
export const STAGE_2_8_PRE: DialogueStory = {
  id: "stage-2-8-pre",
  startNodeId: "furnace",
  backdrop: "battlefield",
  nodes: linear([
    { id: "furnace", speaker: "", body: "꺼져 가는 용광로 곁. 코마가 쪼그려 앉아 벽의 폐기 표식을 닦고 있다.", standing: "koma", cast: SOLO("koma") },
    { id: "see", speaker: "코마", body: "…왔나.", standing: "koma", act: "nod" },
    { id: "fight", speaker: "토리카", body: "싸우실 건가요, 코마 씨?", standing: "torika", cast: PAIR("koma"), act: "lean" },
    { id: "no", speaker: "코마", body: "싸우지 않는다. 지금은.", standing: "koma" },
    { id: "above", speaker: "코마", body: "위에서는 아직 모른다. 이 표식을 닦는 것도. 너희가 여기까지 온 것도.", standing: "koma", act: "shrink" },
    { id: "trio", speaker: "리파", body: "…코마, 너 지금 뭐 하는 거야? 위에서 모르는 일을 해도 돼?", standing: "ripa", cast: [{ id: "ripa", slot: "left" }, { id: "koma", slot: "right" }], act: "recoil" },
    { id: "leave", speaker: "코마", body: "…가라. 대신 이쪽으로 오지 마라.", standing: "koma", cast: [{ id: "ripa", slot: "left" }], act: "nod" },
  ]),
};

/** 2-9 후 — 컨베이어가 끝나는 곳의 구멍. */
export const STAGE_2_9_POST: DialogueStory = {
  id: "stage-2-9-post",
  startNodeId: "hole",
  backdrop: "battlefield",
  nodes: linear([
    { id: "hole", speaker: "", body: "컨베이어가 끝나는 곳에 바닥이 없다. 폐기 표식이 붙은 상자들이 소리 없이 어둠으로 떨어진다.", standing: "dodi", cast: PAIR("dodi", "lexia") },
    { id: "dodi", speaker: "도디", body: "다들 이 아래로 흘러간 거예요. 쓸 수 없음이라고 적힌 채로…", standing: "dodi", act: "shrink" },
    { id: "lexia", speaker: "렉시아", body: "아래에는 무엇이 있느냐.", standing: "lexia", act: "lean" },
    { id: "dei", speaker: "데이", body: "구멍 가장자리에 낙서 같은 화살표가 있어. 내가 그린 거 아니야. 누군가가 아래로 향하는 길을 표시해 뒀어.", cast: VOICE("deina", "lexia", "dodi"), act: "lean" },
    { id: "stay", speaker: "", body: "연구원은 구멍 앞에서 오래 서 있다. 대답하는 이는 없다." },
    { id: "torika", speaker: "토리카", body: "…가요, 대장님. 아직은 위에서 할 일이 있어요.", standing: "torika", cast: PAIR("lexia"), act: "nod" },
  ]),
};

/** 2-10 전 — 삼인조가 코마 없이 처음으로 셋이 선다. */
export const STAGE_2_10_PRE: DialogueStory = {
  id: "stage-2-10-pre",
  startNodeId: "gate",
  backdrop: "battlefield",
  nodes: linear([
    { id: "gate", speaker: "", body: "잔향 지구의 관문. 아모와 토비, 리파가 나란히 서서 길을 막고 있다. 코마는 보이지 않는다.", cast: RAID_TRIO },
    { id: "toby", speaker: "토비", body: "코마한테 안 물어봤어. 우리가 정했어. 여기서 막자고.", standing: "toby", act: "puff" },
    { id: "amo", speaker: "아모", body: "…나랑 토비랑 리파, 셋이서.", standing: "amo", act: "nod" },
    { id: "ripa", speaker: "리파", body: "이기려는 게 아니야. 확인하려는 거야. 우리가 정말 우리인지.", standing: "ripa", act: "lean" },
    { id: "torika", speaker: "토리카", body: "…알겠어요. 받아 낼게요.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "toby", slot: "right" }], act: "nod" },
  ]),
};

/** 2-10 후 — 「따라가도 돼?」. 연구원의 대답은 선택지로 갈리고 흐름은 하나로 모인다. */
export const STAGE_2_10_POST: DialogueStory = {
  id: "stage-2-10-post",
  startNodeId: "lose",
  backdrop: "battlefield",
  nodes: [
    { id: "lose", speaker: "", body: "셋은 쓰러지지 않고 서로를 붙든 채 앉는다. 아무도 도망치지 않는다.", cast: RAID_TRIO, nextId: "toby" },
    { id: "toby", speaker: "토비", body: "…졌네. 그런데 이상하다. 되게 안 분해.", standing: "toby", act: "shrink", nextId: "ripa" },
    { id: "ripa", speaker: "리파", body: "우리끼리 막아 낸 건 이번이 처음이야. 그래서 그런가.", standing: "ripa", act: "nod", nextId: "amo" },
    { id: "amo", speaker: "아모", body: "…연구원.", standing: "amo", act: "tremble", nextId: "ask" },
    { id: "ask", speaker: "아모", body: "우리, 따라가도 돼? 아직 「그래」라고는 못 하겠는데… 그래도 따라가도 돼?", standing: "amo", act: "lean", nextId: "choose" },
    {
      id: "choose", speaker: "토리카", body: "대장님, 뭐라고 하실 거예요?", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "amo", slot: "right" }],
      choices: [
        { id: "yes", label: "따라와도 돼", nextId: "answerA", effect: { type: "bondXp", relicId: "torika", amount: 3 } },
        { id: "own", label: "너희가 정해도 돼", nextId: "answerB", effect: { type: "bondXp", relicId: "dodi", amount: 3 } },
      ],
    },
    { id: "answerA", speaker: "아모", body: "…그래. 그럼 따라갈게.", standing: "amo", act: "nod", nextId: "walk" },
    { id: "answerB", speaker: "아모", body: "…우리가 정해도 된다는 말, 처음 들어 봐.", standing: "amo", act: "nod", nextId: "walk" },
    { id: "walk", speaker: "토비", body: "그, 그렇다고 우리가 한편 되는 건 아니야! 뒤에서 따라가기만 하는 거야!", standing: "toby", cast: RAID_TRIO, act: "hopTwice", nextId: "hole" },
    { id: "hole", speaker: "", body: "일행이 걸음을 옮긴다. 뒤에서 구멍의 어둠이 한 번 숨을 쉬듯 일렁인다. 무언가가 올려다보고 있다.", cue: "rumble" },
  ],
};

export const CHAPTER_2_STORIES: readonly DialogueStory[] = [
  STAGE_2_1_PRE, STAGE_2_2_POST, STAGE_2_4_PRE, STAGE_2_5_PRE, STAGE_2_5_POST, STAGE_2_6_POST,
  STAGE_2_7_PRE, STAGE_2_7_POST, STAGE_2_8_PRE, STAGE_2_9_POST, STAGE_2_10_PRE, STAGE_2_10_POST,
];

// 번역 등록(`registerDialogueTexts`)은 원고가 확정된 뒤에 한다 — 확정 전에 열한 언어를 채우면 고칠 때마다 전부 다시 옮겨야 한다.
