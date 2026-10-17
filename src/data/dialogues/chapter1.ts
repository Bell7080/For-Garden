import type { DialogueCastMember, DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";
import { RAID_TRIO, ROGUE_TRIO } from "./openingTrain";

/*
 * **1장 — 제1지부 외곽 (1-2 ~ 1-10).**
 *
 * 1장은 열 개의 사건이 아니라 **수송 열차 습격 하나가 이어지는 중**이다(`docs/lore.md` §6). 그래서
 * 모든 관문에 대사를 달지 않고, 장면이 필요한 자리에만 전(前)·후(後) 대사를 단다. 전 대사는 출격을
 * 누른 뒤 편성 전에, 후 대사는 이긴 뒤 결과판을 닫고 나서 **처음 한 번만** 흐른다.
 *
 * 공멸은 연구원을 해치려는 쪽이 아니라 데려가려는 쪽이라 대사에 적의가 없다. 코마가 흘리는 「위」는
 * 상층부인지 누군가의 지시인지 정하지 않는다. 무전 너머의 목소리(스테라·켄토)와 문 너머의 오비는 옅은 푸른 투영으로 세운다(얼굴은 가리지 않는다).
 */

/** 만나지 못하고 들리는 목소리 하나를 가운데에 세우고 곁에 두 사람을 둔다. */
const VOICE = (voice: "stella" | "kento" | "obi", left: "torika" | "dodi", right: "dodi" | "parua"): readonly DialogueCastMember[] => [
  { id: left, slot: "left" }, { id: voice, slot: "center", remote: true }, { id: right, slot: "right" },
];

/** 1-8 — 수문 위의 티아를 가운데에 두고 토리카와 파루아가 곁에 선다. */
const TIA_TRIO: readonly DialogueCastMember[] = [{ id: "torika", slot: "left" }, { id: "tia", slot: "center" }, { id: "parua", slot: "right" }];

const ALONE = (id: "koma" | "toby" | "lexia"): readonly DialogueCastMember[] => [{ id, slot: "center" }];

/** 1-2 후 — 유리 지붕에서 떨어진 삼인조가 코마를 입에 올린다. */
export const STAGE_1_2_POST: DialogueStory = {
  id: "stage-1-2-post",
  startNodeId: "fall",
  backdrop: "battlefield",
  nodes: linear([
    { id: "fall", speaker: "토비", body: "으윽… 유리 지붕이 이렇게 약할 줄은 몰랐어!", standing: "toby", cast: RAID_TRIO, act: "squash", cue: "impact" },
    { id: "hush", speaker: "아모", body: "내가 밟지 말랬잖아… 소리 나면 들킨다고.", standing: "amo", act: "shrink" },
    { id: "late", speaker: "리파", body: "이미 들켰는걸? 위에서 보니까 쟤네 우리 쪽으로 곧장 오던데.", standing: "ripa", act: "hop" },
    { id: "where", speaker: "토비", body: "그보다 코마는 어디 갔어? 아직도 안 왔어?", standing: "toby", act: "hopTwice" },
    { id: "door", speaker: "아모", body: "…문 앞에 먼저 가 있을 거야. 언제나 그랬잖아.", standing: "amo", act: "nod" },
    { id: "heard", speaker: "파루아", body: "…저 이름, 들었어요. 코마. 앞에서 길을 보는 쪽이에요.", standing: "parua", cast: ROGUE_TRIO, act: "lean" },
    { id: "log", speaker: "도디", body: "적어 둘게요! 선봉은 코마, 저 셋은 그 뒤를 쫓는 쪽… 맞죠?", standing: "dodi", act: "hop" },
    { id: "go", speaker: "토리카", body: "먼 신호가 관제탑 쪽에서 계속 깜빡이네요. 대장님, 그쪽으로 가 봐요!", standing: "torika", act: "nod" },
  ]),
};

/** 1-4 전 — 표본 보관고에 남은 손자국을 도디가 읽는다. */
export const STAGE_1_4_PRE: DialogueStory = {
  id: "stage-1-4-pre",
  startNodeId: "cases",
  backdrop: "battlefield",
  nodes: linear([
    { id: "cases", speaker: "도디", body: "대장님, 이 진열장 좀 보세요! 같은 손자국이 줄줄이 남아 있어요.", standing: "dodi", cast: ROGUE_TRIO, act: "hopTwice" },
    { id: "size", speaker: "파루아", body: "…크기가 같아요. 한 명이 이 방을 계속 돌았어요.", standing: "parua", act: "lean" },
    { id: "habit", speaker: "도디", body: "손가락이 비스듬하고, 유리 가장자리마다 눌린 자국이 있어요. 낯선 건 일단 먼저 만지고 보는 손이에요.", standing: "dodi", act: "nod" },
    { id: "ask", speaker: "토리카", body: "방금 만난 사람 버릇을 어떻게 알아?", standing: "torika", act: "shake" },
    { id: "train", speaker: "도디", body: "아까 열차에서 문 손잡이를 제일 먼저 만진 손이랑 같아요. 기록해 뒀거든요!", standing: "dodi", act: "hop" },
    { id: "alarm", speaker: "토리카", body: "그럼 이 방 경보도 그 애가 켰겠네요. 대장님, 조심조심 가요!", standing: "torika", act: "nod" },
  ]),
};

/** 1-5 전 — 혼자 먼저 달려와 방벽을 건드린 토비. */
export const STAGE_1_5_PRE: DialogueStory = {
  id: "stage-1-5-pre",
  startNodeId: "hi",
  backdrop: "battlefield",
  nodes: linear([
    { id: "hi", speaker: "토비", body: "여어, 연구원! 놀랐지? 먼저 와서 문을 열어 두겠다고 했거든!", standing: "toby", cast: ALONE("toby"), act: "bounce" },
    { id: "torn", speaker: "토비", body: "…열어 두려고 했는데, 열렸다기보다 뜯겼다는 쪽이 맞을 거야.", standing: "toby", act: "shrink" },
    { id: "guard", speaker: "토리카", body: "대장님은 제 뒤로 오세요! 혼자 오신 거예요? 다른 두 분은요?", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "toby", slot: "right" }], act: "hop" },
    { id: "split", speaker: "토비", body: "아모랑 리파는 코마가 시킨 대로 딴 길로 갔어. 나 혼자서도 충분하다고!", standing: "toby", act: "puff" },
    { id: "denial", speaker: "토비", body: "그, 그리고 이 방벽 장치는 내가 만진 게 아니야. 원래 켜져 있었어.", standing: "toby", act: "fright" },
    { id: "beep", speaker: "토리카", body: "방금 장치에서 \"삐—\" 하고 소리가 났는데요.", standing: "torika", act: "recoil" },
    { id: "fight", speaker: "토비", body: "으아아 멈추는 법이 어디 있더라?! 싸, 싸우자! 싸우는 동안은 장치가 신경 안 쓰이니까!", standing: "toby", act: "rage", cue: "impact" },
  ]),
};

