import type { DialogueCastMember, DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **서브 이야기 — 1~7장 곁가지.**
 *
 * 본편 지도 옆에 SUB 노드로 달리는 전투 없는 이야기다. 코마의 비밀은 쓰지 않는다 — 연구원도, 이 글도 모른다.
 * 코마는 짧은 단문·존대 없음, 아트라는 더듬는 말씨, 엘라·파치·유티·아크는 각자의 연구원 호칭을 쓴다.
 */

const SOLO = (id: "koma" | "atra"): readonly DialogueCastMember[] => [{ id, slot: "center" }];
const WITH_KOMA = (other: "torika" | "dodi" | "lexia"): readonly DialogueCastMember[] => [{ id: other, slot: "left" }, { id: "koma", slot: "right" }];

/** 2-3 SUB — 냉각 수로에서 코마가 연구원증을 가져간다. */
export const STAGE_2_3_LOST_BADGE: DialogueStory = {
  id: "stage-2-3-lost-badge",
  startNodeId: "pass",
  backdrop: "battlefield",
  nodes: linear([
    { id: "pass", speaker: "", body: "냉각 수로의 어둠 속에서 그림자 하나가 스친다. 가슴께가 가벼워진 것을 알아차렸을 때는 이미 늦었다.", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "right" }], act: "shake" },
    { id: "gone", speaker: "도디", body: "연구원님 사원증이요! 방금 그게 가져갔어요!", standing: "dodi", act: "hopTwice" },
    { id: "turn", speaker: "코마", body: "…번호를 봤을 뿐이다.", standing: "koma", cast: WITH_KOMA("torika"), act: "lean" },
    { id: "hand", speaker: "", body: "사원증을 쥔 손등에 아물지 않은 긁힌 자국이 길게 나 있다.", standing: "koma" },
    { id: "hurt", speaker: "토리카", body: "저기… 다치셨어요?", standing: "torika", act: "lean" },
    { id: "silent", speaker: "코마", body: "…", standing: "koma", act: "recoil" },
    {
      id: "choose", speaker: "", body: "코마가 수로 끝에서 멈춘 채 연구원을 돌아본다.", standing: "koma",
      choices: [
        { id: "chase", label: "돌려받으러 쫓아간다", nextId: "plunge", effect: { type: "bondXp", relicId: "dodo", amount: 3 } },
        { id: "wound", label: "손의 상처가 마음에 걸린다", nextId: "plunge", effect: { type: "bondXp", relicId: "torika", amount: 3 } },
      ],
    },
    { id: "plunge", speaker: "", body: "대답은 없다. 물소리 한 번을 남기고 그림자는 수로 아래로 사라진다.", standing: "koma", cast: [], cue: "impact" },
    { id: "dodi", speaker: "도디", body: "…쫓아가요. 저 방향이면 생산선 쪽이에요.", standing: "dodi", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "right" }], act: "nod" },
  ]),
};

/** 2-6 SUB — 생산선 뒤편에서 코마가 번호를 맞춰 본다. */
export const STAGE_2_6_SAME_LINE: DialogueStory = {
  id: "stage-2-6-same-line",
  startNodeId: "back",
  backdrop: "battlefield",
  nodes: linear([
    { id: "back", speaker: "", body: "무인 생산선 뒤편, 불 꺼진 정비 통로. 코마가 벽에 기대 사원증과 제 목덜미의 폐기 표식을 번갈아 본다.", standing: "koma", cast: SOLO("koma") },
    { id: "compare", speaker: "코마", body: "…같은 줄에 있어서.", standing: "koma", cast: WITH_KOMA("lexia"), act: "lean" },
    { id: "what", speaker: "렉시아", body: "줄이라니, 무슨 줄이야? 설명해!", standing: "lexia", act: "hop" },
    { id: "count", speaker: "코마", body: "위에서는 번호로 센다. 나도, 당신도.", standing: "koma", act: "nod" },
    {
      id: "choose", speaker: "", body: "연구원이 한 걸음 다가선다.", standing: "koma",
      choices: [
        { id: "return", label: "돌려 달라", nextId: "returnA", effect: { type: "bondXp", relicId: "rex", amount: 3 } },
        { id: "okay", label: "괜찮아?", nextId: "okayB", effect: { type: "bondXp", relicId: "rex", amount: 3 } },
      ],
    },
    { id: "returnA", speaker: "코마", body: "…아직이다. 확인이 끝나면 돌려준다.", standing: "koma", act: "recoil", nextId: "tail" },
    { id: "okayB", speaker: "코마", body: "……확인이 끝나면 돌려준다.", standing: "koma", act: "recoil", nextId: "tail" },
    { id: "tail", speaker: "", body: "코마는 사원증을 품에 넣고 어둠 속으로 한 걸음 물러난다. 꼬리가 바닥을 낮게 쓴다.", standing: "koma", cast: SOLO("koma") },
  ]),
};

/** 2-9 SUB — 막다른 난간. 길을 깐 것은 코마가 아니라 「위」였다. */
export const STAGE_2_9_SECOND_CHASE: DialogueStory = {
  id: "stage-2-9-second-chase",
  startNodeId: "edge",
  backdrop: "battlefield",
  nodes: linear([
    { id: "edge", speaker: "", body: "컨베이어가 끊긴 막다른 난간. 일직선으로 곧게 난 길의 끝에 코마가 서 있다.", standing: "koma", cast: WITH_KOMA("torika"), cue: "rumble" },
    { id: "bait", speaker: "코마", body: "…너무 곧은 길이다. 처음부터 위가 깔았다. 나는 미끼였다.", standing: "koma", act: "recoil" },
    { id: "know", speaker: "토리카", body: "알면서도… 여기까지 오신 거예요?", standing: "torika", act: "lean" },
    { id: "order", speaker: "코마", body: "명령이었다. 당신을 이 끝까지 끌고 오라는.", standing: "koma", act: "shrink" },
    { id: "clash", speaker: "", body: "코마가 소리 없이 뛰어든다. 짧고 날카로운 한 번의 교차. 이번에는 연구원의 지시가 한 박자 빨랐다.", standing: "koma", cue: "impact", act: "faint" },
    { id: "kneel", speaker: "코마", body: "…졌다. 두 번째다.", standing: "koma", act: "squash" },
    { id: "give", speaker: "", body: "코마가 품에서 사원증을 꺼내 난간 위에 내려놓는다.", standing: "koma" },
    { id: "promise", speaker: "코마", body: "약속이다. 위에는 내가 했다고 한다. 혼자서.", standing: "koma", act: "nod" },
    { id: "warn", speaker: "코마", body: "위가 당신을 찾는다. 내 번호가 아니라, 당신 번호로.", standing: "koma", act: "lean" },
    { id: "exit", speaker: "", body: "코마는 난간 아래 구멍으로 몸을 던진다. 어둠이 소리 없이 삼킨다.", standing: "koma", cast: [{ id: "torika", slot: "center" }] },
  ]),
};

