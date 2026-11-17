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
  backdrop: "pressureBroken",
  nodes: linear([
    { id: "enter", speaker: "렉시아", body: "문은 제가 열었어요, 마스터. 이제부터는 제가 앞장설게요!", standing: "lexia", cast: PAIR("lexia"), act: "hop" },
    { id: "rule", speaker: "토리카", body: "렉시아 님, 문은 뽑는 게 아니라 여는 거예요.", standing: "torika", act: "lean" },
    { id: "huh", speaker: "렉시아", body: "…여는 거나 뽑는 거나 결과는 같아. 소리가 다를 뿐이지.", standing: "lexia", act: "shrink" },
    { id: "print", speaker: "도디", body: "대장님, 여기 좀 보세요. 코마 발자국이 입구에서 딱 끊겨 있어요.", standing: "dodi", cast: [{ id: "dodi", slot: "left" }, { id: "lexia", slot: "right" }], act: "lean" },
    { id: "lost", speaker: "도디", body: "그 뒤로는 어지러운 발자국이 셋이에요. 이리저리 헤맨 걸 보니 쟤네도 길을 잃었나 봐요.", standing: "dodi", act: "hopTwice" },
    { id: "again", speaker: "렉시아", body: "그럼 다시 쫓아오겠네. 맞이할 준비 해 둬.", standing: "lexia", act: "nod", cue: "rumble" },
  ]),
};

/** 2-2 후 — 멈춘 라인을 켜 버린 토비, 상자 안의 시제품. */
export const STAGE_2_2_POST: DialogueStory = {
  id: "stage-2-2-post",
  startNodeId: "line",
  backdrop: "assembly",
  nodes: linear([
    { id: "line", speaker: "", body: "멈춰 있던 조립 라인이 덜컹거리며 돌기 시작했다. 레버 앞에는 토비가 서 있었다.", standing: "toby", cast: PAIR("toby"), act: "squash", cue: "rumble" },
    { id: "denial", speaker: "토비", body: "이, 이건 내가 그런 거 아니야! 기대 섰더니 레버가 저절로 내려간 거라고!", standing: "toby", act: "shake" },
    { id: "radio", speaker: "스피나", body: "…들리세요? 라인이 돌아가서 소리가 다 퍼지고 있어요. 연구원님, 이쪽에서 보급 상자를 하나 보낼게요. 받아 주세요.", cast: VOICE("seira", "torika", "toby"), act: "nod" },
    { id: "box", speaker: "", body: "컨베이어를 타고 상자 하나가 연구원의 발치까지 흘러왔다. 안에는 갓 구운 치즈케이크 시제품이 들어 있었다.", standing: "torika" },
    { id: "torika", speaker: "토리카", body: "치즈케이크예요! 누가 보내신 거죠?", standing: "torika", act: "hopTwice" },
    { id: "spina", speaker: "스피나", body: "…스피나예요. 여기서는 되도록 조용히 해 주세요. 오래 머무르셔도 안 되고요." },
    { id: "toby", speaker: "토비", body: "…다 들었거든?! 나도 조용히 할 수 있어!", standing: "toby", act: "rage" },
  ]),
};

/** 2-4 전 — 정전된 중계실, 불이 들어오면 삼인조가 눈앞에 있다. */
export const STAGE_2_4_PRE: DialogueStory = {
  id: "stage-2-4-pre",
  startNodeId: "dark",
  backdrop: "battlefield",
  nodes: linear([
    { id: "dark", speaker: "", body: "중계실은 캄캄했다. 어딘가에서 숨소리가 셋 들렸다.", cast: [] },
    { id: "dodi", speaker: "도디", body: "대장님, 벽에 표식이 있어요. 점 하나는 「쓸 수 없음」, 선 하나는 「옮김」이래요.", standing: "dodi", cast: PAIR("dodi", "parua"), act: "lean" },
    { id: "parua", speaker: "파루아", body: "…도디, 쉿. 우리 말고 숨소리가 셋 더 있어.", standing: "parua", act: "tremble" },
    { id: "light", speaker: "", body: "딸깍, 스위치 소리와 함께 불이 들어왔다. 눈앞에 아모와 토비, 리파가 나란히 서 있었다.", cast: RAID_TRIO, cue: "impact" },
    { id: "toby", speaker: "토비", body: "으악! 불 켜지 말랬잖아!", standing: "toby", act: "fright" },
    { id: "ripa", speaker: "리파", body: "또 너희네? 이번엔 코마가 오기 전에 붙잡아 둘까.", standing: "ripa", act: "hop" },
    { id: "amo", speaker: "아모", body: "…싸워야 하지? 정말 싸워야 해?", standing: "amo", act: "shrink" },
  ]),
};