/** 1-5 후 — 넘어뜨린 장비를 몰래 제자리에 돌려놓다 들킨다. */
export const STAGE_1_5_POST: DialogueStory = {
  id: "stage-1-5-post",
  startNodeId: "tidy",
  backdrop: "battlefield",
  nodes: linear([
    { id: "tidy", speaker: "", body: "넘어진 장비가 구석에 쌓여 있다. 토비가 연구원 눈치를 보며 하나씩 일으켜 세운다.", standing: "toby", cast: [{ id: "toby", slot: "right" }, { id: "torika", slot: "left" }] },
    { id: "what", speaker: "토리카", body: "…지금 뭐 하세요?", standing: "torika", act: "lean" },
    { id: "excuse", speaker: "토비", body: "아, 아무것도! 정리야! 원래 이렇게 있었던 거라고!", standing: "toby", act: "shake" },
    { id: "label", speaker: "도디", body: "방금 선반 이름표랑 맞춰서 놓으셨는데요. 꼼꼼하시네요.", standing: "dodi", cast: [{ id: "dodi", slot: "center" }, { id: "torika", slot: "left" }, { id: "toby", slot: "right" }], act: "nod" },
    { id: "away", speaker: "토비", body: "보, 보지 마! 코마한테는 말하지 마! 다음엔 진짜 이긴다~!", standing: "toby", cast: [{ id: "dodi", slot: "center" }, { id: "torika", slot: "left" }], act: "hopTwice", leave: "blastOff", cue: "impact" },
  ]),
};

