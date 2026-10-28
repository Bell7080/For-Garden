import type { DialogueCastMember, DialogueStandingAsset, DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **5장 — 지하 감금동 (5-1 ~ 5-10).**
 *
 * 합동 추격은 연구원을 붙잡는 것만이 목적이 아니었다. 연구원을 아래로 몰아, 제1지부가 묻어 둔 지하 감금동 앞에 세우는 것.
 * 그 감금동에는 지부가 붙잡아 가둔 공멸의 개체들 — 감금조와 **부대장 카르** — 가 묶여 있다. 위의 명령을 받은 코마가 문을 열고,
 * 풀려난 감금조가 차례로 앞을 막는다. 5-5는 감금조 부간부 라자, 5-10은 감금조 간부 마가사가 혼자 서는 정예다.
 * 5-10 후에 마가사가 맨 아래 자물쇠의 비밀(사람의 손)을 흘려, 공멸이 연구원을 아래로 몰아온 이유가 드러난다.
 *
 * 함께하는 것은 나이트 기어다 — 어둠 속 잠입과 인양이 이 장의 결이다. 스피나는 무전으로, 데이·델로피·마키·모사나는 직접 선다.
 * 직책은 `docs/lore.md` §4를 따른다. 마가사는 연구원을 「연구원님」, 라자는 「연구원」이라 부른다.
 */

const REMOTE = (voice: "seira" | "luka", other: DialogueStandingAsset): readonly DialogueCastMember[] => [
  { id: other, slot: "left" }, { id: voice, slot: "right", remote: true },
];

/** 5-1 전 — 감금동 입구. 회수된 삼인조가 문 앞을 지킨다. */
export const STAGE_5_1_PRE: DialogueStory = {
  id: "stage-5-1-pre",
  startNodeId: "dark",
  backdrop: "battlefield",
  nodes: linear([
    { id: "dark", speaker: "", body: "계단 끝은 불이 하나도 없다. 벽마다 긁힌 자국이 숫자처럼 줄지어 있다.", cast: [{ id: "deina", slot: "center" }], cue: "rumble" },
    { id: "deina", speaker: "데이", body: "연구원님, 이 표시 우리 거 아니야! 지부 사람이 남긴 경고야. 「열지 말 것」이래.", standing: "deina", act: "lean" },
    { id: "radio", speaker: "스피나", body: "…무전 확인. 감금동이라는 이름은 지부 도면 어디에도 없었다. 누군가 지웠다는 뜻이다.", standing: "seira", cast: REMOTE("seira", "deina"), act: "nod" },
    { id: "trio", speaker: "토비", body: "또 너희야?! …아니, 또 우리야. 문 앞을 지키래.", standing: "toby", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }], act: "shake" },
    { id: "amo", speaker: "아모", body: "…연구원. 여기는 오면 안 되는 데야. 우리도 들어가 본 적 없어.", standing: "amo", act: "tremble" },
  ]),
};

/** 5-3 후 — 델로피가 수감 명단을 찾아낸다. */
export const STAGE_5_3_POST: DialogueStory = {
  id: "stage-5-3-post",
  startNodeId: "trick",
  backdrop: "battlefield",
  nodes: linear([
    { id: "trick", speaker: "델로피", body: "짠~ 방금 그 서랍에서 사라졌던 서류가 여기서 나타났습니다! …어, 근데 이거 장난칠 서류가 아니네요.", standing: "delopi", cast: [{ id: "delopi", slot: "left" }, { id: "maki", slot: "right" }], act: "hop" },
    { id: "list", speaker: "", body: "누렇게 바랜 표지에 「수감 명단 — 공멸 포획 개체」. 이름 대신 번호와 무게만 적혀 있다." },
    { id: "maki", speaker: "마키", body: "치료 기록이 한 줄도 없다냥. 진단도 처치도 없이 번호랑 무게만 적었다냥… 환자가 아니라 짐으로 본 거다냥, 연구원님.", standing: "maki", act: "shrink" },
    { id: "delopi2", speaker: "델로피", body: "…이건 되돌리는 마술이 없네요.", standing: "delopi", act: "shrink" },
  ]),
};