/** 2-5 전 — 승강장의 끝에서 아모가 혼자 선로를 막는다. */
export const STAGE_2_5_PRE: DialogueStory = {
  id: "stage-2-5-pre",
  startNodeId: "end",
  backdrop: "battlefield",
  nodes: linear([
    { id: "end", speaker: "", body: "파손된 승강장의 끝이었다. 두건을 눌러 쓴 아모가 선로 한가운데에 혼자 서 있었다.", standing: "amo", cast: SOLO("amo") },
    { id: "alone", speaker: "토리카", body: "아모 씨 혼자예요? 토비 씨와 리파 씨는요?", standing: "torika", cast: PAIR("amo"), act: "lean" },
    { id: "away", speaker: "아모", body: "…오지 말라고 했어. 여기만큼은 나 혼자 서고 싶었거든.", standing: "amo", act: "nod" },
    { id: "why", speaker: "아모", body: "저기 라인 끝 보이지? 나, 저기 처음 올려졌다가 쓸 수 없음 표식을 달고 내려왔어.", standing: "amo", act: "shrink" },
    { id: "ask", speaker: "아모", body: "연구원이 그때 한 말이 진짜인지 확인하러 왔어. 그러니까 지나가려면… 내가 먼저 확인해야겠어.", standing: "amo", act: "tremble" },
  ]),
};

/** 2-5 후 — 두건을 올린 아모. */
export const STAGE_2_5_POST: DialogueStory = {
  id: "stage-2-5-post",
  startNodeId: "down",
  backdrop: "battlefield",
  nodes: linear([
    { id: "down", speaker: "", body: "아모가 무릎을 꿇은 채 숨을 골랐다. 눌러 쓰고 있던 두건이 흘러내렸다.", standing: "amo", cast: PAIR("amo", "parua") },
    { id: "hood", speaker: "아모", body: "…이걸 벗은 적이 없었어. 표식이 보일까 봐.", standing: "amo", act: "shrink" },
    { id: "see", speaker: "파루아", body: "…표식 같은 건 안 보여요. 아모 씨 얼굴만 보여요.", standing: "parua", act: "lean" },
    { id: "up", speaker: "아모", body: "…그럼 됐어. 더 보지는 마.", standing: "amo", act: "nod" },
    { id: "pass", speaker: "아모", body: "지나가도 돼. 대신… 토비가 다치지 않게 해 줘.", standing: "amo", act: "hop" },
  ]),
};

/** 2-6 후 — 무인 생산선의 은신 구간. */
export const STAGE_2_6_POST: DialogueStory = {
  id: "stage-2-6-post",
  startNodeId: "belt",
  backdrop: "assembly",
  nodes: linear([
    { id: "belt", speaker: "", body: "아무도 없는 생산선이 쉬지 않고 상자를 내보내고 있었다. 상자마다 같은 표식이 붙어 있었다.", standing: "dodi", cast: PAIR("dodi", "parua") },
    { id: "delopi", speaker: "델로피", body: "짜잔, 연구원님! 반대로 돌렸더니 아까 그 상자가 돌아왔어요! …어? 잠깐만, 이거 왜 안 멈추죠?", cast: VOICE("delopi", "parua", "dodi"), act: "bounce" },
    { id: "parua", speaker: "파루아", body: "…델로피 씨, 그러다 저희까지 들켜요. 얼른 멈춰 주세요.", standing: "parua", act: "tremble" },
    { id: "luka", speaker: "루카", body: "델로피는 내가 맡을게. 연구원님은 저쪽으로 가. 내가 앞에서 길 볼 테니까 발소리만 맞춰서 따라와.", cast: VOICE("luka", "parua", "dodi"), act: "nod" },
    { id: "hush", speaker: "도디", body: "알겠어요. 대장님, 제 발자국 따라오세요. 상자는 밟으면 소리가 나요.", standing: "dodi", act: "hop" },
    { id: "quiet", speaker: "루카", body: "…도디, 지금 네 목소리가 제일 커.", act: "lean" },
    { id: "tail", speaker: "", body: "천장 배관 사이로 마디진 꼬리 하나가 지나갔다. 끝이 갈고리처럼 휜 그림자가 벽을 훑고 사라졌다.", cast: [{ id: "dodi", slot: "left" }, { id: "pulsi", slot: "right", veiled: true }], cue: "rumble" },
    { id: "saw", speaker: "도디", body: "대, 대장님! 방금 위에서 꼬리가 지나갔어요! 이렇게, 이렇게 휘어진 거요!", standing: "dodi", act: "hopTwice" },
    { id: "who", speaker: "파루아", body: "…라인 소리에 묻혀서 발소리를 못 들었어요. 델로피 씨 장난은 아닌 것 같아요.", standing: "parua", cast: PAIR("dodi", "parua"), act: "tremble" },
    { id: "mark", speaker: "루카", body: "상자 위 표식 봐. 폐기 표식이 아니라 회수 표식이야. 이 회랑에 우리 말고도 물건 거두러 온 놈들이 있어.", cast: VOICE("luka", "parua", "dodi"), act: "nod" },
  ]),
};