/** 1-6 후 — 안테나가 살아나며 도시와 처음 연결된다. 시그널 아이는 목소리뿐이다. */
export const STAGE_1_6_POST: DialogueStory = {
  id: "stage-1-6-post",
  startNodeId: "hum",
  backdrop: "battlefield",
  nodes: linear([
    { id: "hum", speaker: "", body: "안테나가 낮은 소리를 내며 일어선다. 잡음 사이로 목소리가 번진다.", standing: "torika", cast: ROGUE_TRIO },
    { id: "stella", speaker: "스테라", body: "…연결됐어요. 제1지부 관제의 스테라예요. 위치 신호 확인했어요. 외곽에서 오시는 분들이죠?", cast: VOICE("stella", "torika", "dodi"), act: "nod", cue: "impact" },
    { id: "torika", speaker: "토리카", body: "스테라 님! 열차가 떨어졌어요. 대장님은 무사하세요!", standing: "torika", act: "hop" },
    { id: "kento", speaker: "켄토", body: "여기는 켄토다. 외벽 쪽이 시끄러워서 지원은 조금 늦는다. 이 안쪽 길은 정거장까지 이어져 있어.", cast: VOICE("kento", "torika", "dodi"), act: "lean" },
    { id: "station", speaker: "스테라", body: "봉쇄된 정거장이 원래 목적지였어요. 문은 잠겼겠지만 안쪽에 보급 담당이 갇혀 있을지도 몰라요.", cast: VOICE("stella", "torika", "dodi") },
    { id: "dodi", speaker: "도디", body: "보급 담당이 갇혀 있대요! 기록해 둘게요!", standing: "dodi", act: "hopTwice" },
    { id: "order", speaker: "켄토", body: "연구원, 들리나. 일단 살아서 도착해라. 나머지는 도착하고 나서 얘기하자.", cast: VOICE("kento", "torika", "dodi"), act: "nod" },
    { id: "parua", speaker: "파루아", body: "…말은 거친데 목소리는 걱정하는 쪽이에요.", standing: "parua", cast: ROGUE_TRIO, act: "nod" },
    { id: "go", speaker: "토리카", body: "그럼 정거장으로 가요! 이제 길잡이도 생겼으니까요!", standing: "torika", act: "hop" },
  ]),
};

/** 1-7 전 — 폐기 표식 더미 앞에서 아모의 말수가 줄어든다. */
export const STAGE_1_7_PRE: DialogueStory = {
  id: "stage-1-7-pre",
  startNodeId: "pile",
  backdrop: "battlefield",
  nodes: linear([
    { id: "pile", speaker: "", body: "처리장 한쪽에 같은 모양의 철제 표식이 산처럼 쌓여 있다. 가운데에 가위표 홈 하나가 새겨져 있다.", standing: "dodi", cast: ROGUE_TRIO },
    { id: "mark", speaker: "도디", body: "이건 \"폐기 표식\"이에요. 복원이 안 된 개체에게 달아서 보내던 거예요. 제 일지에 있어요.", standing: "dodi", act: "tremble" },
    { id: "count", speaker: "토리카", body: "복원이 안 된 개체라면… 이 더미는 전부…", standing: "torika", act: "faint" },
    { id: "line", speaker: "도디", body: "여기로 보내진 아이들의 몫이에요. 줄이 끝이 없어요.", standing: "dodi", act: "shrink" },
    { id: "hood", speaker: "", body: "더미 뒤에서 두건이 천천히 올라온다. 아모가 표식 하나를 내려다보며 서 있다.", standing: "amo", cast: [{ id: "dodi", slot: "left" }, { id: "torika", slot: "center" }, { id: "amo", slot: "right" }] },
    { id: "touch", speaker: "아모", body: "…그거, 만지지 마.", standing: "amo", act: "shrink" },
    { id: "ask", speaker: "토리카", body: "아모 씨…?", standing: "torika", act: "lean" },
    { id: "quiet", speaker: "아모", body: "…아무것도 아니야. 싸울 거면 조용히 해. 나, 큰 소리는 싫어.", standing: "amo", act: "tremble" },
  ]),
};