/** 3-5 SUB — 아트라의 목록. 코마는 아직 회수 전이다. */
export const STAGE_3_5_BEHIND_SLEEVE: DialogueStory = {
  id: "stage-3-5-behind-sleeve",
  startNodeId: "hide",
  backdrop: "deepField",
  nodes: linear([
    { id: "hide", speaker: "", body: "전투가 끝난 폐관. 소매 뒤에서 눈만 내놓은 아트라가 연구원을 올려다본다. 쓰러지지도, 물러서지도 않는다.", standing: "atra", cast: SOLO("atra") },
    { id: "list", speaker: "아트라", body: "그, 그게… 저, 저는 목록이 있어요. 마음에 드는 사람… 이름 적는 목록.", standing: "atra", act: "tremble" },
    { id: "you", speaker: "아트라", body: "연, 연구원님도 오늘… 거, 거기에 적었어요. 아, 아프게 안 해요. 조, 조금만… 같이 가 주시면…", standing: "atra", act: "shrink" },
    { id: "koma", speaker: "코마", body: "…따라오지 마라.", standing: "koma", cast: [{ id: "atra", slot: "left" }, { id: "koma", slot: "right" }], act: "lean" },
    { id: "no", speaker: "아트라", body: "시, 싫어요… 선배는 아직 회수 전이라서… 그, 그러니까 제가 옆에, 있을게요.", standing: "atra", act: "recoil" },
    { id: "sigh", speaker: "코마", body: "…마음대로 해.", standing: "koma", act: "shrink" },
    { id: "end", speaker: "", body: "코마의 뒷모습 곁에 소매 뒤의 눈이 바싹 붙어 따라간다. 연구원의 이름은 아직 목록에서 지워지지 않았다.", standing: "atra", cast: SOLO("atra") },
  ]),
};

/** 3-8 SUB — 부서진 벽 하나, 날아온 시말서 한 장. */
export const STAGE_3_8_APOLOGY: DialogueStory = {
  id: "stage-3-8-apology",
  startNodeId: "wall",
  backdrop: "deepField",
  nodes: linear([
    { id: "wall", speaker: "", body: "파치가 뚫어 놓은 벽의 파편 더미 곁. 엘라가 양손에 서류를 든 채 한숨을 쉰다.", standing: "ella", cast: [{ id: "ella", slot: "left" }, { id: "pachi", slot: "right" }], act: "lean" },
    { id: "report", speaker: "엘라", body: "연구원님, 벽 건은 제가 시말서로 정리해 두겠습니다. 이번 달 열두 번째 장이에요.", standing: "ella", act: "nod" },
    { id: "pachi", speaker: "파치", body: "길 열었으면 됐지! 그 시말서 안 써도 벽은 이미 뚫려 있는데?", standing: "pachi", act: "rage" },
    { id: "boss", speaker: "엘라", body: "서류가 없으면 벽이 아니라 우리 쪽 예산이 뚫립니다, 파치 님.", standing: "ella", act: "shake" },
    { id: "ark", speaker: "아크", body: "…마스터, 이 구간은 우리가 맡겠습니다. 뒤는 신경 쓰지 마십시오.", standing: "ark", cast: [{ id: "ark", slot: "left" }, { id: "yuti", slot: "right" }], act: "nod" },
    { id: "yuti", speaker: "유티", body: "저, 저기 보스… 아니 마스터… 아니 연구원님! 이쪽 통로로 쭉 가시면 돼요!", standing: "yuti", act: "hopTwice" },
    { id: "pachi2", speaker: "파치", body: "보스! 다음 벽은 또 어디야?", standing: "pachi", cast: [{ id: "ella", slot: "left" }, { id: "pachi", slot: "right" }], act: "hop" },
    { id: "ella2", speaker: "엘라", body: "…먼저 시말서부터 쓰고요.", standing: "ella", act: "recoil" },
  ]),
};

/** 1-8 전투 SUB 전 — 수문 아래 보급 상자를 두고 공멸 셋이 먼저 와 있다. */
export const STAGE_1_8_SIDE_PRE: DialogueStory = {
  id: "stage-1-8-side-pre",
  startNodeId: "crate",
  backdrop: "battlefield",
  nodes: linear([
    { id: "crate", speaker: "", body: "수문 아래 물가. 티아가 건져 올리던 보급 상자 위에 낯익은 세 그림자가 걸터앉아 있다.", standing: "toby", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }] },
    { id: "found", speaker: "토비", body: "찾았다! 이 상자 안에서 맛있는 냄새가 나! 우리가 먼저 발견한 거야!", standing: "toby", act: "bounce" },
    { id: "tired", speaker: "아모", body: "…먼저가 아니라 떠내려온 거잖아. 그리고 배고픈 건 너뿐이야.", standing: "amo", act: "shrink" },
    { id: "light", speaker: "리파", body: "어? 위에 연구원이다! 들켰네? 근데 상자는 우리가 먼저 앉았으니까 우리 거지?", standing: "ripa", act: "hop" },
    { id: "torika", speaker: "토리카", body: "저 상자는 티아가 소중히 건져 둔 거예요! 돌려주세요!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "toby", slot: "center" }, { id: "parua", slot: "right" }], act: "puff" },
    { id: "stand", speaker: "토비", body: "그럼 정정당당하게 가위바위보… 아니, 힘으로 정하자! 이긴 쪽이 간식을 먹는다!", standing: "toby", act: "rage", cue: "impact" },
  ]),
};

/** 1-8 전투 SUB 후 — 열어 본 상자에는 정작 반짝이는 조각뿐이었다. */
export const STAGE_1_8_SIDE_POST: DialogueStory = {
  id: "stage-1-8-side-post",
  startNodeId: "open",
  backdrop: "battlefield",
  nodes: linear([
    { id: "open", speaker: "", body: "상자를 열자 반짝이는 조각이 가득 쏟아진다. 간식은 한 알도 없다.", standing: "toby", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }], act: "squash" },
    { id: "cry", speaker: "토비", body: "이게 뭐야! 먹을 수가 없잖아! 나 아까 냄새 분명히 났는데!", standing: "toby", act: "faint" },
    { id: "sniff", speaker: "리파", body: "음… 그 냄새, 아까 티아가 소매에 넣어 둔 간식 냄새 아니었어?", standing: "ripa", act: "lean" },
    { id: "sigh", speaker: "아모", body: "…그럴 줄 알았어. 이제 그만 가자. 코마가 기다리겠다.", standing: "amo", act: "nod" },
    { id: "tia", speaker: "티아", body: "으아앗, 내 보물! 다 흩어졌잖아요! 연구원님, 같이 주워 주실 거죠?", standing: "tia", cast: [{ id: "torika", slot: "left" }, { id: "tia", slot: "center" }, { id: "parua", slot: "right" }], act: "hopTwice" },
    { id: "pick", speaker: "토리카", body: "물론이죠! 반짝반짝해서 줍는 보람이 있네요.", standing: "torika", act: "hop" },
  ]),
};

/*
 * ── 2~7장 서브 (v0.408.0) ──────────────────────────────────────────────────────────
 * 전투 서브는 `stage-<관문>-side-pre/post` 한 쌍, 이야기 서브는 제 이름의 한 편이다. 본편의 사건을 옆에서 받쳐 주는 곁가지라
 * 새 비밀을 풀지 않고, 본편에 이미 깔린 실(표식·목록·보류·서열·번호 지우기)을 한 뼘씩 더 보여 준다.
 */

