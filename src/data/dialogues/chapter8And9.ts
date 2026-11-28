import type { DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";
import { registerDialogueTexts } from "./registerDialogue";

/*
 * **8장 — 귀환로 (8-1 ~ 8-10).**
 *
 * 카르를 따라 올라간 감금조의 뒤를 연구원 일행이 밟는다. 공멸이 일을 끝내고 돌아갈 때 타는 길이고, 그 길목마다 **귀환 명부**가
 * 걸려 있다 — 이름 칸이 초록이면 문이 열리고 빨강이면 닫힌다. 노아와 라자의 칸은 빨갛다. 오디디에서 무력화된 선두조(지금의 감금조)를
 * 회수조가 「전원 손실」로 지우고 갔기 때문이다. 8-5에서 이카닉시아는 같은 계산으로 문을 닫으려 하고, 아트라가 처음으로 그 손을 막는다.
 * 8-10은 **철갑 아르겐**이 승강장에 내려와 노아·라자가 올라올 때까지 맨 뒤를 받친다. 카르가 다시 적어 둔 코마(072)의 칸은 초록이다.
 * 대장 둘 중 아르겐이 먼저 서고, 셈을 하는 **궁니르 기가노**는 8-10 끝에 목소리로만 내려온다 — 기가노가 이 줄기의 주인이다(응태 2026-11-27).
 *
 * **9장 — 중앙 제어축 (9-1 ~ 9-10).** 위로 난 마지막 길. 문들이 연구원을 보고 깨어나고, 9-5는 직접 내려와 모자란 하나(코마)를 세는
 * **궁니르 기가노**, 9-10은 두 대장이 나란히 막는다. 대장들은 아무도 지우지 않는다 — 그래서 코마를 「셈」에 넣고, 끝에 연구원도 셈에 넣겠다고 한다.
 * 코마는 명부에 적힌 자기 이름을 지우지 않되, 어디로 갈지는 자기가 정한다고 말한다.
 *
 * 호칭: 공멸 말단·감금조는 대장을 「대장님」, 간부를 「간부님」이라 부르고, 두 대장은 서로를 이름으로, 코마는 「코마」로 부른다(카르만 072).
 */

/** 8-1 전 — 귀환로 입구. 코마가 이 길을 타 본 적이 없다고 말한다. */
const STAGE_8_1_PRE: DialogueStory = {
  id: "stage-8-1-pre",
  startNodeId: "hole",
  backdrop: "restraint",
  recollectionSummary: "카르가 뚫고 간 천장 위로, 공멸이 돌아갈 때 타는 귀환로가 열려 있었다.",
  nodes: linear([
    { id: "hole", speaker: "", body: "카르가 뚫고 간 구멍 위로 녹슨 사다리가 이어져 있었다. 사다리가 끝나는 곳에서 바람 대신 기름 냄새가 내려왔다.", cast: [{ id: "koma", slot: "center" }] },
    { id: "koma", speaker: "코마", body: "…귀환로다. 공멸이 일 끝내고 돌아갈 때 타는 길.", standing: "koma", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "돌아가는 길이면 위로 이어지는 거네? 잘됐다. 마스터, 오늘은 처음으로 올라가는 쪽이에요.", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "koma", slot: "right" }], act: "hop" },
    { id: "koma2", speaker: "코마", body: "…나는 이 길을 타 본 적이 없다.", standing: "koma", act: "shrink" },
    { id: "koma3", speaker: "코마", body: "테러조는 돌아오라는 말을 들은 적이 없거든. 늘 다음 자리로 내려가라는 말만 들었지.", standing: "koma" },
    { id: "alarm", speaker: "", body: "사다리 위쪽에서 붉은 표지등이 하나씩 켜졌다. 켜진 자리마다 철판 셔터가 천천히 내려오기 시작했다.", cue: "alarm" },
    { id: "pachi", speaker: "파치", body: "보, 보스… 위에서 셔터 내려오는 소리 나요. 우리 올라오는 거 아는 거 아니에요?", standing: "pachi", cast: [{ id: "pachi", slot: "center" }], act: "tremble" },
    { id: "crate", speaker: "", body: "셔터 밑으로 낯익은 셋이 짐짝을 하나씩 끌고 미끄러져 내려왔다. 등짝마다 회수조 꼬리표가 큼직하게 붙어 있었다.", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }], cue: "impact" },
    { id: "amo", speaker: "아모", body: "…코마 님. 진짜 살아 계셨네.", standing: "amo", act: "tremble" },
    { id: "koma4", speaker: "코마", body: "…아모. 너희 아직 회수조 짐 나르냐.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "amo", slot: "right" }], act: "lean" },
    { id: "toby", speaker: "토비", body: "나르는 거 아니거든요! 붙들려서 나르는 거예요! 이거 다 내려놓으면 우리가 짐 된대요!", standing: "toby", cast: [{ id: "toby", slot: "left" }, { id: "koma", slot: "right" }], act: "puff", voice: "shout" },
    { id: "ripa", speaker: "리파", body: "으흐흐. 그러니까 코마 님, 미안한데 길은 막을게요. 이번에도 위에서 다 정했거든요.", standing: "ripa", cast: [{ id: "ripa", slot: "center" }], act: "lean" },
  ]),
};