/** 1-8 전 — 배수로에서 보급 회수 중이던 티아를 만난다. 같은 쁘띠 로그다. */
export const STAGE_1_8_PRE: DialogueStory = {
  id: "stage-1-8-pre",
  startNodeId: "sit",
  backdrop: "battlefield",
  nodes: linear([
    { id: "sit", speaker: "", body: "지하 배수로. 수문 손잡이 위에 베일을 쓴 작은 그림자가 앉아 있다. 반짝이는 조각을 소매에 하나씩 넣는 중이다.", standing: "torika", cast: ROGUE_TRIO },
    { id: "tia", speaker: "티아", body: "앗, 들켰다…! 연구원님도 계셨네요! 저, 저는 그냥 보급 회수 중이에요! 수문 점검도 하는 중이고요!", cast: TIA_TRIO, act: "recoil" },
    { id: "same", speaker: "토리카", body: "어, 티아잖아! 여기서 뭐 해? 설마 또 반짝이는 거 주워?", standing: "torika", act: "hop" },
    { id: "veil", speaker: "티아", body: "토리카도 있었네! 반짝이는 것만 줍는 건 아니에요. 이 수문 근처로 보급 상자가 떠내려와서, 쓸 만한 건 다 건져 두는 중이에요!", act: "bounce" },
    { id: "useless", speaker: "토리카", body: "그 반짝이는 조각들은 어디에 쓰는 거야? 별 쓸모는 없어 보이는데…", standing: "torika", act: "lean" },
    { id: "droop", speaker: "티아", body: "쓸모… 없어? 이거 다 내 보물인데…", act: "faint" },
    { id: "oops", speaker: "토리카", body: "아, 아니야! 반짝반짝해서 예쁘다는 뜻이었어!", standing: "torika", act: "shake" },
    { id: "cheer", speaker: "티아", body: "정말? 에헤헤… 그럼 토리카한테도 특별히 하나 보여 줄게! 연구원님도 같이 보세요!", act: "hopTwice" },
    { id: "trail", speaker: "티아", body: "코마가 지나간 길이라면 이 수문 아래로 이어져 있어요, 연구원님. 내가 아는 건 그게 다야, 진짜로!", act: "nod" },
    { id: "scent", speaker: "파루아", body: "…물 냄새 위로 다른 발자국이 있어요. 아까 그 물속 장난꾼 같기도 하고요.", standing: "parua", act: "lean" },
    { id: "laugh", speaker: "티아", body: "아까 물속에서 누가 웃었어. 나 아니야! 진짜 나 아니고… 파루아도 조심해. 연구원님도요.", act: "shake" },
    { id: "gift", speaker: "티아", body: "수문은 내가 열어 줄게! 연구원님, 이건 가는 길에 쓰세요. 아, 처음 주운 조각은 안 돼! 그건 내 소매에 있어야 해!", act: "puff" },
  ]),
};