/** 2-4 전투 SUB 전 — 다시 꺼진 중계실. 토비와 리파가 번호 벽을 등지고 선다. */
export const STAGE_2_4_SIDE_PRE: DialogueStory = {
  id: "stage-2-4-side-pre",
  startNodeId: "dark",
  backdrop: "battlefield",
  nodes: linear([
    { id: "dark", speaker: "", body: "불이 들어왔던 중계실이 다시 깜빡, 꺼진다. 어둠 속에서 차단기 내려가는 소리가 두 번 난다.", standing: "toby", cast: [{ id: "toby", slot: "left" }, { id: "ripa", slot: "right" }], cue: "rumble" },
    { id: "toby", speaker: "토비", body: "이번엔 내가 내린 거 맞아! 불 켜져 있으면 너네가 우리 얼굴부터 보잖아!", standing: "toby", act: "rage" },
    { id: "ripa", speaker: "리파", body: "아모는 혼자 먼저 갔어. 그래서 오늘은 우리 둘이야. 얼굴 덜 보이는 쪽이 낫거든.", standing: "ripa", act: "lean" },
    { id: "wall", speaker: "도디", body: "대장님, 저 벽이요. 표식 아래에 번호가 빼곡해요. 불이 꺼지면 하나도 안 보여요.", standing: "dodi", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "center" }, { id: "parua", slot: "right" }], act: "hop" },
    { id: "guard", speaker: "파루아", body: "…저 둘, 벽을 등지고 서 있어요. 저걸 지키는 거예요.", standing: "parua", act: "lean" },
    { id: "why", speaker: "리파", body: "지키는 거 아니야. 그냥… 우리 번호 옆에 뭐라고 적혔는지 너네가 먼저 보는 게 싫어서.", standing: "ripa", cast: [{ id: "toby", slot: "left" }, { id: "ripa", slot: "right" }], act: "shrink" },
    { id: "go", speaker: "토비", body: "말 많다! 이기면 불 켜 주고, 지면 그냥 지나가! 간다!", standing: "toby", act: "rage", cue: "impact" },
  ]),
};

/** 2-4 전투 SUB 후 — 불이 돌아온 벽. 점은 「쓸 수 없음」, 선은 「옮김」. */
export const STAGE_2_4_SIDE_POST: DialogueStory = {
  id: "stage-2-4-side-post",
  startNodeId: "light",
  backdrop: "battlefield",
  nodes: linear([
    { id: "light", speaker: "", body: "차단기가 올라가고 중계실에 불이 돌아온다. 벽 한 면을 번호가 빼곡히 채우고 있다. 번호마다 점 아니면 선이 붙어 있다.", standing: "dodi", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "center" }, { id: "parua", slot: "right" }] },
    { id: "read", speaker: "도디", body: "점은 「쓸 수 없음」, 선은 「옮김」… 대장님, 선이 붙은 번호가 훨씬 적어요.", standing: "dodi", act: "lean" },
    { id: "mine", speaker: "리파", body: "…내 번호에는 선이 있네. 옮겨졌대. 어디로 옮겨졌는지는 안 적혀 있고.", standing: "ripa", cast: [{ id: "toby", slot: "left" }, { id: "ripa", slot: "right" }], act: "lean" },
    { id: "dots", speaker: "토비", body: "그럼 된 거잖아! 옮겨졌으니까 지금 여기 있는 거고! …점 붙은 애들은 어디 갔는데?", standing: "toby", act: "tremble" },
    {
      id: "choose", speaker: "", body: "아무도 대답하지 않는다. 연구원이 벽 앞으로 한 걸음 다가선다.", standing: "ripa",
      choices: [
        { id: "write", label: "번호를 전부 적어 두자", nextId: "writeA", effect: { type: "bondXp", relicId: "dodo", amount: 3 } },
        { id: "dot", label: "점이 붙은 번호도 찾아보자", nextId: "dotB", effect: { type: "bondXp", relicId: "parua", amount: 3 } },
      ],
    },
    { id: "writeA", speaker: "도디", body: "네! 하나도 안 빼고 일지에 옮길게요. 벽이 지워져도 여기 남아 있게요.", standing: "dodi", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "center" }, { id: "parua", slot: "right" }], act: "nod", nextId: "again" },
    { id: "dotB", speaker: "파루아", body: "…네. 점이 붙었다고 끝난 건 아니에요. 아모 씨도 점이었잖아요.", standing: "parua", cast: [{ id: "torika", slot: "left" }, { id: "dodi", slot: "center" }, { id: "parua", slot: "right" }], act: "nod", nextId: "again" },
    { id: "again", speaker: "리파", body: "…이상한 연구원이야. 다음에 또 불 끄면, 그땐 같이 읽어 줘.", standing: "ripa", cast: [{ id: "toby", slot: "left" }, { id: "ripa", slot: "right" }], act: "hop" },
    { id: "amo", speaker: "토비", body: "읽긴 뭘 읽어! 가자, 리파. 아모 혼자 두면 또 혼자 다 짊어진단 말이야.", standing: "toby", act: "nod" },
  ]),
};

/** 3-3 전투 SUB 전 — 고대 급수원. 미르와 펄시가 연구원을 두고 점수 내기를 한다. */
export const STAGE_3_3_SIDE_PRE: DialogueStory = {
  id: "stage-3-3-side-pre",
  startNodeId: "count",
  backdrop: "deepField",
  nodes: linear([
    { id: "count", speaker: "", body: "고대 급수원의 물이 발목까지 찰랑인다. 수조 둘레에 미르와 펄시가 쪼그려 앉아 손가락으로 무언가를 세고 있다.", standing: "mir", cast: [{ id: "mir", slot: "left" }, { id: "pulsi", slot: "right" }] },
    { id: "first", speaker: "미르", body: "그러니까 제가 먼저 봤잖아요! 연구원님 모셔 가면 그 점수는 제 거예요!", standing: "mir", act: "hop" },
    { id: "catch", speaker: "펄시", body: "먼저 본 건 상관없어. 먼저 잡는 쪽이 이기는 거야. 깜짝 선물도 내가 먼저 준비했고.", standing: "pulsi", act: "lean" },
    { id: "lexia", speaker: "렉시아", body: "나를 앞에 두고 마스터를 점수로 나누는 거야? 배짱 하나는 칭찬해 줄게!", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "mir", slot: "center" }, { id: "pulsi", slot: "right" }], act: "rage" },
    { id: "double", speaker: "미르", body: "앗, 렉시아 님도 점수가 꽤 높아요! 같이 모시면 두 배예요!", standing: "mir", act: "bounce" },
    { id: "bet", speaker: "펄시", body: "좋네. 그럼 둘 다 걸고 하자. 지는 쪽이 오늘 저녁 설거지야.", standing: "pulsi", act: "puff", cue: "impact" },
  ]),
};