/** 2-7 전 — 닫힌 문. 연구원만 격실에 갇힌다. */
export const STAGE_2_7_PRE: DialogueStory = {
  id: "stage-2-7-pre",
  startNodeId: "room",
  backdrop: "pressureClosed",
  nodes: linear([
    { id: "room", speaker: "", body: "압력 격실에 들어서는 순간 등 뒤에서 문이 닫혔다. 안에는 연구원 혼자뿐이었다.", cast: [], cue: "impact" },
    { id: "toby", speaker: "토비", body: "어, 어! 문이 닫혔어! 안에서 소리가 안 나, 열어! 열라고!", standing: "toby", cast: RAID_TRIO, act: "shake" },
    { id: "amo", speaker: "아모", body: "…내가 안 그랬어. 레버는 안 건드렸어.", standing: "amo", act: "shrink" },
    { id: "ripa", speaker: "리파", body: "저 문, 우리가 잠근 거 아니야. 안쪽에 연구원 있는 거 맞아?", standing: "ripa", act: "recoil" },
    { id: "toby2", speaker: "토비", body: "비켜 봐! 내가 열게!", standing: "toby", act: "rage", cue: "rumble" },
  ]),
};

/** 2-7 후 — 토비가 문을 뜯고 구한다. 한 묶음 안에서 끝난다. */
export const STAGE_2_7_POST: DialogueStory = {
  id: "stage-2-7-post",
  startNodeId: "tear",
  backdrop: "pressureClosed",
  nodes: linear([
    { id: "tear", speaker: "", body: "경첩째 뽑힌 격실 문이 바닥에 쓰러졌다. 문 앞에 토비가 숨을 몰아쉬며 서 있었다.", backdrop: "pressureBroken", cast: [], cue: "explosion" },
    { id: "safe", speaker: "토비", body: "괘, 괜찮아?! 다친 데는 없지?", standing: "toby", cast: PAIR("toby"), act: "fright" },
    { id: "torika", speaker: "토리카", body: "토비 씨가 문을 뜯었어요… 대장님을 구하려고요.", standing: "torika", act: "lean" },
    { id: "awkward", speaker: "토비", body: "…다치게 하면 안 된다고 했단 말이야. 붙잡으랬지, 저런 데 가두라고는 안 했어!", standing: "toby", act: "tremble" },
    { id: "silence", speaker: "", body: "한동안 아무도 입을 열지 않았다. 뽑혀 나간 문짝만 바닥에서 천천히 식어 갔다." },
    { id: "thanks", speaker: "토리카", body: "…고마워요. 그렇지만 대장님을 데려가게 둘 순 없어요.", standing: "torika", act: "nod" },
  ]),
};

/** 2-8 전 — 용광로 곁에서 코마가 표식을 닦고 있다. */
export const STAGE_2_8_PRE: DialogueStory = {
  id: "stage-2-8-pre",
  startNodeId: "furnace",
  backdrop: "assembly",
  nodes: linear([
    { id: "furnace", speaker: "", body: "꺼져 가는 용광로 곁에서 코마가 쪼그려 앉아 벽의 폐기 표식을 닦고 있었다.", standing: "koma", cast: SOLO("koma") },
    { id: "see", speaker: "코마", body: "…왔나.", standing: "koma", act: "nod" },
    { id: "fight", speaker: "토리카", body: "싸우실 건가요, 코마 씨?", standing: "torika", cast: PAIR("koma"), act: "lean" },
    { id: "no", speaker: "코마", body: "싸우지 않는다.", standing: "koma" },
    { id: "above", speaker: "코마", body: "위에서는 아직 모른다. 이 표식을 닦는 것도. 너희가 여기까지 온 것도.", standing: "koma", act: "shrink" },
    { id: "trio", speaker: "리파", body: "…코마, 너 지금 뭐 하는 거야? 위에서 모르는 일을 해도 돼?", standing: "ripa", cast: [{ id: "ripa", slot: "left" }, { id: "koma", slot: "right" }], act: "recoil" },
    { id: "leave", speaker: "코마", body: "…가라. 대신 다시는 이쪽으로 오지 마라.", standing: "koma", cast: [{ id: "ripa", slot: "left" }], act: "nod" },
  ]),
};