/** 1-9 전 — 봉쇄문 너머에서 누군가 문을 두드린다. 아직 얼굴을 보지 못한 목소리다. */
export const STAGE_1_9_PRE: DialogueStory = {
  id: "stage-1-9-pre",
  startNodeId: "knock",
  backdrop: "battlefield",
  nodes: linear([
    { id: "knock", speaker: "", body: "오프닝 열차가 닿았어야 할 정거장. 플랫폼 끝 봉쇄문이 안쪽에서 쿵쿵 울린다.", standing: "dodi", cast: ROGUE_TRIO },
    { id: "inside", speaker: "오비", body: "아와와… 누, 누구 있어요? 열차가 오늘 안 와서 문이 잠겨 버렸어요… 도와줘…!", cast: VOICE("obi", "dodi", "parua"), act: "tremble" },
    { id: "who", speaker: "도디", body: "오비야? 거기 갇힌 거야? 우리 쁘띠 로그야, 조금만 기다려!", standing: "dodi", act: "hopTwice" },
    { id: "watch", speaker: "오비", body: "다행이다… 도디, 파루아도 있구나! 그런데 문 앞에 뭔가 서성이는 소리가 나. 아까부터 \"이 문은 안 열려 있어야 해\" 하고 중얼거려…!", act: "fright" },
    { id: "sense", speaker: "파루아", body: "…발소리가 문 앞에 모여 있어요. 열려면 싸워야 해요.", standing: "parua", act: "lean" },
  ]),
};

/** 1-9 후 — 갇혀 있던 오비가 폐기 직전 재고를 나눠 준다. */
export const STAGE_1_9_POST: DialogueStory = {
  id: "stage-1-9-post",
  startNodeId: "open",
  backdrop: "battlefield",
  nodes: linear([
    { id: "open", speaker: "", body: "문이 열린다. 안에서 상자를 끌어안은 앳된 아이가 비틀거리며 나온다.", standing: "torika", cast: ROGUE_TRIO },
    { id: "obi", speaker: "오비", body: "고, 고마워…! 아, 연구원님도 고맙습니다! 저는 오비예요. 이 정거장 보급 검수를 하던 중이었어요.", cast: [{ id: "torika", slot: "left" }, { id: "obi", slot: "center" }, { id: "dodi", slot: "right" }], act: "bounce" },
    { id: "store", speaker: "토리카", body: "A-LAB24 편의점 유니폼이다! 도시에도 있었어?", standing: "torika", act: "hop" },
    { id: "lab", speaker: "오비", body: "응, 중앙 연구소 1층이야. 오늘 열차 재고가 못 들어와서… 연구원님, 이건 폐기 직전이라 몰래 챙긴 거예요.", act: "shrink" },
    { id: "gift", speaker: "오비", body: "치즈케이크랑 에너지 드링크예요. 기한이 오늘까지라서요. 드세요, 아깝잖아요.", act: "nod" },
    { id: "dodi", speaker: "도디", body: "기한 직전 재고! 이건 \"구호 물자\"로 적어 둘게!", standing: "dodi", act: "hopTwice" },
    { id: "wait", speaker: "오비", body: "연구소에서 기다릴게요. 거기 오시면 정식으로 팔 수 있어요!", act: "bounce" },
  ]),
};

/** 1-10 전 — 경계문 앞에서 베일을 벗은 코마와 마주선다. */
export const STAGE_1_10_PRE: DialogueStory = {
  id: "stage-1-10-pre",
  startNodeId: "wait",
  backdrop: "battlefield",
  nodes: linear([
    { id: "wait", speaker: "", body: "경계문 앞. 닫힌 문 앞에 코마가 서 있다. 처음부터 거기 있었다는 듯이.", standing: "koma", cast: ALONE("koma") },
    { id: "come", speaker: "코마", body: "여기까지 올 줄은 몰랐다.", standing: "koma", act: "nod" },
    { id: "name", speaker: "토리카", body: "코마… 맞죠? 열차를 폭파한 분.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "koma", slot: "right" }], act: "lean" },
    { id: "goal", speaker: "코마", body: "목표는 연구원. 그것뿐이다. 해치지 않는다.", standing: "koma" },
    { id: "train", speaker: "도디", body: "그, 그치만 열차는 떨어졌잖아요!", standing: "dodi", cast: [{ id: "dodi", slot: "left" }, { id: "koma", slot: "right" }], act: "fright" },
    { id: "order", speaker: "코마", body: "…떨어뜨리라고 했다. 내가 정한 게 아니다.", standing: "koma", act: "shrink" },
    { id: "who", speaker: "토리카", body: "누가요?", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "koma", slot: "right" }] },
    { id: "above", speaker: "코마", body: "…위에서. 문은 내가 막는다. 돌아가라, 연구원. 돌아가지 않으면 데려간다.", standing: "koma", cue: "impact" },
  ]),
};