/** 3-3 전투 SUB 후 — 떠내려온 점수판. 칸이 전부 비어 있다. */
export const STAGE_3_3_SIDE_POST: DialogueStory = {
  id: "stage-3-3-side-post",
  startNodeId: "splash",
  backdrop: "deepField",
  nodes: linear([
    { id: "splash", speaker: "", body: "물보라가 가라앉는다. 미르와 펄시가 등을 맞댄 채 주저앉아 숨을 몰아쉰다.", standing: "mir", cast: [{ id: "mir", slot: "left" }, { id: "pulsi", slot: "right" }] },
    { id: "zero", speaker: "미르", body: "에이, 둘 다 놓쳤어요… 네우리한테 또 「0점」이라고 적히겠다.", standing: "mir", act: "squash" },
    { id: "praise", speaker: "펄시", body: "괜찮아. 어차피 점수 모아도 간부님은 칭찬 한 번 안 해 주잖아.", standing: "pulsi", act: "shrink" },
    { id: "someday", speaker: "미르", body: "그래도 모으면… 언젠가 「잘했어요」 한 번은 들을지도 모르잖아요.", standing: "mir", act: "lean" },
    { id: "radio", speaker: "루카", body: "연구원님, 무전이야. 쟤네 점수판이 방금 물에 떠내려와서 주웠어. 근데 칸이 전부 비어 있어. 누가 매긴 흔적도 없고.", standing: "luka", remote: true },
    {
      id: "choose", speaker: "", body: "젖은 점수판이 연구원의 손에 들어온다.", standing: "mir",
      choices: [
        { id: "return", label: "그대로 돌려준다", nextId: "returnA", effect: { type: "bondXp", relicId: "rex", amount: 3 } },
        { id: "fill", label: "첫 칸을 채워 준다", nextId: "fillB", effect: { type: "bondXp", relicId: "luka", amount: 3 } },
      ],
    },
    { id: "returnA", speaker: "렉시아", body: "자, 돌려줄게. 다음엔 점수 말고 제대로 덤벼. 그럼 나도 제대로 상대해 줄게.", standing: "lexia", cast: [{ id: "lexia", slot: "left" }, { id: "mir", slot: "center" }, { id: "pulsi", slot: "right" }], act: "nod", nextId: "laugh" },
    { id: "fillB", speaker: "루카", body: "…그럼 「끝까지 뛰었음」이라고 적어 둬. 첫 칸은 그거면 돼.", standing: "luka", remote: true, nextId: "laugh" },
    { id: "laugh", speaker: "미르", body: "…헤헤. 연구원님 쪽은 점수를 이상하게 주네요. 다음에 또 모시러 올게요!", standing: "mir", cast: [{ id: "mir", slot: "left" }, { id: "pulsi", slot: "right" }], act: "hopTwice" },
    { id: "gone", speaker: "", body: "두 그림자가 물을 튀기며 통로 너머로 사라진다. 펄시가 한 번 뒤돌아본 것은 아무도 보지 못했다.", standing: "pulsi", cast: [] },
  ]),
};

/** 4-3 SUB — 배관 뒤에 숨어 쉬는 삼인조. 잔향 지구의 약속은 아직 유효한가. */
export const STAGE_4_3_BREAK_TIME: DialogueStory = {
  id: "stage-4-3-break-time",
  startNodeId: "hide",
  backdrop: "deepField",
  nodes: linear([
    { id: "hide", speaker: "", body: "점검 통로 끝, 배관 뒤 좁은 틈. 싸움이 끝난 삼인조가 몸을 웅크리고 앉아 있다. 리파가 아모의 팔에 붕대를 감는다.", standing: "ripa", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }] },
    { id: "wrap", speaker: "리파", body: "가만히 있어, 아모. 미르가 세러 오기 전에 다 감아야 해. 다친 데도 점수래.", standing: "ripa", act: "lean" },
    { id: "why", speaker: "토비", body: "…야, 연구원. 왜 따라왔어. 진심으로 하라고 해서 진심으로 했잖아.", standing: "toby", act: "shrink" },
    { id: "thanks", speaker: "아모", body: "…덕분에 안 혼났어. 연구원이 세게 와 줘서. 고마워.", standing: "amo", act: "nod" },
    { id: "snack", speaker: "토리카", body: "대장님이 간식 챙겨 오셨어요. 셋이 나눠 드세요!", standing: "torika", cast: [{ id: "torika", slot: "left" }, { id: "amo", slot: "center" }, { id: "toby", slot: "right" }], act: "hop" },
    { id: "smell", speaker: "토비", body: "…치즈케이크다. 잔향 지구 때 그 상자랑 같은 냄새.", standing: "toby", act: "lean" },
    { id: "ask", speaker: "아모", body: "…연구원. 그때 따라가도 되냐고 물었던 거. 아직 유효해?", standing: "amo", act: "lean" },
    {
      id: "choose", speaker: "", body: "아모가 붕대 감긴 팔을 무릎에 올린 채 대답을 기다린다.", standing: "amo",
      choices: [
        { id: "keep", label: "그 약속은 그대로야", nextId: "keepA", effect: { type: "bondXp", relicId: "torika", amount: 3 } },
        { id: "next", label: "다음엔 꼭 데려갈게", nextId: "nextB", effect: { type: "bondXp", relicId: "dodo", amount: 3 } },
      ],
    },
    { id: "keepA", speaker: "아모", body: "…그렇구나. 그럼 오늘도 끌려가는 게 아니라, 잠깐 떨어져 있는 거야.", standing: "amo", act: "nod", nextId: "steps" },
    { id: "nextB", speaker: "아모", body: "…다음. 그 말, 위에서는 한 번도 안 해 줬어.", standing: "amo", act: "shrink", nextId: "steps" },
    { id: "steps", speaker: "리파", body: "쉿. 발소리. 미르가 세러 온다.", standing: "ripa", cast: [{ id: "amo", slot: "left" }, { id: "toby", slot: "center" }, { id: "ripa", slot: "right" }], act: "fright", cue: "rumble" },
    { id: "run", speaker: "토비", body: "빨리 가! 우리랑 같이 쉰 거 들키면 너네도 점수 깎여!", standing: "toby", act: "rage" },
    { id: "roll", speaker: "", body: "연구원이 틈을 빠져나오자 등 뒤에서 「셋, 다 있어요?」 하는 밝은 목소리가 들린다. 「네에.」 세 목소리가 한꺼번에 대답한다.", standing: "toby", cast: [] },
  ]),
};