/** 2-8 후 — 회수조 둘이 처음으로 얼굴을 보인다. 싸우지 않고, 코마에게 한마디만 남기고 간다. */
export const STAGE_2_8_POST: DialogueStory = {
  id: "stage-2-8-post",
  startNodeId: "drop",
  backdrop: "assembly",
  nodes: linear([
    { id: "drop", speaker: "", body: "용광로 위 파이프에서 가벼운 날갯소리가 났다. 잠자리 날개를 접은 그림자 하나와 몸집만 한 턱을 가진 그림자 하나가 사뿐히 내려섰다.", cast: [{ id: "koma", slot: "left" }, { id: "neuri", slot: "center" }, { id: "mir", slot: "right" }], cue: "impact" },
    { id: "hello", speaker: "네우리", body: "후훗… 당신이… 연구원님이시군요? 역시… 듣던 대로… 어흠.", standing: "neuri", act: "hop" },
    { id: "koma", speaker: "네우리", body: "그건 그렇고, 코마 님! 결국… 결국 실패하셨네요?", standing: "neuri", act: "lean" },
    { id: "komaReply", speaker: "코마", body: "…네우리. 보고를 받으러 왔나.", standing: "koma", act: "shrink" },
    { id: "polite", speaker: "네우리", body: "어머, 보고라니요. 저희 같은 말단이 어찌 감히. 다만 위에서 「테러조는 이제 쉬셔도 된다」고 하셔서요. 아주, 아주 정중하게 전해 드리러 왔답니다.", standing: "neuri", act: "bounce" },
    { id: "mir", speaker: "미르", body: "…길. 막혀 있다. 치운다.", standing: "mir", act: "nod" },
    { id: "bye", speaker: "네우리", body: "아, 그렇지, 미르. …그럼 연구원님, 다음에 또 뵙지요. 그때는 저희 회수조가 직접 모시러 오겠습니다.", standing: "neuri", act: "nod", leave: "blastOff", cast: [{ id: "koma", slot: "left" }] },
    { id: "torika", speaker: "토리카", body: "코마 씨… 실패하셨다는 게 무슨 말이에요?", standing: "torika", cast: PAIR("koma"), act: "lean" },
    { id: "later", speaker: "코마", body: "…나중에 말하지. 저 둘이 이 구역까지 내려왔다는 것만 기억해라.", standing: "koma", act: "shrink" },
  ]),
};

/** 2-9 후 — 컨베이어가 끝나는 곳의 구멍. */
export const STAGE_2_9_POST: DialogueStory = {
  id: "stage-2-9-post",
  startNodeId: "hole",
  backdrop: "assembly",
  nodes: linear([
    { id: "hole", speaker: "", body: "컨베이어가 끝나는 자리에는 바닥이 없었다. 폐기 표식이 붙은 상자들이 소리 없이 어둠 속으로 떨어졌다.", standing: "dodi", cast: PAIR("dodi", "lexia") },
    { id: "dodi", speaker: "도디", body: "다들 이 아래로 흘러간 거예요. 쓸 수 없음이라고 적힌 채로…", standing: "dodi", act: "shrink" },
    { id: "lexia", speaker: "렉시아", body: "아래에는 뭐가 있어?", standing: "lexia", act: "lean" },
    { id: "dei", speaker: "데이", body: "구멍 가장자리에 낙서 같은 화살표가 있어! 내가 그린 거 아니야, 진짜야. 누가 아래로 가는 길을 표시해 놨어.", cast: VOICE("deina", "lexia", "dodi"), act: "lean" },
    { id: "stay", speaker: "", body: "렉시아의 물음에 대답하는 이는 없었다. 연구원은 구멍 앞에 한참 서 있었다." },
    { id: "torika", speaker: "토리카", body: "…가요, 대장님. 아직은 위에서 할 일이 있어요.", standing: "torika", cast: PAIR("lexia"), act: "nod" },
  ]),
};