/** 1-10 후 — 연구원의 첫 한마디와 렉시아의 입성. 말투는 선택지로 갈리고 흐름은 하나로 모인다. */
export const STAGE_1_10_POST: DialogueStory = {
  id: "stage-1-10-post",
  startNodeId: "down",
  backdrop: "battlefield",
  nodes: [
    { id: "down", speaker: "", body: "코마가 쓰러지지 않고 선 채로 숨을 고른다. 꼬리 끝의 톱니가 가늘게 떨린다.", standing: "koma", cast: [{ id: "torika", slot: "left" }, { id: "koma", slot: "right" }], nextId: "report" },
    { id: "report", speaker: "코마", body: "…졌다. 보고는 내가 한다.", standing: "koma", act: "shrink", nextId: "ask" },
    {
      id: "ask", speaker: "토리카", body: "대장님… 한 말씀 해 주실래요?", standing: "torika", act: "lean",
      choices: [
        { id: "notfail", label: "너희는 실패작이 아니야", nextId: "answerA", effect: { type: "bondXp", relicId: "torika", amount: 3 } },
        { id: "talk", label: "다음엔 같이 이야기하자", nextId: "answerB", effect: { type: "bondXp", relicId: "parua", amount: 3 } },
      ],
    },
    { id: "answerA", speaker: "코마", body: "…그 말은 위에서 아무도 안 했다.", standing: "koma", act: "recoil", nextId: "leave" },
    { id: "answerB", speaker: "코마", body: "…이야기. 그것도 위에서는 없던 일이다.", standing: "koma", act: "recoil", nextId: "leave" },
    { id: "leave", speaker: "코마", body: "위에 가서 말하겠다. 연구원이 문 너머로 아직 가지 않았다고.", standing: "koma", cast: [{ id: "torika", slot: "left" }], nextId: "crash" },
    { id: "crash", speaker: "", body: "경첩째 뽑힌 문짝이 날아와 땅에 박힌다.", cue: "explosion", nextId: "lexia" },
    { id: "lexia", speaker: "렉시아", body: "내가 왔다! 문은 열어 뒀다. 정확히는 문짝을 가져왔다.", standing: "lexia", cast: ALONE("lexia"), act: "puff", nextId: "hello" },
    { id: "hello", speaker: "토리카", body: "렉시아 님!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "lexia", slot: "right" }], act: "hopTwice", nextId: "queen" },
    { id: "queen", speaker: "렉시아", body: "앱솔루트 팽의 렉시아다. 이제부터 이터널 시티는 내가 책임진다. 연구원, 따라와라.", standing: "lexia", act: "nod", nextId: "door" },
    { id: "door", speaker: "파루아", body: "…문짝이 아직 손에 있어요.", standing: "parua", cast: [{ id: "parua", slot: "left" }, { id: "lexia", slot: "right" }], act: "lean", nextId: "drop" },
    { id: "drop", speaker: "렉시아", body: "…당당한 입성에는 소품이 필요하지. 놓는다.", standing: "lexia", act: "shrink", nextId: "go" },
    { id: "go", speaker: "토리카", body: "그럼 도시로 가요! 이번엔 우리에게 든든한 길잡이가 있으니까요.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "lexia", slot: "right" }], act: "hop" },
  ],
};

export const CHAPTER_1_STORIES: readonly DialogueStory[] = [
  STAGE_1_2_POST, STAGE_1_4_PRE, STAGE_1_5_PRE, STAGE_1_5_POST, STAGE_1_6_POST,
  STAGE_1_7_PRE, STAGE_1_8_PRE, STAGE_1_9_PRE, STAGE_1_9_POST, STAGE_1_10_PRE, STAGE_1_10_POST,
];

// 번역 등록(`registerDialogueTexts`)은 원고가 확정된 뒤에 한다 — 확정 전에 열한 언어를 채우면 고칠 때마다 전부 다시 옮겨야 한다.