/** 4-7 전투 SUB 전 — 지하 정비동. 네우리의 장부에는 코마 칸만 「보류」가 쌓여 있다. */
export const STAGE_4_7_SIDE_PRE: DialogueStory = {
  id: "stage-4-7-side-pre",
  startNodeId: "ledger",
  backdrop: "deepField",
  nodes: linear([
    { id: "ledger", speaker: "", body: "지하 정비동 한구석. 공구 선반 위에 네우리가 걸터앉아 두꺼운 장부를 넘긴다. 펄시가 그 옆에서 하품을 한다.", standing: "neuri", cast: [{ id: "neuri", slot: "left" }, { id: "pulsi", slot: "right" }] },
    { id: "hold", speaker: "네우리", body: "코마 님, 이번 주에도 「확보 실패」… 어머, 이 칸은 또 「보류」네요. 보류가 벌써 몇 번째일까요.", standing: "neuri", act: "lean" },
    { id: "fun", speaker: "펄시", body: "그거 위에 그대로 올리면 코마는 끝이잖아. 재밌겠다.", standing: "pulsi", act: "puff" },
    { id: "trick", speaker: "델로피", body: "짠~ 그 장부, 제가 지금부터 사라지게 해 볼게요. 연구원님, 박수 준비해 주세요.", standing: "delopi", cast: [{ id: "delopi", slot: "left" }, { id: "neuri", slot: "center" }, { id: "pulsi", slot: "right" }], act: "hop" },
    { id: "write", speaker: "네우리", body: "어머, 마술사님이시네요. 그럼 사라지기 전에 연구원님 이름부터 적어 둘게요. 「확보 완료」로요.", standing: "neuri", act: "nod" },
    { id: "door", speaker: "루카", body: "연구원님, 정비동 뒷문은 열어 놨어. 델로피가 장부 낚아채면 그쪽으로 뛰어. 소리는 내지 말고.", standing: "luka", remote: true },
    { id: "gift", speaker: "펄시", body: "도망칠 구멍까지 다 만들어 놨네. 좋아, 깜짝 선물은 이쪽이 먼저야!", standing: "pulsi", act: "rage", cue: "impact" },
  ]),
};

/** 4-7 전투 SUB 후 — 낚아챈 장부. 「보류」는 데려올 수 있었는데 데려오지 않았다는 뜻이다. */
export const STAGE_4_7_SIDE_POST: DialogueStory = {
  id: "stage-4-7-side-post",
  startNodeId: "paper",
  backdrop: "deepField",
  nodes: linear([
    { id: "paper", speaker: "", body: "공구 선반이 쓰러지고 종이가 눈처럼 흩날린다. 델로피의 손에 장부 한 권이 들려 있다.", standing: "delopi", cast: [{ id: "delopi", slot: "left" }, { id: "neuri", slot: "right" }] },
    { id: "look", speaker: "델로피", body: "사라졌다 나타났습니다~ …어, 근데 이 장부, 장난칠 데가 없네요. 코마 칸만 전부 「보류」예요.", standing: "delopi", act: "lean" },
    { id: "mean", speaker: "루카", body: "보류라는 건 데려올 수 있었는데 안 데려왔다는 뜻이야. 열 번도 넘게.", standing: "luka", remote: true },
    { id: "back", speaker: "네우리", body: "…어흠. 돌려주세요. 그건 저희 간부님께 올릴 장부예요.", standing: "neuri", cast: [{ id: "delopi", slot: "left" }, { id: "neuri", slot: "right" }], act: "shrink" },
    {
      id: "choose", speaker: "", body: "델로피가 장부를 든 채 연구원을 돌아본다.", standing: "delopi",
      choices: [
        { id: "give", label: "장부를 돌려준다", nextId: "giveA", effect: { type: "bondXp", relicId: "delopi", amount: 3 } },
        { id: "tear", label: "코마의 칸만 떼어 둔다", nextId: "tearB", effect: { type: "bondXp", relicId: "luka", amount: 3 } },
      ],
    },
    { id: "giveA", speaker: "델로피", body: "네, 돌려드릴게요. 대신 마술 하나는 남겨 뒀어요. 펴 보시면 아실 거예요.", standing: "delopi", act: "nod", nextId: "neuri" },
    { id: "tearB", speaker: "델로피", body: "찢는 건 마술이 아니라서요… 그 대신 이 한 장만 쓱, 사라지게 해 드릴게요.", standing: "delopi", act: "hop", nextId: "neuri" },
    { id: "neuri", speaker: "네우리", body: "후훗… 오늘 일은 「보류」로 적어 둘게요. 저도 한 번쯤은 써 보고 싶었거든요.", standing: "neuri", act: "lean" },
    { id: "left", speaker: "", body: "네우리와 펄시가 뒷문 반대편으로 사라진다. 바닥에 떨어진 종이 한 장에 「072 — 보류」라는 글씨가 남아 있다.", standing: "delopi", cast: [] },
  ]),
};

/** 5-2 전투 SUB 전 — 검문 격자. 아트라가 감방 열쇠꾸러미를 소매에 감춘다. */
export const STAGE_5_2_SIDE_PRE: DialogueStory = {
  id: "stage-5-2-side-pre",
  startNodeId: "keys",
  backdrop: "prisonField",
  nodes: linear([
    { id: "keys", speaker: "", body: "검문 격자 앞. 아트라가 허리에 매단 열쇠꾸러미를 소매 속에 감추며 뒷걸음질 친다. 그 뒤에 미르가 팔짱을 끼고 서 있다.", standing: "atra", cast: [{ id: "atra", slot: "left" }, { id: "mir", slot: "right" }] },
    { id: "no", speaker: "아트라", body: "이, 이건 못 드려요… 감, 감방 열쇠라서… 선배가 맡겨 둔 거라서…", standing: "atra", act: "tremble" },
    { id: "score", speaker: "미르", body: "아트라, 그거 들고 있으면 점수 두 배래요! 연구원님까지 모시면 세 배!", standing: "mir", act: "bounce" },
    { id: "salvage", speaker: "모사나", body: "당신은 뒤로. 저 열쇠는 인양한다. 물건은 제자리에 있어야 한다.", standing: "mosana", cast: [{ id: "mosana", slot: "left" }, { id: "atra", slot: "center" }, { id: "mir", slot: "right" }], act: "nod" },
    { id: "list", speaker: "아트라", body: "그, 그리고… 연구원님 이름, 아직 제 목록에 있어요. 지, 지우지 않았어요.", standing: "atra", act: "shrink" },
    { id: "go", speaker: "미르", body: "그럼 목록대로 모셔 가요! 간다아!", standing: "mir", act: "hop", cue: "impact" },
  ]),
};

/** 5-2 전투 SUB 후 — 번호가 새겨진 열쇠들. 맨 아래 칸의 고리만 비어 있다. */
export const STAGE_5_2_SIDE_POST: DialogueStory = {
  id: "stage-5-2-side-post",
  startNodeId: "drop",
  backdrop: "prisonField",
  nodes: linear([
    { id: "drop", speaker: "", body: "쇠고리가 끊어지며 열쇠꾸러미가 바닥을 구른다. 모사나가 허리를 굽혀 그것을 줍는다.", standing: "mosana", cast: [{ id: "mosana", slot: "left" }, { id: "atra", slot: "right" }] },
    { id: "numbers", speaker: "모사나", body: "열쇠마다 번호가 새겨져 있다. 감방 번호와 같다.", standing: "mosana", act: "lean" },
    { id: "empty", speaker: "모사나", body: "…하나가 비었다. 맨 아래 칸. 고리에 걸었던 자국만 남았다.", standing: "mosana" },
    { id: "hand", speaker: "아트라", body: "그, 그건 원래 없어요… 맨 아래 문은 열쇠로 안 열린대요. 사, 사람 손이어야 한대요…", standing: "atra", act: "tremble" },
    {
      id: "choose", speaker: "", body: "모사나가 열쇠꾸러미를 든 채 연구원의 대답을 기다린다.", standing: "mosana",
      choices: [
        { id: "return", label: "열쇠를 돌려준다", nextId: "returnA", effect: { type: "bondXp", relicId: "mosana", amount: 3 } },
        { id: "erase", label: "목록에서 이름을 지워 달라고 한다", nextId: "eraseB", effect: { type: "bondXp", relicId: "mosana", amount: 3 } },
      ],
    },
    { id: "returnA", speaker: "모사나", body: "가져가라. 인양은 꺼낸 물건을 주인에게 돌려주는 일이다.", standing: "mosana", act: "nod", nextId: "atraA" },
    { id: "atraA", speaker: "아트라", body: "…고, 고맙습니다. 그래도 목록에서는 안 지울 거예요.", standing: "atra", act: "nod", nextId: "mir" },
    { id: "eraseB", speaker: "아트라", body: "시, 싫어요… 지우면… 연구원님을 아무도 기억 안 하잖아요.", standing: "atra", act: "recoil", nextId: "mir" },
    { id: "mir", speaker: "미르", body: "아트라, 열쇠 찾았으면 됐어요! 점수는 반만 주세요!", standing: "mir", cast: [{ id: "atra", slot: "left" }, { id: "mir", slot: "right" }], act: "hop" },
    { id: "ring", speaker: "", body: "두 그림자가 감방 사이 어둠으로 물러난다. 모사나는 빈 고리를 오래 들여다본다.", standing: "mosana", cast: [{ id: "mosana", slot: "center" }] },
  ]),
};

