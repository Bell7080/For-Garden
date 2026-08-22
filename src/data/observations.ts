import type { DialogueStory } from "../core/dialogue";

/** 선택지는 성격 단서와 습성 문장만 연다. 전투 보정 명령은 의도적으로 넣지 않는다. */
export interface ObservationChoice { id: string; label: string; personalityTag: string; habitKey: string; }
export interface ObservationQuestion { id: string; prompt: string; choices: readonly ObservationChoice[]; }

/** 캐릭터가 늘어도 질문 원문을 복제하지 않도록 유지하는 공용 질문 풀이다. */
export const OBSERVATION_QUESTIONS: readonly ObservationQuestion[] = [
  { id: "unknown-sound", prompt: "낯선 소리가 들리면 어떻게 할 거야?", choices: [
    { id: "approach", label: "소리가 난 곳을 먼저 살핀다", personalityTag: "호기심", habitKey: "approach" },
    { id: "wait", label: "안전한 곳에서 한동안 기다린다", personalityTag: "신중함", habitKey: "wait" },
  ] },
  { id: "shared-food", prompt: "먹이를 동료와 나눠야 한다면?", choices: [
    { id: "share", label: "먼저 동료의 몫을 남긴다", personalityTag: "배려", habitKey: "share" },
    { id: "guard", label: "주변을 지키며 차례를 정한다", personalityTag: "질서", habitKey: "guard" },
  ] },
] as const;

/** 렐릭별 제작분은 짧은 반응과 발견 문장뿐이며, 공용 질문과 조합해 스토리를 만든다. */
const REACTIONS: Readonly<Record<string, { intro: string; replies: Readonly<Record<string, string>>; habits: Readonly<Record<string, string>> }>> = {
  anky: { intro: "천천히 물어봐. 생각해 볼게.", replies: { approach: "뿔을 낮추고 가까이 가 볼래.", wait: "발밑의 떨림부터 확인할래.", share: "어린 개체가 먼저 먹어야 해.", guard: "내가 바깥쪽을 지킬게." }, habits: { approach: "낯선 진동을 앞발로 두 번 확인한다.", wait: "위험을 느끼면 무리의 바깥을 향해 선다.", share: "먹이 가운데 부드러운 잎을 어린 개체에게 남긴다.", guard: "식사 중에도 일정한 간격으로 고개를 들어 경계한다." } },
  rex: { intro: "관찰이라니, 재미있는 걸 묻네.", replies: { approach: "숨기 전에 내가 찾아내지.", wait: "바람이 냄새를 가져올 때까지 기다려.", share: "내 무리라면 굶기지 않아.", guard: "강한 순서가 아니라 필요한 순서로 먹어." }, habits: { approach: "소리보다 바람에 실린 냄새를 먼저 좇는다.", wait: "사냥 전 몸을 낮추고 풍향이 바뀌기를 기다린다.", share: "무리의 먹이가 부족하면 자신의 몫을 뒤로 미룬다.", guard: "먹이 주변을 한 바퀴 돈 뒤에야 식사를 시작한다." } },
  spino: { intro: "물소리처럼 편하게 물어봐.", replies: { approach: "물결이 어디서 갈라지는지 볼 거야.", wait: "조용해질 때까지 물속에서 기다릴래.", share: "큰 물고기는 나누면 돼.", guard: "물가부터 안전한지 살필게." }, habits: { approach: "수면의 파문 방향으로 주둥이를 천천히 돌린다.", wait: "경계할 때 콧구멍만 수면 위로 내놓는다.", share: "큰 먹이를 물가로 옮긴 뒤 작은 조각부터 떼어 준다.", guard: "먹기 전 얕은 물을 꼬리로 저어 주변을 확인한다." } },
};

/** UTC 날짜가 같은 모든 화면에서 동일한 질문을 고르도록 순수 결정 규칙을 쓴다. */
export function observationQuestionForDate(utcDate: string): ObservationQuestion {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(utcDate)) throw new RangeError("관찰 인터뷰 날짜가 올바르지 않습니다.");
  const index = [...utcDate].reduce((sum, char) => sum + char.charCodeAt(0), 0) % OBSERVATION_QUESTIONS.length;
  return OBSERVATION_QUESTIONS[index];
}

/** 기존 DialogueStory 실행기가 그대로 읽을 수 있는 일일 인터뷰를 데이터 조합으로 만든다. */
export function createObservationStory(relicId: string, relicName: string, utcDate: string): DialogueStory {
  const question = observationQuestionForDate(utcDate);
  const reaction = REACTIONS[relicId] ?? { intro: "무엇이 궁금한지 말해 줘.", replies: {}, habits: {} };
  return { id: `observation.${utcDate}.${relicId}`, startNodeId: "intro", nodes: [
    { id: "intro", speaker: relicName, body: reaction.intro, nextId: "question" },
    { id: "question", speaker: "연구원", body: question.prompt, choices: question.choices.map((choice) => ({ id: choice.id, label: choice.label, nextId: `reply-${choice.id}` })) },
    ...question.choices.map((choice) => ({ id: `reply-${choice.id}`, speaker: relicName, body: reaction.replies[choice.id] ?? choice.label })),
  ] };
}

/** 저장할 선택 결과를 정적 데이터에서 다시 찾아 클라이언트 임의 문구 주입을 막는다. */
export function observationDiscovery(relicId: string, utcDate: string, choiceId: string): { question: ObservationQuestion; choice: ObservationChoice; habit: string } {
  const question = observationQuestionForDate(utcDate);
  const choice = question.choices.find(({ id }) => id === choiceId);
  if (!choice) throw new RangeError("현재 관찰 질문에 없는 답변입니다.");
  return { question, choice, habit: REACTIONS[relicId]?.habits[choice.habitKey] ?? "새로운 반응 양식을 기록했다." };
}