/** 8-3 후 — 귀환 명부. 숨어 있던 노아와 라자가 지워진 자기 칸을 본다. */
const STAGE_8_3_POST: DialogueStory = {
  id: "stage-8-3-post",
  startNodeId: "board",
  backdrop: "detention",
  recollectionSummary: "귀환 명부의 노아와 라자 칸은 빨갛게 지워져 있었다. 지운 것은 회수조였다.",
  nodes: linear([
    { id: "board", speaker: "", body: "통로 벽 한 면을 철판 명부가 차지하고 있었다. 이름 칸마다 작은 등이 박혀 있었고, 대부분은 초록으로 켜져 있었다.", cast: [{ id: "dodi", slot: "center" }] },
    { id: "dodi", speaker: "도디", body: "대장님, 이거 출석부 같아요. 초록은 온 사람, 빨강은… 안 온 사람인가?", standing: "dodi", act: "lean" },
    { id: "noa", speaker: "노아", body: "오, 오지 마! 거기서 멈춰! 나 간부야! 진짜로 세다고!", standing: "noa", cast: [{ id: "dodi", slot: "left" }, { id: "noa", slot: "right" }], act: "fright", voice: "shout" },
    { id: "see", speaker: "", body: "명부 뒤 배관 틈에서 노아가 튀어나왔다. 그러다 명부를 보고는, 들고 있던 손을 천천히 내렸다." },
    { id: "noa2", speaker: "노아", body: "…내 칸이 빨개. 라자 것도. 마가사는 초록인데… 왜 우리만.", standing: "noa", act: "shrink" },
    { id: "raja", speaker: "라자", body: "노아 간부님, 뒤로 물러나십시오.", standing: "raja", cast: [{ id: "noa", slot: "left" }, { id: "raja", slot: "right" }], act: "nod" },
    { id: "raja2", speaker: "라자", body: "072가 가르쳐 줬겠지만, 우리 칸을 지운 건 회수조다. 오디디에서 쓰러진 우리를 장부에 「손실」로 적고 갔지.", standing: "raja", voice: "heavy" },
    { id: "raja3", speaker: "라자", body: "연구원. 네가 같이 가 주면 이 칸들도 다시 켜질 거다. 싫다면, 들고 간다.", standing: "raja", act: "lean" },
    { id: "noa3", speaker: "노아", body: "…하, 하나도 안 무서웠어. 진짜야. 그냥 명부 보느라 그런 거야.", standing: "noa", act: "puff" },
  ]),
};

