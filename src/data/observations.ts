import type { DialogueStory } from "../core/dialogue";

/** 선택지는 성격 단서와 습성 문장만 열며, 서로 다른 선택을 같은 미화 표현으로 합치지 않는다. */
export interface ObservationChoice { id: string; label: string; personalityTag: string; habitKey: string; }
export interface ObservationQuestion { id: string; prompt: string; choices: readonly ObservationChoice[]; }

/** 기존 저장과 재관람이 참조하는 ID를 보존한 공용 질문 풀이다. */
export const COMMON_OBSERVATION_QUESTIONS: readonly ObservationQuestion[] = [
  { id: "unknown-sound", prompt: "낯선 소리가 들리면 어떻게 할 거야?", choices: [
    { id: "approach", label: "소리가 난 곳을 먼저 살핀다", personalityTag: "호기심", habitKey: "approach" },
    { id: "wait", label: "안전한 곳에서 한동안 기다린다", personalityTag: "신중함", habitKey: "wait" },
  ] },
  { id: "shared-food", prompt: "먹이를 동료와 나눠야 한다면?", choices: [
    { id: "share", label: "먼저 동료의 몫을 남긴다", personalityTag: "배려", habitKey: "share" },
    { id: "guard", label: "주변을 지키며 차례를 정한다", personalityTag: "질서", habitKey: "guard" },
  ] },
] as const;

/** 토리카의 식욕·부끄러움·용기를 답으로 단정하지 않고, 해당 상황의 반응으로 관찰한다. */
export const RELIC_OBSERVATION_QUESTIONS: Readonly<Record<string, readonly ObservationQuestion[]>> = {
  anky: [
    { id: "anky-meal-appetite", prompt: "평소 먹는 양과 좋아하는 먹이를 물으면 어떤 반응을 보여?", choices: [
      { id: "anky-meal-eager", label: "좋아하는 먹이부터 신나게 이야기한다", personalityTag: "왕성한 식욕", habitKey: "ankyMealEager" },
      { id: "anky-meal-share", label: "동료들이 먹을 몫부터 헤아린다", personalityTag: "동료 배려", habitKey: "ankyMealShare" },
      { id: "anky-meal-shy", label: "먹은 양은 작게 말하고 좋아하는 잎만 알려 준다", personalityTag: "쑥스러움", habitKey: "ankyMealShy" },
    ] },
    // 몸무게 화제에서 볏이 붉어진다는 기존 관찰 기록을 서로 다른 대처 방식으로 이어 간다.
    { id: "anky-weight-reaction", prompt: "몸무게 이야기가 나오면 토리카는 어떻게 반응해?", choices: [
      { id: "anky-weight-honest", label: "붉어진 채로 지금 수치를 또박또박 말한다", personalityTag: "솔직함", habitKey: "ankyWeightHonest" },
      { id: "anky-weight-deflect", label: "볏을 가리며 얼른 다른 이야기를 꺼낸다", personalityTag: "쑥스러움", habitKey: "ankyWeightDeflect" },
    ] },
    // 한 걸음 물러나도 앞을 막는 설정에서 두려움의 인정과 보호 행동을 각각 관찰한다.
    { id: "anky-frightened-shield", prompt: "겁이 나는데도 누군가의 앞을 막아서야 할 때 어떤 반응을 보여?", choices: [
      { id: "anky-shield-admit", label: "무섭다고 말한 뒤 한 걸음 물러서 자리를 지킨다", personalityTag: "두려움 인정", habitKey: "ankyShieldAdmit" },
      { id: "anky-shield-protect", label: "떨리는 다리를 버티며 상대의 앞을 가로막는다", personalityTag: "보호본능", habitKey: "ankyShieldProtect" },
    ] },
  ],
};

interface ObservationReaction { intro: string; replies: Readonly<Record<string, string>>; habits: Readonly<Record<string, string>>; }