/** 5-4 후 — 코마가 제어반에서 첫 감방 구역을 연다. 라자가 걸어 나온다. */
export const STAGE_5_4_POST: DialogueStory = {
  id: "stage-5-4-post",
  startNodeId: "panel",
  backdrop: "battlefield",
  nodes: linear([
    { id: "panel", speaker: "", body: "복도 끝 제어반 앞에 가리개를 쓴 그림자가 서 있다. 손가락이 마지막 단추 위에서 멈춘다.", standing: "koma", cast: [{ id: "koma", slot: "center" }], cue: "alarm" },
    { id: "koma", speaker: "코마", body: "…명령이다.", standing: "koma", act: "lean" },
    { id: "open", speaker: "", body: "감방 문이 한 칸씩 차례로 열린다. 가장 가까운 칸에서 한쪽 팔만 굵은 그림자가 천천히 걸어 나온다.", cast: [{ id: "koma", slot: "left" }, { id: "raja", slot: "right" }], cue: "impact" },
    { id: "raja", speaker: "라자", body: "…072냐. 늦었다.", standing: "raja", act: "nod" },
    { id: "koma2", speaker: "코마", body: "…아래가 먼저다. 길을 막아라.", standing: "koma", act: "shrink" },
  ]),
};

/** 5-5 전 — 서열의 방. 라자가 혼자 앞을 막는다. */
export const STAGE_5_5_PRE: DialogueStory = {
  id: "stage-5-5-pre",
  startNodeId: "room",
  backdrop: "battlefield",
  nodes: linear([
    { id: "room", speaker: "", body: "바닥에 분필로 그은 줄이 겹겹이다. 감방 안에서 누가 누구 앞에 서는지 정하던 자리다.", standing: "raja", cast: [{ id: "raja", slot: "center" }], cue: "rumble" },
    { id: "raja", speaker: "라자", body: "새로 왔으면 서열부터 정한다. 덤벼.", standing: "raja", act: "lean" },
    { id: "mosana", speaker: "모사나", body: "당신은 뒤로. 저 팔은 제가 묶어 두겠습니다.", standing: "mosana", cast: [{ id: "mosana", slot: "left" }, { id: "raja", slot: "right" }], act: "nod" },
  ]),
};

/** 5-5 후 — 라자가 물러나고, 더 아래에서 콧노래가 들린다. */
export const STAGE_5_5_POST: DialogueStory = {
  id: "stage-5-5-post",
  startNodeId: "down",
  backdrop: "battlefield",
  nodes: linear([
    { id: "down", speaker: "라자", body: "…서열은 너희가 위다. 오늘만.", standing: "raja", cast: [{ id: "raja", slot: "center" }], act: "faint" },
    { id: "hum", speaker: "", body: "더 깊은 곳에서 콧노래가 올라온다. 냄비 뚜껑이 달그락거리는 소리도 섞여 있다.", cue: "rumble" },
    { id: "voice", speaker: "???", body: "라자~ 밥 식는다~ 손님 오셨으면 같이 데려오고~", cast: [{ id: "raja", slot: "left" }, { id: "magasa", slot: "right", veiled: true }] },
    { id: "raja2", speaker: "라자", body: "…먼저 먹어.", standing: "raja", act: "shrink" },
  ]),
};