/** 8-5 전 — 닫히는 방화문. 이카닉시아가 또 둘을 두고 문을 닫으려 한다. */
const STAGE_8_5_PRE: DialogueStory = {
  id: "stage-8-5-pre",
  startNodeId: "door",
  backdrop: "thirdBranchField",
  recollectionSummary: "이카닉시아는 노아와 라자를 문 뒤에 두고 방화문을 닫으려 했다.",
  nodes: linear([
    { id: "door", speaker: "", body: "통로 끝에서 두꺼운 방화문이 내려오고 있었다. 문 아래 손잡이를 쥔 날개 망토가 천천히, 아주 정중하게 그것을 끌어내리고 있었다.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "left" }, { id: "atra", slot: "right" }], cue: "rumble" },
    { id: "atra", speaker: "아트라", body: "가, 간부님. 문… 뒤에 아직 노아 간부님이랑 라자 님이…", standing: "atra", act: "tremble" },
    { id: "ikanixia", speaker: "이카닉시아", body: "알아요, 아트라. 그래서 지금 닫는 거예요. 둘을 데리러 가면 손님까지 같이 올라오잖아요.", standing: "ikanixia", act: "nod" },
    { id: "ikanixia2", speaker: "이카닉시아", body: "문 하나에 둘을 두고 오는 것쯤은 계산이 서요. 예전에도 그랬고요.", standing: "ikanixia", voice: "heavy" },
    { id: "atra2", speaker: "아트라", body: "…시, 싫어요.", standing: "atra", act: "shake" },
    { id: "wedge", speaker: "", body: "아트라가 짐수레를 문 아래로 밀어 넣었다. 내려오던 철판이 수레에 걸려 비명을 질렀다.", cue: "impact" },
    { id: "ikanixia3", speaker: "이카닉시아", body: "…어머. 우리 아트라가 이런 것도 할 줄 알았네요. 그럼 문 대신 제가 막죠.", standing: "ikanixia", cast: [{ id: "ikanixia", slot: "center" }], act: "lean" },
  ]),
};

/** 8-5 후 — 열린 틈. 라자가 아트라에게 처음으로 빚을 진다. */
const STAGE_8_5_POST: DialogueStory = {
  id: "stage-8-5-post",
  startNodeId: "gap",
  backdrop: "thirdBranchField",
  recollectionSummary: "아트라가 막은 문틈으로 라자가 나왔다. 이번에는 아무도 지워지지 않았다.",
  nodes: linear([
    { id: "gap", speaker: "", body: "수레에 걸린 문틈으로 라자가 노아를 업고 기어 나왔다. 날개 망토는 벽에 기대앉은 채 그 둘을 올려다봤다.", cast: [{ id: "raja", slot: "left" }, { id: "ikanixia", slot: "right" }] },
    { id: "raja", speaker: "라자", body: "…이번엔 안 닫으셨습니까, 간부님.", standing: "raja", act: "lean" },
    { id: "ikanixia", speaker: "이카닉시아", body: "닫으려고 했어요, 라자 님. 아트라가 못 하게 했을 뿐이죠.", standing: "ikanixia", act: "nod" },
    { id: "raja2", speaker: "라자", body: "…그때도 누가 막았으면 됐을 텐데.", standing: "raja", voice: "whisper" },
    { id: "ikanixia2", speaker: "이카닉시아", body: "후훗… 그때는 막을 사람이 없었어요.", standing: "ikanixia", act: "shrink" },
    { id: "raja3", speaker: "라자", body: "아트라. 빚 하나 졌다.", standing: "raja", cast: [{ id: "raja", slot: "left" }, { id: "atra", slot: "right" }], act: "nod" },
    { id: "atra", speaker: "아트라", body: "비, 빚 아니에요. 그냥… 목록에서 이름 지우는 거, 이제 싫어서요.", standing: "atra", act: "shrink" },
  ]),
};

/** 8-7 후 — 정비고의 식탁. 마가사가 남는 그릇 하나의 주인을 말한다. */
const STAGE_8_7_POST: DialogueStory = {
  id: "stage-8-7-post",
  startNodeId: "table",
  backdrop: "controlRoom",
  recollectionSummary: "마가사는 공구 상자 위에 그릇을 차렸다. 하나 남는 그릇은 072의 몫이었다.",
  nodes: linear([
    { id: "table", speaker: "", body: "검은 정비고 한가운데에 공구 상자가 식탁처럼 놓여 있었다. 그 위에 찌그러진 그릇 다섯 개가 가지런히 줄 서 있었다.", standing: "magasa", cast: [{ id: "magasa", slot: "center" }] },
    { id: "nodonia", speaker: "노도니아", body: "싸우다 말고 밥상을 차렸구나. …그런데 그릇이 하나 남네? 노아, 라자, 너, 부대장… 넷이잖니.", standing: "nodonia", cast: [{ id: "nodonia", slot: "left" }, { id: "magasa", slot: "right" }], act: "lean" },
    { id: "magasa", speaker: "마가사", body: "072 님 거예요. 부대장님이 명부에 다시 적어 두셨거든요. 적힌 사람 몫은 차려 두는 게 저희 규칙이라서요.", standing: "magasa", act: "nod" },
    { id: "koma", speaker: "코마", body: "…나는 그 밥 안 먹는다.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "magasa", slot: "right" }], act: "shrink" },
    { id: "magasa2", speaker: "마가사", body: "네, 알아요. 그래도 차려 둘게요. …아, 그리고 진 김에 하나 알려 드릴게요.", standing: "magasa", act: "lean" },
    { id: "magasa3", speaker: "마가사", body: "철갑 대장님은 늘 맨 뒤에 서세요. 안 올라온 사람이 있으면… 그 사람이 올 때까지 직접 내려와서 기다리세요.", standing: "magasa", voice: "whisper" },
    { id: "lift", speaker: "", body: "그 말이 끝나기도 전에 정비고 천장 너머에서 승강기 쇠줄이 길게 풀려 내려오는 소리가 났다. 아주 느리고, 아주 무거웠다.", cue: "rumble" },
  ]),
};

/** 8-10 전 — 철갑 아르겐이 승강장에 내려와 노아·라자가 올라올 때까지 맨 뒤를 받친다. */
const STAGE_8_10_PRE: DialogueStory = {
  id: "stage-8-10-pre",
  startNodeId: "wall",
  backdrop: "thirdBranchField",
  recollectionSummary: "철갑 아르겐은 노아와 라자가 올라올 때까지 승강장을 비우지 않겠다며 맨 뒤에 섰다.",
  nodes: linear([
    { id: "wall", speaker: "", body: "승강기 문이 열리자 검은 장갑을 두른 여자가 천천히 발을 내렸다. 발뒤꿈치가 닿을 때마다 바닥에 고정쇠가 하나씩 박혔다. 다섯 개째에서 소리가 멎었다.", standing: "argen", cast: [{ id: "argen", slot: "center" }], cue: "impact" },
    { id: "argen", speaker: "아르겐", body: "철갑이다. 노아랑 라자가 아직 안 올라왔어. 걔네 올라올 때까지 이 승강장은 아무도 못 지나가.", standing: "argen", act: "nod" },
    { id: "eunte2", speaker: "아르겐", body: "연구원. 너는 거기 가만히 있어. 걔네 다 올려 보내면, 그다음에 내가 직접 데리러 갈 테니까.", standing: "argen" },
    { id: "koma", speaker: "코마", body: "…철갑.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "argen", slot: "right" }], act: "shrink" },
    { id: "eunte3", speaker: "아르겐", body: "코마. 살아 있었네. 카르가 네 칸 다시 적는 거, 내가 옆에서 봤다.", standing: "argen", act: "lean" },
    { id: "nodonia", speaker: "노도니아", body: "너도 아이들을 먼저 올려 보내는구나. 그 마음은 알겠어. 나도 늘 그렇게 서 있거든.", standing: "nodonia", cast: [{ id: "nodonia", slot: "left" }, { id: "argen", slot: "right" }], act: "lean" },
    { id: "eunte4", speaker: "아르겐", body: "같은 일이라도 줄은 다르지. 네 줄에는 그 연구원이 있고, 내 줄에는 없어.", standing: "argen", act: "shake" },
    { id: "lexia", speaker: "렉시아", body: "그럼 그 줄, 제가 넘을게요. 마스터 길은 기다리는 길이 아니거든요.", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "argen", slot: "right" }], act: "hop", voice: "shout" },
  ]),
};

/** 8-10 후 — 노아·라자가 맨 마지막으로 올라오고, 위에서 기가노의 목소리가 내려온다. 명부의 072 칸이 초록으로 켜진다. */
const STAGE_8_10_POST: DialogueStory = {
  id: "stage-8-10-post",
  startNodeId: "last",
  backdrop: "thirdBranchField",
  recollectionSummary: "아르겐은 노아와 라자가 올라온 뒤에야 물러났다. 위에서 기가노가 셈을 하고 있었고, 명부의 072 칸은 초록이었다.",
  nodes: linear([
    { id: "last", speaker: "", body: "다섯 번째 고정쇠가 뽑혀 나갔다. 아르겐이 기울어지는 승강기 문을 어깨로 받치는 사이, 그 밑으로 라자가 노아를 업고 기어 나왔다.", cast: [{ id: "noa", slot: "left" }, { id: "argen", slot: "center" }, { id: "raja", slot: "right" }], cue: "rumble" },
    { id: "raja", speaker: "라자", body: "보고드립니다, 대장님. 회수조 간부가 문을 닫으라 했습니다. 아트라가 막았습니다.", standing: "raja", act: "nod" },
    { id: "argen", speaker: "아르겐", body: "…이카닉시아가? 또?", standing: "argen", act: "shake", voice: "heavy" },
    { id: "noa", speaker: "노아", body: "대, 대장님! 저 마지막이에요! 저 끝까지 안 울었어요!", standing: "noa", act: "hopTwice" },
    { id: "eunte2", speaker: "아르겐", body: "그래. 잘했다.", standing: "argen", act: "nod" },
    { id: "noa2", speaker: "", body: "노아가 그 자리에 멈춰 섰다. 방금 무슨 말을 들었는지 한 번 더 확인하려는 얼굴로, 아르겐의 장갑 끝만 쳐다봤다." },
    { id: "far", speaker: "???", body: "아르겐! 다 왔으면 올라와. 셈은 내가 할게. 회수조 장부도 내가 본다.", cue: "alarm" },
    { id: "eunte3", speaker: "아르겐", body: "…기가노는 나보다 덜 참아. 연구원, 위에서 걔 만나면 숫자부터 셀 거야. 각오해 둬.", standing: "argen", act: "lean" },
    { id: "leave", speaker: "", body: "아르겐이 둘을 먼저 승강기에 태우고, 맨 마지막에 올랐다. 문이 닫히고 쇠줄이 다시 감겼다.", standing: "argen", leave: "rise", cast: [] },
    { id: "board", speaker: "", body: "빈 승강장 벽에 명부판 하나가 걸려 있었다. 맨 아래 칸, 072라고 적힌 자리에 초록 불이 들어와 있었다.", cast: [{ id: "koma", slot: "center" }], cue: "heartbeat" },
    { id: "koma", speaker: "코마", body: "…다시 적었다.", standing: "koma", voice: "whisper" },
    { id: "koma2", speaker: "코마", body: "나는 지운 적이 있는데. 그쪽은 한 번도 지운 적이 없었던 거다.", standing: "koma", act: "shrink" },
  ]),
};

export const CHAPTER_8_STORIES = [STAGE_8_1_PRE, STAGE_8_3_POST, STAGE_8_5_PRE, STAGE_8_5_POST, STAGE_8_7_POST, STAGE_8_10_PRE, STAGE_8_10_POST];

/** 9-1 전 — 중앙 제어축. 문들이 연구원을 보고 깨어난다. */
const STAGE_9_1_PRE: DialogueStory = {
  id: "stage-9-1-pre",
  startNodeId: "shaft",
  backdrop: "controlRoom",
  recollectionSummary: "승강기가 멈춘 곳은 중앙 제어축이었다. 그 위가 바깥이었다.",
  nodes: linear([
    { id: "shaft", speaker: "", body: "승강기가 멈춘 곳은 거대한 원통의 바닥이었다. 한가운데를 굵은 축이 꿰뚫고 올라갔고, 벽을 따라 문이 층층이 박혀 있었다.", cast: [{ id: "koma", slot: "center" }] },
    { id: "koma", speaker: "코마", body: "중앙 제어축이다. 이터널 아래층을 다 이 축 하나로 돌린다. 저 위로 나가면 바깥이다.", standing: "koma", act: "lean" },
    { id: "ella", speaker: "엘라", body: "드디어 위로 난 길이네요. 연구원, 조금만 더 가요. 다 왔어요.", standing: "ella", cast: [{ id: "ella", slot: "left" }, { id: "parua", slot: "right" }], act: "nod" },
    { id: "parua", speaker: "파루아", body: "…대장님. 문마다 불이 켜져 있어요. 다 연구원님 쪽을 보고 켜져요.", standing: "parua", act: "tremble" },
    { id: "kar", speaker: "카르", body: "…왔군. 대장들이 직접 보겠단다. 너를.", standing: "kar", cast: [{ id: "kar", slot: "center" }], act: "lean", voice: "heavy" },
  ]),
};

/** 9-3 후 — 명부의 칸. 카르가 072를 다시 적은 이유를 말한다. */
const STAGE_9_3_POST: DialogueStory = {
  id: "stage-9-3-post",
  startNodeId: "kar",
  backdrop: "controlRoom",
  recollectionSummary: "카르는 072를 다시 적은 이유를 말했다. 대장들한테 하나라도 빠지면 안 된다고.",
  nodes: linear([
    { id: "kar", speaker: "카르", body: "072. 명부는 봤겠지.", standing: "kar", cast: [{ id: "koma", slot: "left" }, { id: "kar", slot: "right" }], act: "lean" },
    { id: "koma", speaker: "코마", body: "봤다. 부탁한 적 없다.", standing: "koma", act: "shake" },
    { id: "carno2", speaker: "카르", body: "부탁 받고 적은 거 아니다. 대장들한테 하나라도 빠지면, 내가 보고를 다시 써야 하니까.", standing: "kar" },
    { id: "koma2", speaker: "코마", body: "…그래서 데려가려는 건가. 나를, 아니면 저 사람을.", standing: "koma", act: "lean" },
    { id: "carno3", speaker: "카르", body: "둘 다. 순서는 대장들이 정한다.", standing: "kar", act: "nod", voice: "heavy" },
    { id: "torika", speaker: "토리카", body: "대장님은 안 돼요! 데려가려면 저부터 넘어가야 해요!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "kar", slot: "right" }], act: "puff", voice: "shout" },
    { id: "carno4", speaker: "카르", body: "…작은 게 앞에 서는군. 기억해 두지.", standing: "kar", act: "nod" },
    { id: "leave", speaker: "", body: "카르가 축을 타고 위층으로 뛰어올랐다. 그가 지나간 층마다 문이 하나씩 잠겼다.", standing: "kar", leave: "rise", cast: [] },
  ]),
};

/** 9-5 전 — 궁니르 기가노가 축을 타고 내려와 모자란 하나를 센다. */
const STAGE_9_5_PRE: DialogueStory = {
  id: "stage-9-5-pre",
  startNodeId: "drop",
  backdrop: "thirdBranchField",
  recollectionSummary: "궁니르 기가노는 셈이 하나 모자란다며 직접 축을 타고 내려왔다.",
  nodes: linear([
    { id: "drop", speaker: "", body: "위층 난간에서 붉은 외투 자락이 먼저 떨어졌다. 키 큰 여자가 축을 타고 미끄러져 내려와, 손가락을 하나씩 접으며 주위를 둘러봤다. 얼굴을 가로지른 오래된 흉터가 웃을 때마다 함께 휘었다.", standing: "gigano", cast: [{ id: "gigano", slot: "center" }], cue: "impact" },
    { id: "gigano", speaker: "기가노", body: "하나, 둘… 노아랑 라자는 아르겐이 올려 보냈고. 카르, 마가사, 다 왔고. …근데 하나가 안 맞아.", standing: "gigano", act: "nod" },
    { id: "koma", speaker: "코마", body: "…궁니르.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "gigano", slot: "right" }], act: "shrink" },
    { id: "nokan2", speaker: "기가노", body: "코마! 여기 있었네. 번호 지웠다며? 카르 그 녀석, 그거 듣고 사흘을 밥을 안 먹더라.", standing: "gigano", act: "hopTwice" },
    { id: "nokan3", speaker: "기가노", body: "연구원. 우리 애 옆에 서 있는 거, 그거 네 줄이야 우리 줄이야?", standing: "gigano", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "코마 줄이에요. 근데 마스터한테 묻는 사람 치고는 손에 힘이 너무 들어가 있네요.", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "gigano", slot: "right" }], act: "hop" },
    { id: "nokan4", speaker: "기가노", body: "뭐, 좋아. 비키라고 할 생각은 없어. 막는 놈은 같이 센다.", standing: "gigano", act: "rage", cue: "impact", voice: "shout" },
  ]),
};

/** 9-5 후 — 기가노가 셈을 미루고 물러난다. 대장들이 회수조 장부를 들여다보기 시작한다. */
const STAGE_9_5_POST: DialogueStory = {
  id: "stage-9-5-post",
  startNodeId: "breath",
  backdrop: "thirdBranchField",
  recollectionSummary: "기가노는 셈을 미루고 위로 올라갔다. 아르겐과 함께 회수조 장부를 보겠다고 했다.",
  nodes: linear([
    { id: "breath", speaker: "", body: "기가노가 축에 등을 기대고 숨을 골랐다. 외투 안쪽 붕대 위로 붉은 얼룩이 번져 있었는데, 본인은 그쪽을 한 번도 보지 않았다.", standing: "gigano", cast: [{ id: "gigano", slot: "center" }] },
    { id: "gigano", speaker: "기가노", body: "하, 셋이서 하나를 이렇게 붙잡네. 우리 애들이 이걸 못 넘었구나.", standing: "gigano", act: "squash" },
    { id: "koma", speaker: "코마", body: "…셈은 끝났나.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "gigano", slot: "right" }], act: "lean" },
    { id: "nokan2", speaker: "기가노", body: "아니. 미뤄 둔 거야. 아르겐이 회수조 장부 좀 같이 보재. 노아랑 라자 칸 누가 꺼 놨는지.", standing: "gigano", voice: "heavy" },
    { id: "nokan3", speaker: "기가노", body: "연구원. 너는 아직 우리 셈에 없어. 그러니까 오늘은 그냥 간다. 꼭대기에서 보자.", standing: "gigano", act: "nod" },
    { id: "leave", speaker: "", body: "기가노가 축을 차고 뛰어올랐다. 붉은 외투가 층을 하나씩 지나칠 때마다 문들이 차례로 잠겼다.", standing: "gigano", leave: "rise", cast: [] },
  ]),
};

/** 9-7 후 — 대장들이 선두조를 버린 장부를 알게 되고, 이카닉시아가 처음으로 자기 발로 올라간다. */
const STAGE_9_7_POST: DialogueStory = {
  id: "stage-9-7-post",
  startNodeId: "ledger",
  backdrop: "controlRoom",
  recollectionSummary: "대장들은 회수조가 선두조를 「전원 손실」로 적은 장부를 봤다. 이번에는 이카닉시아가 거둬질 차례였다.",
  nodes: linear([
    { id: "ledger", speaker: "카르", body: "대장들이 들었다. 선두조 장부에 「전원 손실」이라고 적은 거.", standing: "kar", cast: [{ id: "ikanixia", slot: "left" }, { id: "kar", slot: "right" }], act: "lean", voice: "heavy" },
    { id: "ikanixia", speaker: "이카닉시아", body: "후훗… 그때는 그게 제일 깔끔한 계산이었어요, 부대장님. 다 데려오면 다 같이 잡혔을 테니까.", standing: "ikanixia", act: "shrink" },
    { id: "carno2", speaker: "카르", body: "계산은 대장들이 한다. 너는 거두는 일만 해.", standing: "kar", act: "shake" },
    { id: "ikanixia2", speaker: "이카닉시아", body: "…그럼 이번엔 제가 거둬지는 차례겠네요.", standing: "ikanixia", act: "faint" },
    { id: "koma", speaker: "코마", body: "…일어나라. 거둬질 거면, 네 발로 올라가서 거둬져.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "ikanixia", slot: "right" }], act: "lean" },
    { id: "ikanixia3", speaker: "이카닉시아", body: "어머. 코마한테 그런 말을 다 듣네.", standing: "ikanixia", act: "nod" },
    { id: "up", speaker: "", body: "이카닉시아가 날개 망토를 털고 일어섰다. 늘 위에서 내려서던 그가, 이번에는 계단을 한 칸씩 밟아 올라갔다.", standing: "ikanixia", leave: "rise", cast: [] },
  ]),
};

/** 9-9 후 — 방출구가 열리고, 카르가 대장들에게 올린 보고를 말한다. */
const STAGE_9_9_POST: DialogueStory = {
  id: "stage-9-9-post",
  startNodeId: "lever",
  backdrop: "controlRoom",
  recollectionSummary: "카르는 방출구를 열고, 문들이 연구원을 보고 깨어났다고 대장들에게 보고했다.",
  nodes: linear([
    { id: "lever", speaker: "", body: "카르가 방출구 레버를 끝까지 내렸다. 아래층 칸막이들이 차례로 열리며 비어 있는 안쪽을 드러냈다.", standing: "kar", cast: [{ id: "kar", slot: "center" }], cue: "rumble" },
    { id: "kar", speaker: "카르", body: "…아래 칸에 남은 건 이제 없다. 우리 쪽은 전부 위로 올렸다.", standing: "kar", act: "nod" },
    { id: "carno2", speaker: "카르", body: "대장들한테는 이렇게 보고했다. 연구원이 지나갈 때마다 문이 다 깨어난다고. 이제 대장들이 직접 본다.", standing: "kar", voice: "heavy" },
    { id: "maddy", speaker: "매디", body: "…사람이 무슨 냉장고 불빛이에요? 다가가면 켜지고 멀어지면 꺼지고.", standing: "maddy", cast: [{ id: "maddy", slot: "left" }, { id: "kar", slot: "right" }], act: "puff" },
    { id: "carno3", speaker: "카르", body: "…틀린 말은 아니군.", standing: "kar", act: "nod" },
    { id: "anka", speaker: "안카", body: "위에서 두 사람 숨소리가 나요. 하나는 아주 느리고… 하나는 아주 급해요.", standing: "anka", cast: [{ id: "anka", slot: "center" }], act: "shrink", voice: "whisper" },
  ]),
};

/** 9-10 전 — 두 대장이 나란히 서서 코마를 셈에 넣는다. */
const STAGE_9_10_PRE: DialogueStory = {
  id: "stage-9-10-pre",
  startNodeId: "two",
  backdrop: "controlRoom",
  recollectionSummary: "궁니르와 철갑이 나란히 섰다. 둘은 코마를 셈에서 뺄 생각이 없었다.",
  nodes: linear([
    { id: "two", speaker: "", body: "제어축 꼭대기 앞에 두 사람이 서 있었다. 기가노는 한 걸음 앞으로 나섰다가, 이번에는 스스로 물러나 아르겐의 어깨가 닿는 자리에 섰다.", cast: [{ id: "gigano", slot: "left" }, { id: "argen", slot: "right" }] },
    { id: "gigano", speaker: "기가노", body: "다 셌어. 우리 쪽은 하나만 빈다.", standing: "gigano", act: "nod" },
    { id: "argen", speaker: "아르겐", body: "코마.", standing: "argen", voice: "heavy" },
    { id: "koma", speaker: "코마", body: "…나는 셈에서 빼라.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "gigano", slot: "right" }], act: "shrink" },
    { id: "nokan2", speaker: "기가노", body: "그건 네가 정하는 게 아니야. 우리가 세는 거지. 카르가 다시 적었고, 아르겐이 확인했고, 나는 세.", standing: "gigano", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "코마가 어디 설지는 코마가 정해요. 마스터 옆이든, 당신들 옆이든.", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "gigano", slot: "right" }], act: "hop", voice: "shout" },
    { id: "eunte2", speaker: "아르겐", body: "기가노. 오른쪽은 맡긴다.", standing: "argen", cast: [{ id: "gigano", slot: "left" }, { id: "argen", slot: "right" }], act: "nod" },
    { id: "nokan3", speaker: "기가노", body: "알아. 이번엔 먼저 안 가.", standing: "gigano", act: "nod" },
  ]),
};

/** 9-10 후 — 대장들이 물러나며 연구원도 셈에 넣겠다고 한다. 처음으로 위에서 바람이 분다. */
const STAGE_9_10_POST: DialogueStory = {
  id: "stage-9-10-post",
  startNodeId: "fall",
  backdrop: "controlRoom",
  recollectionSummary: "대장들은 다 센 조원들을 데리고 물러났다. 다음에는 연구원도 셈에 넣겠다고 했다.",
  nodes: linear([
    { id: "fall", speaker: "", body: "제어축이 기울었다. 기가노와 아르겐이 거의 동시에 무릎을 꿇었고, 둘 다 쓰러지는 쪽 어깨를 서로에게 내줬다.", cast: [{ id: "gigano", slot: "left" }, { id: "argen", slot: "right" }], cue: "rumble" },
    { id: "gigano", speaker: "기가노", body: "하, 이거 세다가 숫자 놓치겠네.", standing: "gigano", act: "squash" },
    { id: "argen", speaker: "아르겐", body: "웃지 마. 갈비 또 벌어진다.", standing: "argen", act: "shake" },
    { id: "light", speaker: "", body: "연구원이 한 걸음 다가서자 원통 벽의 문들이 일제히 불을 켰다. 맨 꼭대기 문까지, 하나도 빠짐없이.", cue: "heartbeat" },
    { id: "eunte2", speaker: "아르겐", body: "…카르 말이 맞았네.", standing: "argen", act: "lean" },
    { id: "nokan2", speaker: "기가노", body: "연구원. 너 냄새가 이상해. 사람 냄새 위로… 우리랑 같은 게 섞여 있어.", standing: "gigano", act: "lean", voice: "heavy" },
    { id: "nokan3", speaker: "기가노", body: "오늘은 우리 애들 다 셌으니까 간다. 다음엔 너도 셈에 넣을 거야.", standing: "gigano", act: "nod" },
    { id: "leave", speaker: "", body: "기가노가 먼저 축을 타고 올라갔다. 아르겐은 맨 뒤에 남아 마지막 문을 받치고 있다가, 아무도 남지 않은 것을 보고서야 손을 뗐다.", standing: "argen", leave: "rise", cast: [] },
    { id: "koma", speaker: "코마", body: "…명부에서 내 칸은 아직 초록이다.", standing: "koma", cast: [{ id: "koma", slot: "left" }, { id: "lexia", slot: "right" }], act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "지울 거예요?", standing: "lexia", act: "lean" },
    { id: "koma2", speaker: "코마", body: "안 지운다. 적힌 건 그쪽 사정이다. …가는 건 내가 정한다.", standing: "koma", act: "nod" },
    { id: "wind", speaker: "", body: "열린 꼭대기 문 너머에서 바람이 내려왔다. 기름 냄새가 아닌, 처음 맡는 바깥 공기였다." },
  ]),
};

export const CHAPTER_9_STORIES = [STAGE_9_1_PRE, STAGE_9_3_POST, STAGE_9_5_PRE, STAGE_9_5_POST, STAGE_9_7_POST, STAGE_9_9_POST, STAGE_9_10_PRE, STAGE_9_10_POST];

for (const story of [...CHAPTER_8_STORIES, ...CHAPTER_9_STORIES]) registerDialogueTexts(story);
