import type { DialogueStory } from "../../core/dialogue";
import { linear } from "./linear";

/*
 * 1-5 뒤에 선택해서 읽는 짧은 기록. 본편 전투 진행과 보상을 분리한다.
 * 1-5 근방은 토비가 혼자 먼저 달려와 장비를 뜯어 놓은 직후라, 온실에서 벌어지는 가벼운 소동으로 꾸린다.
 * 번역을 등록하지 않는 서브 이야기라 한국어 원문이 그대로 쓰인다.
 */

const TRIO = [{ id: "torika", slot: "left" }, { id: "toby", slot: "center" }, { id: "dodi", slot: "right" }] as const;

export const GREENHOUSE_ECHO: DialogueStory = {
  id: "stage-1-5-greenhouse-echo",
  startNodeId: "hide",
  backdrop: "battlefield",
  nodes: linear([
    { id: "hide", speaker: "토비", body: "쉿! 조용히 해! 지금 온실에 숨어 있는 거야. 아까 장치 일은… 우리끼리 비밀로 하자!", standing: "toby", cast: TRIO, act: "shrink" },
    { id: "dodi", speaker: "도디", body: "숨을 거면 쿵쿵거리는 발소리부터 줄이는 게 좋을 것 같아요. 잎사귀가 다 흔들려요!", standing: "dodi", act: "hop" },
    { id: "pumpkin", speaker: "토비", body: "그런 건 상관없어. 그보다 저기 덩치 큰 놈 좀 봐. 저건 분명 숨어 있는 적이야!", standing: "toby", act: "puff" },
    { id: "calm", speaker: "토리카", body: "대장님, 그거 호박이에요. 이 온실 관리자가 키우던 거대 호박요.", standing: "torika", act: "lean" },
    { id: "charge", speaker: "토비", body: "호박이든 뭐든 선수필승이다! 내 박치기를 받아라!", standing: "toby", act: "rage", cue: "impact" },
    { id: "splat", speaker: "", body: "쾅! 거대 호박이 터지며 속살이 사방으로 튄다. 셋 모두 온몸이 주황색 범벅이 되었다.", standing: "dodi", act: "squash" },
    { id: "wet", speaker: "도디", body: "…기록할게요. 방금 소리는 \"퍽\"이 아니라 \"푸슈욱\"이었어요.", standing: "dodi", act: "tremble" },
    { id: "sticky", speaker: "토리카", body: "으… 끈적끈적해. 이거 스프링클러 켜면 씻길 것 같은데, 스위치가 어디 있지?", standing: "torika", act: "shake" },
    { id: "switch", speaker: "토비", body: "아, 그거라면 알아! 아까 내가 눌렀던 그 \"삐—\" 하던 버튼이야!", standing: "toby", act: "bounce" },
    { id: "beep", speaker: "도디", body: "그 버튼이면…", standing: "dodi", act: "fright" },
    { id: "rain", speaker: "", body: "온실 천장에서 요란하게 물이 쏟아진다. 호박 범벅이던 셋은 졸지에 물세례를 받고, 이번에는 물에 젖은 생쥐 꼴이 되었다.", standing: "torika", act: "recoil" },
    { id: "end", speaker: "토비", body: "자, 봐! 깨끗해졌잖아! 결과만 좋으면 되는 거야!", standing: "toby", act: "hopTwice" },
    { id: "fine", speaker: "토리카", body: "…호박 값은 연구원님이 아니라 대장님 월급에서 빼 달라고 보고서에 쓸게요.", standing: "torika", act: "nod" },
  ]),
};