/** 대답과 일지 문장을 한 반응표에 묶어 캐릭터 설정과 저장 결과가 어긋나지 않게 한다. */
export const REACTIONS: Readonly<Record<string, ObservationReaction>> = {
  anky: { intro: "천천히 물어봐. 생각해 볼게.", replies: {
    approach: "뿔을 낮추고 가까이 가 볼래.", wait: "발밑의 떨림부터 확인할래.", share: "어린 개체가 먼저 먹어야 해.", guard: "내가 바깥쪽을 지킬게.",
    "anky-meal-eager": "많이 먹어! 아삭한 어린 잎이 제일 좋아.", "anky-meal-share": "내 몫은 커도 돼. 하지만 다들 먹을 건 남겨 둘래.", "anky-meal-shy": "조금... 아니, 보통만큼 먹어. 어린 잎은 좋아해.",
    "anky-weight-honest": "볏이 뜨거워도 말할 수 있어. 지금 몸무게는 기록대로야.", "anky-weight-deflect": "그, 그보다 오늘 잎 상태가 정말 좋지 않아?",
    "anky-shield-admit": "무서워. 그래도 한 걸음만 물러서서 여기 있을래.", "anky-shield-protect": "내 뒤에 있어. 다리가 떨려도 길은 안 비킬 거야.",
  }, habits: {
    approach: "낯선 진동을 앞발로 두 번 확인한다.", wait: "위험을 느끼면 무리의 바깥을 향해 선다.", share: "먹이 가운데 부드러운 잎을 어린 개체에게 남긴다.", guard: "식사 중에도 일정한 간격으로 고개를 들어 경계한다.",
    ankyMealEager: "식사량을 숨기지 않고 아삭한 어린 잎을 가장 먼저 찾는다.", ankyMealShare: "먹고 싶은 양이 많아도 동료의 몫을 먼저 따로 둔다.", ankyMealShy: "식사량을 작게 말할 때도 좋아하는 어린 잎은 빠뜨리지 않는다.",
    ankyWeightHonest: "몸무게를 말할 때 볏 끝까지 붉어지지만 수치는 또박또박 확인한다.", ankyWeightDeflect: "몸무게가 언급되면 볏 끝까지 붉어진 채 먹이 이야기로 화제를 돌린다.",
    ankyShieldAdmit: "겁이 난다고 인정하고 한 걸음 물러서지만 보호할 대상의 앞은 비우지 않는다.", ankyShieldProtect: "다리가 떨려도 몸을 낮춰 보호할 대상의 앞을 막아선다.",
  } },
  rex: { intro: "관찰이라니, 재미있는 걸 묻네.", replies: { approach: "숨기 전에 내가 찾아내지.", wait: "바람이 냄새를 가져올 때까지 기다려.", share: "내 무리라면 굶기지 않아.", guard: "강한 순서가 아니라 필요한 순서로 먹어." }, habits: { approach: "소리보다 바람에 실린 냄새를 먼저 좇는다.", wait: "사냥 전 몸을 낮추고 풍향이 바뀌기를 기다린다.", share: "무리의 먹이가 부족하면 자신의 몫을 뒤로 미룬다.", guard: "먹이 주변을 한 바퀴 돈 뒤에야 식사를 시작한다." } },
  spino: { intro: "물소리처럼 편하게 물어봐.", replies: { approach: "물결이 어디서 갈라지는지 볼 거야.", wait: "조용해질 때까지 물속에서 기다릴래.", share: "큰 물고기는 나누면 돼.", guard: "물가부터 안전한지 살필게." }, habits: { approach: "수면의 파문 방향으로 주둥이를 천천히 돌린다.", wait: "경계할 때 콧구멍만 수면 위로 내놓는다.", share: "큰 먹이를 물가로 옮긴 뒤 작은 조각부터 떼어 준다.", guard: "먹기 전 얕은 물을 꼬리로 저어 주변을 확인한다." } },
};

/** 날짜 문자열을 UTC 일수로 바꿔 시간대와 런타임에 무관한 순환 기준을 만든다. */
function utcDayNumber(utcDate: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(utcDate)) throw new RangeError("관찰 인터뷰 날짜가 올바르지 않습니다.");
  const timestamp = Date.parse(`${utcDate}T00:00:00Z`);
  if (!Number.isFinite(timestamp) || new Date(timestamp).toISOString().slice(0, 10) !== utcDate) throw new RangeError("관찰 인터뷰 날짜가 올바르지 않습니다.");
  return Math.floor(timestamp / 86_400_000);
}

/** 과거 호출부와 공용 질문 결정 규칙을 보존한다. */
export function observationQuestionForDate(utcDate: string): ObservationQuestion {
  utcDayNumber(utcDate);
  const index = [...utcDate].reduce((sum, char) => sum + char.charCodeAt(0), 0) % COMMON_OBSERVATION_QUESTIONS.length;
  return COMMON_OBSERVATION_QUESTIONS[index];
}

/** 같은 렐릭·UTC 날짜의 단일 질문 원천이며, 전용 풀이 있는 렐릭은 이틀마다 전용 질문을 순환한다. */
export function observationQuestionForRelicAndDate(relicId: string, utcDate: string): ObservationQuestion {
  const day = utcDayNumber(utcDate);
  const relicQuestions = RELIC_OBSERVATION_QUESTIONS[relicId];
  if (!relicQuestions?.length || day % 2 !== 0) return observationQuestionForDate(utcDate);
  return relicQuestions[Math.floor(day / 2) % relicQuestions.length];
}

/** 기존 DialogueStory 실행기가 읽는 일일 인터뷰도 렐릭별 단일 선택 함수를 사용한다. */
export function createObservationStory(relicId: string, relicName: string, utcDate: string): DialogueStory {
  const question = observationQuestionForRelicAndDate(relicId, utcDate);
  const reaction = REACTIONS[relicId] ?? { intro: "무엇이 궁금한지 말해 줘.", replies: {}, habits: {} };
  return { id: `observation.${utcDate}.${relicId}`, startNodeId: "intro", nodes: [
    { id: "intro", speaker: relicName, body: reaction.intro, nextId: "question" },
    { id: "question", speaker: "연구원", body: question.prompt, choices: question.choices.map((choice) => ({ id: choice.id, label: choice.label, nextId: `reply-${choice.id}` })) },
    ...question.choices.map((choice) => ({ id: `reply-${choice.id}`, speaker: relicName, body: reaction.replies[choice.id] ?? choice.label })),
  ] };
}

/** 표시 때와 같은 질문을 재선택해 저장 직전 선택지와 습성 문장을 검증한다. */
export function observationDiscovery(relicId: string, utcDate: string, choiceId: string): { question: ObservationQuestion; choice: ObservationChoice; habit: string } {
  const question = observationQuestionForRelicAndDate(relicId, utcDate);
  const choice = question.choices.find(({ id }) => id === choiceId);
  if (!choice) throw new RangeError("현재 관찰 질문에 없는 답변입니다.");
  return { question, choice, habit: REACTIONS[relicId]?.habits[choice.habitKey] ?? "새로운 반응 양식을 기록했다." };
}