/** 5-8 SUB — 배식 통로. 국을 나르는 것은 라자, 마지막 그릇은 막내 몫이다. */
export const STAGE_5_8_YOUNGEST_SHARE: DialogueStory = {
  id: "stage-5-8-youngest-share",
  startNodeId: "tray",
  backdrop: "prisonField",
  nodes: linear([
    { id: "tray", speaker: "", body: "배식 통로 끝 모퉁이. 라자가 쟁반 하나에 국그릇을 다섯 개나 올린 채 한 칸씩 배식구에 밀어 넣고 있다.", standing: "raja", cast: [{ id: "raja", slot: "center" }] },
    { id: "dont", speaker: "라자", body: "…보지 마라. 배식 시간이다.", standing: "raja", act: "shrink" },
    { id: "burn", speaker: "마키", body: "그 국, 네가 끓인 거냥? 아니다냥. 손에 화상 자국이 없다냥. 끓인 사람은 따로 있다냥.", standing: "maki", cast: [{ id: "maki", slot: "left" }, { id: "raja", slot: "right" }], act: "lean" },
    { id: "carry", speaker: "라자", body: "…마가사다. 나는 나르기만 한다. 앞에 서는 쪽이 나르는 게 맞다.", standing: "raja", act: "nod" },
    { id: "last", speaker: "데이", body: "그럼 마지막 그릇은 누구 거야? 그 칸 비어 있는데!", standing: "deina", cast: [{ id: "deina", slot: "left" }, { id: "raja", slot: "right" }], act: "hop" },
    { id: "youngest", speaker: "라자", body: "막내 몫이다. 겁이 많아서 사람이 있으면 안 나온다. …그래서 늘 식은 걸 먹는다.", standing: "raja", act: "lean" },
    {
      id: "choose", speaker: "", body: "빈 배식구 앞에 그릇 하나가 놓인다. 김이 아직 오른다.", standing: "raja",
      choices: [
        { id: "step", label: "그릇을 두고 물러나 준다", nextId: "stepA", effect: { type: "bondXp", relicId: "deina", amount: 3 } },
        { id: "cover", label: "식지 않게 덮어 둔다", nextId: "coverB", effect: { type: "bondXp", relicId: "maki", amount: 3 } },
      ],
    },
    { id: "stepA", speaker: "데이", body: "알았어, 우리 저쪽 보고 있을게! 진짜로 안 볼게, 손가락 사이로도!", standing: "deina", cast: [{ id: "deina", slot: "left" }, { id: "raja", slot: "right" }], act: "nod", nextId: "rank" },
    { id: "coverB", speaker: "마키", body: "뚜껑을 덮어 두면 반 시간은 따뜻하다냥. 의사가 하는 말이니까 믿어라냥.", standing: "maki", cast: [{ id: "maki", slot: "left" }, { id: "raja", slot: "right" }], act: "nod", nextId: "rank" },
    { id: "rank", speaker: "라자", body: "…서열은 너희가 위다. 하루 더.", standing: "raja", act: "nod" },
    { id: "pull", speaker: "", body: "모퉁이를 돌아 나올 때 등 뒤에서 아주 작은 손톱 소리가 난다. 빈 칸의 그릇이 천천히 안쪽으로 끌려 들어간다.", standing: "raja", cast: [] },
  ]),
};

/** 6-4 전투 SUB 전 — 환기 수직갱. 라자가 분필로 새 줄을 긋는다. 서열은 그날그날 다시 정한다. */
export const STAGE_6_4_SIDE_PRE: DialogueStory = {
  id: "stage-6-4-side-pre",
  startNodeId: "line",
  backdrop: "prisonField",
  nodes: linear([
    { id: "line", speaker: "", body: "환기 수직갱 아래, 바람이 거꾸로 빨려 올라간다. 바닥에 분필로 새 줄이 그어져 있고, 그 줄 앞에 라자가 서 있다.", standing: "raja", cast: [{ id: "raja", slot: "left" }, { id: "pulsi", slot: "right" }] },
    { id: "daily", speaker: "라자", body: "서열은 그날그날 다시 정한다. 어제는 너희가 위였다. 오늘은 모른다.", standing: "raja", act: "nod" },
    { id: "fun", speaker: "펄시", body: "나는 서열 같은 거 몰라. 재밌어 보여서 따라왔을 뿐이야.", standing: "pulsi", act: "lean" },
    { id: "kento", speaker: "켄토", body: "담당관은 줄 뒤에 있어. 서열이든 뭐든 앞은 내가 받아.", standing: "kento", cast: [{ id: "kento", slot: "left" }, { id: "raja", slot: "center" }, { id: "pulsi", slot: "right" }], act: "nod" },
    { id: "wind", speaker: "스테라", body: "선배, 저 팔 쪽 바람이 무거워요. 첫 한 방이 제일 셀 거예요.", standing: "stella", cast: [{ id: "kento", slot: "left" }, { id: "stella", slot: "right" }], act: "lean" },
    { id: "cross", speaker: "라자", body: "덤벼. 줄을 넘는 쪽이 앞이다.", standing: "raja", cast: [{ id: "raja", slot: "left" }, { id: "pulsi", slot: "right" }], act: "rage", cue: "impact" },
  ]),
};