/** 5-6 후 — 침수 감방. 이카닉시아가 풀려난 감금조에게 정중히 인사한다. */
export const STAGE_5_6_POST: DialogueStory = {
  id: "stage-5-6-post",
  startNodeId: "water",
  backdrop: "battlefield",
  nodes: linear([
    { id: "water", speaker: "모사나", body: "물이 허리까지 찹니다. 당신, 제 줄을 놓지 마십시오.", standing: "mosana", cast: [{ id: "mosana", slot: "center" }], act: "lean", cue: "rumble" },
    { id: "ika", speaker: "이카닉시아", body: "어머, 라자 님. 오랜만이에요. 갇혀 계신 동안 회수조는 한 번도 잊은 적이 없답니다.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "left" }, { id: "raja", slot: "right" }], act: "lean" },
    { id: "raja", speaker: "라자", body: "…거짓말은 여전하군.", standing: "raja", act: "nod" },
    { id: "ika2", speaker: "이카닉시아", body: "후훗. 그래도 연구원님을 모시는 일만큼은 함께하실 거죠?", standing: "ikanixia", act: "nod" },
  ]),
};

/** 5-8 후 — 배식 통로. 스피나가 나이트 기어도 몰랐던 일을 말한다. */
export const STAGE_5_8_POST: DialogueStory = {
  id: "stage-5-8-post",
  startNodeId: "trays",
  backdrop: "battlefield",
  nodes: linear([
    { id: "trays", speaker: "", body: "배식구마다 빈 쟁반이 쌓여 있다. 그런데 몇 칸에는 아직 따뜻한 국그릇이 놓여 있다.", cast: [{ id: "deina", slot: "left" }, { id: "maki", slot: "right" }] },
    { id: "radio", speaker: "스피나", body: "…나이트 기어는 지부 아래를 다 안다고 믿었다. 이 층은 몰랐다. 인양할 것이 아니라 묻어 둔 것이라서다.", standing: "seira", cast: REMOTE("seira", "deina"), act: "shrink" },
    { id: "luka", speaker: "루카", body: "문 잠금 기록을 훑어봤어. 위에서 열린 게 아니야. 안에서 누가 하나씩 열고 있어.", standing: "luka", cast: REMOTE("luka", "maki"), act: "lean" },
    { id: "maki", speaker: "마키", body: "그럼 이 국은… 갇혀 있던 아이들을 누가 먹이고 있다는 거다냥. 아직 따뜻하니까 한 시간도 안 지났다냥.", standing: "maki", cast: [{ id: "maki", slot: "center" }], act: "nod" },
  ]),
};

/** 5-9 후 — 구속 장치실. 겁먹은 그림자 하나가 달아난다. */
export const STAGE_5_9_POST: DialogueStory = {
  id: "stage-5-9-post",
  startNodeId: "chains",
  backdrop: "battlefield",
  nodes: linear([
    { id: "chains", speaker: "", body: "끊어진 족쇄들이 바닥에 흩어져 있다. 그 사이로 작은 그림자 하나가 몸을 웅크린 채 이쪽을 본다.", cast: [{ id: "noa", slot: "center", veiled: true }], cue: "impact" },
    { id: "noa", speaker: "???", body: "오, 오지 마… 오지 말라니까…!", standing: "noa", act: "tremble" },
    { id: "deina", speaker: "데이", body: "연구원님, 쫓으면 안 돼! 저렇게 벌벌 떠는 애가 제일 먼저 깨물어. 가만히 있어 주자.", standing: "deina", cast: [{ id: "deina", slot: "left" }, { id: "noa", slot: "right", veiled: true }], act: "lean" },
    { id: "flee", speaker: "", body: "그림자는 손톱 소리만 남기고 취사장 쪽으로 사라진다." },
  ]),
};

/** 5-10 전 — 감금동 취사장. 마가사가 냄비 앞에서 맞이한다. */
export const STAGE_5_10_PRE: DialogueStory = {
  id: "stage-5-10-pre",
  startNodeId: "kitchen",
  backdrop: "battlefield",
  nodes: linear([
    { id: "kitchen", speaker: "", body: "큰 솥에서 김이 오른다. 족쇄를 단 발로 박자를 맞추며 누군가 국자를 젓고 있다.", standing: "magasa", cast: [{ id: "magasa", slot: "center" }], cue: "rumble" },
    { id: "magasa", speaker: "마가사", body: "어서 와요, 연구원님. 마침 오늘 들어온 재료 중에 제일 귀한 손님이시네.", standing: "magasa", act: "lean" },
    { id: "maki", speaker: "마키", body: "연구원님 근처엔 오지 말라냥! 진료 예약은 내가 먼저 잡았다냥.", standing: "maki", cast: [{ id: "maki", slot: "left" }, { id: "magasa", slot: "right" }], act: "shake" },
    { id: "magasa2", speaker: "마가사", body: "어머, 예약제구나. 그럼 줄 선 분부터 차례로 다질게요~", standing: "magasa", act: "nod" },
  ]),
};

/** 5-10 후 — 마가사가 맨 아래 자물쇠의 비밀을 흘린다. 코마가 아래로 가지 말라고 한다. */
export const STAGE_5_10_POST: DialogueStory = {
  id: "stage-5-10-post",
  startNodeId: "laugh",
  backdrop: "battlefield",
  nodes: linear([
    { id: "laugh", speaker: "마가사", body: "아하하… 손맛 좋네요, 연구원님 쪽 사람들. 오늘은 제가 설거지할게요.", standing: "magasa", cast: [{ id: "magasa", slot: "center" }], act: "faint" },
    { id: "hint", speaker: "마가사", body: "그런데요, 맨 아래 부대장님 자물쇠는 사람 손이어야 열린대요. 연구원님 같은 진짜 사람 손.", standing: "magasa", act: "lean" },
    { id: "deina", speaker: "데이", body: "…그래서 처음부터 아래로 몰았구나! 합동 추격도, 끊어진 승강기도 전부 한 길이었어.", standing: "deina", cast: [{ id: "deina", slot: "left" }, { id: "magasa", slot: "right" }], act: "nod" },
    { id: "koma", speaker: "코마", body: "…아래로 가지 마라.", standing: "koma", cast: [{ id: "koma", slot: "center" }], act: "lean" },
    { id: "gone", speaker: "", body: "그 한마디만 남기고 코마는 다음 계단으로 내려간다. 위로 가라는 말은 하지 않았다." },
  ]),
};

export const CHAPTER_5_STORIES: readonly DialogueStory[] = [
  STAGE_5_1_PRE, STAGE_5_3_POST, STAGE_5_4_POST, STAGE_5_5_PRE, STAGE_5_5_POST, STAGE_5_6_POST,
  STAGE_5_8_POST, STAGE_5_9_POST, STAGE_5_10_PRE, STAGE_5_10_POST,
];
