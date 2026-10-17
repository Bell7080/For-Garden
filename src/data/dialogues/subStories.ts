import type { DialogueCastMember, DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * **서브 이야기 — 2장 코마 추적 / 3장 곁가지.**
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
        { id: "chase", label: "돌려받으러 쫓아간다", nextId: "plunge", effect: { type: "bondXp", relicId: "dodi", amount: 3 } },
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
    { id: "what", speaker: "렉시아", body: "줄이라니, 무슨 줄이냐. 설명하라!", standing: "lexia", act: "hop" },
    { id: "count", speaker: "코마", body: "위에서는 번호로 센다. 나도, 당신도.", standing: "koma", act: "nod" },
    {
      id: "choose", speaker: "", body: "연구원이 한 걸음 다가선다.", standing: "koma",
      choices: [
        { id: "return", label: "돌려 달라", nextId: "returnA", effect: { type: "bondXp", relicId: "lexia", amount: 3 } },
        { id: "okay", label: "괜찮아?", nextId: "okayB", effect: { type: "bondXp", relicId: "lexia", amount: 3 } },
      ],
    },
    { id: "returnA", speaker: "코마", body: "…아직이다. 확인이 끝나면 돌려준다.", standing: "koma", act: "recoil", nextId: "tail" },
    { id: "okayB", speaker: "코마", body: "…그 질문, 위에서는 없었다. 아직이다. 확인이 끝나면 돌려준다.", standing: "koma", act: "recoil", nextId: "tail" },
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
  backdrop: "battlefield",
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
  backdrop: "battlefield",
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

export const SUB_STORIES: readonly DialogueStory[] = [
  STAGE_2_3_LOST_BADGE, STAGE_2_6_SAME_LINE, STAGE_2_9_SECOND_CHASE, STAGE_3_5_BEHIND_SLEEVE, STAGE_3_8_APOLOGY,
];