/** 6-4 전투 SUB 후 — 라자가 앞에 서는 이유. 켄토와 같은 이유다. */
export const STAGE_6_4_SIDE_POST: DialogueStory = {
  id: "stage-6-4-side-post",
  startNodeId: "smudge",
  backdrop: "prisonField",
  nodes: linear([
    { id: "smudge", speaker: "", body: "분필 줄이 발자국에 반쯤 지워졌다. 라자가 줄 뒤로 한 걸음 물러나 앉는다.", standing: "raja", cast: [{ id: "raja", slot: "left" }, { id: "kento", slot: "right" }] },
    { id: "today", speaker: "라자", body: "…오늘도 너희가 위다.", standing: "raja", act: "shrink" },
    { id: "again", speaker: "켄토", body: "몇 번이든 와. 줄은 매일 그어도 돼. 앞은 내가 설 거니까.", standing: "kento", act: "nod" },
    { id: "reason", speaker: "라자", body: "…앞에 서는 이유가 있나.", standing: "raja", act: "lean" },
    {
      id: "choose", speaker: "", body: "라자의 물음이 연구원 쪽으로 넘어온다.", standing: "raja",
      choices: [
        { id: "kento", label: "켄토에게 대답을 맡긴다", nextId: "kentoA", effect: { type: "bondXp", relicId: "kento", amount: 3 } },
        { id: "ask", label: "라자에게 되묻는다", nextId: "askB", effect: { type: "bondXp", relicId: "stella", amount: 3 } },
      ],
    },
    { id: "kentoA", speaker: "켄토", body: "뒤에 있는 사람이 안 다치니까. 그거면 충분해.", standing: "kento", act: "nod", nextId: "noa" },
    { id: "askB", speaker: "스테라", body: "선배가 물어봐요. 라자 씨는 왜 늘 앞에 서요?", standing: "stella", cast: [{ id: "stella", slot: "left" }, { id: "raja", slot: "right" }], act: "lean", nextId: "noa" },
    { id: "noa", speaker: "라자", body: "…앞이 버티면 노아가 안 나와도 된다. 겁 많은 애는 뒤에 있어야 한다.", standing: "raja", cast: [{ id: "raja", slot: "left" }, { id: "kento", slot: "right" }], act: "nod" },
    { id: "same", speaker: "라자", body: "같은 이유군. 내일 다시 그어 둔다.", standing: "raja" },
    { id: "up", speaker: "", body: "라자가 바람을 거슬러 수직갱 위로 올라간다. 위쪽 어딘가에서 작게 떨리는 숨소리가 그를 맞는다.", standing: "raja", cast: [] },
  ]),
};

/** 6-7 SUB — 무너진 면회실. 손톱자국은 노아가 같은 자리에서 기다린 흔적이다. */
export const STAGE_6_7_CLAW_MARKS: DialogueStory = {
  id: "stage-6-7-claw-marks",
  startNodeId: "chair",
  backdrop: "prisonField",
  nodes: linear([
    { id: "chair", speaker: "", body: "무너진 면회실. 손톱자국이 깊게 난 의자 밑에 작은 몸 하나가 웅크려 숨어 있다.", standing: "noa", cast: [{ id: "noa", slot: "center" }] },
    { id: "mine", speaker: "노아", body: "오, 오지 마… 여기 내 자리야. 마가사가 올 때까지 여기 있는 거야.", standing: "noa", act: "tremble" },
    { id: "marks", speaker: "케리스", body: "…선배, 손톱자국이요. 오래된 것부터 새것까지 겹겹이에요. 같은 자리에서 몇 번이고 기다린 자국이에요.", standing: "keris", cast: [{ id: "keris", slot: "left" }, { id: "noa", slot: "right" }], act: "lean" },
    { id: "comes", speaker: "노아", body: "마가사는 꼭 와. 늦어도 와. 그러니까 여기서 기다리면 돼. …무섭지 않아.", standing: "noa", act: "shrink" },
    { id: "wind", speaker: "스테라", body: "바람이 계속 떨려요, 선배. 무섭지 않다고 할 때 제일 많이 떨려요.", standing: "stella", cast: [{ id: "stella", slot: "left" }, { id: "noa", slot: "right" }], act: "lean" },
    {
      id: "choose", speaker: "", body: "의자 밑의 눈이 연구원의 발끝만 본다.", standing: "noa",
      choices: [
        { id: "sit", label: "옆에 조용히 앉는다", nextId: "sitA", effect: { type: "bondXp", relicId: "keris", amount: 3 } },
        { id: "wait", label: "마가사가 올 때까지만 같이 기다린다", nextId: "waitB", effect: { type: "bondXp", relicId: "stella", amount: 3 } },
      ],
    },
    { id: "sitA", speaker: "", body: "연구원이 의자 옆 바닥에 등을 대고 앉는다. 노아는 아무 말도 하지 않지만, 손톱이 의자를 긁는 소리가 멎는다.", standing: "noa", nextId: "pot" },
    { id: "waitB", speaker: "노아", body: "…마가사 올 때까지만이야. 그다음엔 오지 마.", standing: "noa", act: "nod", nextId: "pot" },
    { id: "pot", speaker: "", body: "통로 저편에서 냄비 뚜껑이 달그락거리는 소리가 가까워진다.", standing: "noa", cast: [{ id: "keris", slot: "left" }, { id: "noa", slot: "right" }] },
    { id: "go", speaker: "노아", body: "왔다…! 너, 너희는 가. 마가사가 보면 또 재료 얘기한단 말이야.", standing: "noa", act: "hop" },
    { id: "record", speaker: "케리스", body: "…기록했습니다, 선배. 이 의자는 다음에 지날 때도 부수지 않을게요.", standing: "keris", act: "nod" },
  ]),
};

/** 7-3 SUB — 침묵의 복도. 누군가 연구원보다 한 칸 앞서 벽의 번호를 지우며 간다. */
export const STAGE_7_3_MENDED_SLEEVE: DialogueStory = {
  id: "stage-7-3-mended-sleeve",
  startNodeId: "quiet",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "quiet", speaker: "", body: "침묵의 복도. 발소리가 바닥에 닿기도 전에 어둠이 먹어 버린다. 테리사가 걸음을 늦추고 연구원의 찢어진 소매를 끌어당긴다.", standing: "terisa", cast: [{ id: "terisa", slot: "left" }, { id: "nodonia", slot: "right" }] },
    { id: "sewn", speaker: "테리사", body: "…다 꿰맸어, 아가. 이번엔 안 풀려.", standing: "terisa", act: "nod" },
    { id: "count", speaker: "노도니아", body: "잘했어, 테리사. 아가, 팔 들어 보렴. 셋 셀 동안 안 아프면 된 거야.", standing: "nodonia", act: "lean" },
    { id: "wall", speaker: "안카", body: "연구원 씨… 저 앞 벽 좀 보세요. 긁힌 자국이요… 숫자를 지운 거예요.", standing: "anka", cast: [{ id: "anka", slot: "left" }, { id: "terisa", slot: "center" }, { id: "nodonia", slot: "right" }], act: "lean" },
    { id: "ahead", speaker: "", body: "벽마다 새겨진 번호 가운데 몇 개만 날카롭게 긁혀 있다. 자국은 아직 새것이고, 연구원의 걸음보다 꼭 한 칸씩 앞서 있다.", standing: "anka" },
    { id: "path", speaker: "노도니아", body: "앞에서 누가 길을 닦으며 가는구나. 아가가 지나갈 길에서 번호만 골라서.", standing: "nodonia", act: "nod" },
    { id: "shadow", speaker: "테리사", body: "…가리개 쓴 애야. 아까 그림자 봤어.", standing: "terisa" },
    {
      id: "choose", speaker: "", body: "복도 저편에서 쇠를 긁는 소리가 한 번 더 난다.", standing: "terisa",
      choices: [
        { id: "catch", label: "따라잡아 말을 건다", nextId: "catchA", effect: { type: "bondXp", relicId: "nodonia", amount: 3 } },
        { id: "follow", label: "모른 척 뒤따라간다", nextId: "followB", effect: { type: "bondXp", relicId: "terisa", amount: 3 } },
      ],
    },
    { id: "catchA", speaker: "노도니아", body: "안 돼, 아가. 쫓으면 숨는 애야. 그 애가 닦아 둔 길로만 걷자꾸나.", standing: "nodonia", act: "shake", nextId: "hush" },
    { id: "followB", speaker: "테리사", body: "…응. 그게 나아. 저 애도 들키기 싫어해.", standing: "terisa", act: "nod", nextId: "hush" },
    { id: "hush", speaker: "안카", body: "그럼 조용히 걸어요, 연구원 씨… 그 애 발소리까지 깨우지 않게요.", standing: "anka", act: "nod" },
    { id: "last", speaker: "", body: "복도 끝에서 마지막 번호 하나가 긁혀 나간다. 「072」였던 자리다.", standing: "anka", cast: [] },
  ]),
};