/** 2-10 전 — 삼인조가 코마 없이 처음으로 셋이 선다. */
export const STAGE_2_10_PRE: DialogueStory = {
  id: "stage-2-10-pre",
  startNodeId: "gate",
  backdrop: "battlefield",
  nodes: linear([
    { id: "gate", speaker: "", body: "잔향 지구의 관문이었다. 아모와 토비, 리파가 나란히 서서 길을 막고 있었다. 코마는 보이지 않았다.", cast: RAID_TRIO },
    { id: "toby", speaker: "토비", body: "코마한테 안 물어봤어. 우리가 정했어. 여기서 막자고.", standing: "toby", act: "puff" },
    { id: "amo", speaker: "아모", body: "…나랑 토비랑 리파, 셋이서.", standing: "amo", act: "nod" },
    { id: "ripa", speaker: "리파", body: "지나갈 수 있을지는 우리가 정할 거야. 이번엔 누구 명령도 아니고.", standing: "ripa", act: "lean" },
    { id: "torika", speaker: "토리카", body: "…대장님한테는 못 보내요. 정말 싸울 거면 저부터 상대해요.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "toby", slot: "right" }], act: "nod" },
  ]),
};

/** 2-10 후 — 「따라가도 돼?」. 연구원의 대답은 선택지로 갈리고 흐름은 하나로 모인다. */
export const STAGE_2_10_POST: DialogueStory = {
  id: "stage-2-10-post",
  startNodeId: "lose",
  backdrop: "battlefield",
  nodes: [
    { id: "lose", speaker: "", body: "셋은 서로를 붙든 채 그 자리에 주저앉았다. 아무도 도망치지 않았다.", cast: RAID_TRIO, nextId: "toby" },
    { id: "toby", speaker: "토비", body: "…졌네. 근데 이상하다. 하나도 안 분해.", standing: "toby", act: "shrink", nextId: "ripa" },
    { id: "ripa", speaker: "리파", body: "코마가 시키지도 않았는데 끝까지 버텼네. 우리 셋 다.", standing: "ripa", act: "nod", nextId: "amo" },
    { id: "amo", speaker: "아모", body: "…연구원.", standing: "amo", act: "tremble", nextId: "ask" },
    { id: "ask", speaker: "아모", body: "우리도 같이 가면 안 돼? 네 말을 다 믿는 건 아니야. 그냥… 더 들어 보고 싶어.", standing: "amo", act: "lean", nextId: "choose" },
    {
      id: "choose", speaker: "토리카", body: "대장님, 뭐라고 하실 거예요?", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "amo", slot: "right" }],
      choices: [
        { id: "yes", label: "따라와도 돼", nextId: "answerA", effect: { type: "bondXp", relicId: "torika", amount: 3 } },
        { id: "own", label: "너희가 정해도 돼", nextId: "answerB", effect: { type: "bondXp", relicId: "dodo", amount: 3 } },
      ],
    },
    { id: "answerA", speaker: "아모", body: "…그래. 그럼 따라갈게.", standing: "amo", act: "nod", nextId: "walk" },
    { id: "answerB", speaker: "아모", body: "…우리가 정해도 된다는 말, 처음 들어 봐.", standing: "amo", act: "nod", nextId: "walk" },
    { id: "walk", speaker: "토비", body: "그, 그렇다고 우리가 한편 되는 건 아니야! 뒤에서 따라가기만 하는 거야!", standing: "toby", cast: RAID_TRIO, act: "hopTwice", nextId: "hole" },
    { id: "hole", speaker: "", body: "일행이 걸음을 옮겼다. 등 뒤에서 구멍의 어둠이 숨을 쉬듯 일렁였다. 무언가가 아래에서 올려다보고 있었다.", cue: "rumble", nextId: "wing" },
    { id: "wing", speaker: "", body: "구멍 위로 거대한 날개 그림자가 펼쳐졌다가 접혔다. 소리는 나지 않았다. 박쥐의 날개 같았다.", cast: [{ id: "ikanixia", slot: "center", veiled: true }], standing: "ikanixia", cue: "impact", nextId: "voice" },
    { id: "voice", speaker: "???", body: "…회수 개시.", standing: "ikanixia", act: "nod" },
  ],
};

export const CHAPTER_2_STORIES: readonly DialogueStory[] = [
  STAGE_2_1_PRE, STAGE_2_2_POST, STAGE_2_4_PRE, STAGE_2_5_PRE, STAGE_2_5_POST, STAGE_2_6_POST,
  STAGE_2_7_PRE, STAGE_2_7_POST, STAGE_2_8_PRE, STAGE_2_8_POST, STAGE_2_9_POST, STAGE_2_10_PRE, STAGE_2_10_POST,
];

// 번역 등록(`registerDialogueTexts`)은 원고가 확정된 뒤에 한다 — 확정 전에 열한 언어를 채우면 고칠 때마다 전부 다시 옮겨야 한다.