/** 7-6 전투 SUB 전 — 얼어붙은 기록실. 회수조가 냉동 수용실의 기록을 쓸어 담는다. */
export const STAGE_7_6_SIDE_PRE: DialogueStory = {
  id: "stage-7-6-side-pre",
  startNodeId: "drawers",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "drawers", speaker: "", body: "얼어붙은 기록실. 네우리가 성에 낀 서랍을 하나씩 빼내 자루에 쏟아붓는다. 아트라가 그 곁에서 머뭇거린다.", standing: "neuri", cast: [{ id: "atra", slot: "left" }, { id: "neuri", slot: "right" }] },
    { id: "order", speaker: "네우리", body: "간부님 말씀이에요. 냉동 수용실 기록은 전부 회수. 남겨 두면 위에서 곤란해하신대요.", standing: "neuri", act: "nod" },
    { id: "faces", speaker: "메론", body: "저, 저기요… 그 서랍, 얼굴 사진 들어 있는 거죠…? 아직 다 못 그렸는데요…?", standing: "meron", cast: [{ id: "meron", slot: "left" }, { id: "maddy", slot: "right" }], act: "shrink" },
    { id: "cold", speaker: "매디", body: "연구원 씨, 파워 냉방은 제 전문이에요. 저 자루째 얼려서 못 가져가게 할게요!", standing: "maddy", act: "bounce" },
    { id: "names", speaker: "아트라", body: "네, 네우리… 이건 그냥 두면 안 될까요… 이, 이름이 적혀 있는데…", standing: "atra", cast: [{ id: "atra", slot: "left" }, { id: "neuri", slot: "right" }], act: "tremble" },
    { id: "erase", speaker: "네우리", body: "어머, 아트라. 이름은 회수조가 제일 잘 지우잖아요. 자, 연구원님부터 정중히.", standing: "neuri", act: "lean", cue: "impact" },
  ]),
};

/** 7-6 전투 SUB 후 — 지켜 낸 얼굴들. 아트라가 몰래 빼 둔 이름표 하나를 내놓는다. */
export const STAGE_7_6_SIDE_POST: DialogueStory = {
  id: "stage-7-6-side-post",
  startNodeId: "burst",
  backdrop: "thirdBranchField",
  nodes: linear([
    { id: "burst", speaker: "", body: "자루가 터져 얼어붙은 종이가 바닥에 흩어진다. 메론이 무릎을 꿇고 한 장씩 주워 품에 안는다.", standing: "meron", cast: [{ id: "meron", slot: "left" }, { id: "maddy", slot: "right" }] },
    { id: "safe", speaker: "메론", body: "…다행이에요. 얼굴이 다 남아 있어요. 이름도요.", standing: "meron", act: "nod" },
    { id: "fridge", speaker: "매디", body: "녹지 않게 계속 차갑게 해 둘게요, 연구원 씨. 이게 냉장고가 해야 할 진짜 일이에요.", standing: "maddy", act: "nod" },
    { id: "tag", speaker: "", body: "아트라가 소매 속에서 성에 낀 이름표 하나를 꺼내 메론 앞에 조심스럽게 내려놓는다.", standing: "atra", cast: [{ id: "atra", slot: "left" }, { id: "meron", slot: "right" }] },
    { id: "kept", speaker: "아트라", body: "이, 이것도요… 아까 몰래 빼 뒀어요. 이, 이름은 지우면 안 돼요. 제 목록도… 그래서 있는 거예요.", standing: "atra", act: "shrink" },
    {
      id: "choose", speaker: "", body: "아트라가 소매 뒤로 다시 얼굴을 반쯤 숨긴다.", standing: "atra",
      choices: [
        { id: "thanks", label: "고맙다고 말한다", nextId: "thanksA", effect: { type: "bondXp", relicId: "meron", amount: 3 } },
        { id: "ask", label: "목록 이야기를 더 묻는다", nextId: "askB", effect: { type: "bondXp", relicId: "maddy", amount: 3 } },
      ],
    },
    { id: "thanksA", speaker: "아트라", body: "고, 고맙다는 말은… 목록에 적는 사람한테 하는 게 아닌데요…", standing: "atra", act: "recoil", nextId: "neuri" },
    { id: "askB", speaker: "아트라", body: "…아무도 안 적어 주면, 없었던 게 돼요. 그, 그래서 제가 적어요. 마음에 드는 사람부터…", standing: "atra", act: "lean", nextId: "neuri" },
    { id: "neuri", speaker: "네우리", body: "아트라, 가요. 간부님께는 「기록 손상」이라고 올릴게요. …얼었으니까 거짓말은 아니죠.", standing: "neuri", cast: [{ id: "atra", slot: "left" }, { id: "neuri", slot: "right" }], act: "lean" },
    { id: "draw", speaker: "메론", body: "…이 얼굴들이랑, 아트라 씨 얼굴도 같이 그려 둘게요.", standing: "meron", cast: [{ id: "meron", slot: "center" }], act: "nod" },
  ]),
};

export const SUB_STORIES: readonly DialogueStory[] = [
  STAGE_1_8_SIDE_PRE, STAGE_1_8_SIDE_POST, STAGE_2_3_LOST_BADGE, STAGE_2_4_SIDE_PRE, STAGE_2_4_SIDE_POST, STAGE_2_6_SAME_LINE, STAGE_2_9_SECOND_CHASE,
  STAGE_3_3_SIDE_PRE, STAGE_3_3_SIDE_POST, STAGE_3_5_BEHIND_SLEEVE, STAGE_3_8_APOLOGY,
  STAGE_4_3_BREAK_TIME, STAGE_4_7_SIDE_PRE, STAGE_4_7_SIDE_POST,
  STAGE_5_2_SIDE_PRE, STAGE_5_2_SIDE_POST, STAGE_5_8_YOUNGEST_SHARE,
  STAGE_6_4_SIDE_PRE, STAGE_6_4_SIDE_POST, STAGE_6_7_CLAW_MARKS,
  STAGE_7_3_MENDED_SLEEVE, STAGE_7_6_SIDE_PRE, STAGE_7_6_SIDE_POST,
];
