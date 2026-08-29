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

/** 렐릭별 질문은 설정을 답으로 단정하지 않고, 구체적인 상황에서 드러나는 반응으로 검증한다. */
export const RELIC_OBSERVATION_QUESTIONS: Readonly<Record<string, readonly ObservationQuestion[]>> = {
  anky: [
    // 먹이 화제에서 토리카의 왕성한 식욕과 동료 배려, 부끄러움 중 어느 면이 앞서는지 검증한다.
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
  rex: [
    // 큰 상대를 마주한 렉시아가 격식을 지키는 경쟁심과 체격 자체의 승부욕 중 어느 쪽을 보이는지 검증한다.
    { id: "rex-size-rivalry", prompt: "자신보다 훨씬 큰 상대가 앞을 막으면 어떻게 반응해?", choices: [
      { id: "rex-size-formal", label: "자세를 곧게 세우고 먼저 정식으로 승부를 청한다", personalityTag: "격식 있는 경쟁심", habitKey: "rexSizeFormal" },
      { id: "rex-size-wrestle", label: "체격 차이를 지적하자 곧바로 힘겨루기를 요구한다", personalityTag: "체격 승부욕", habitKey: "rexSizeWrestle" },
    ] },
    // 압도적인 강자 앞에서 공정한 조건을 중시하는지, 강자와 즉시 겨루고 싶어 하는지 검증한다.
    { id: "rex-strong-challenge", prompt: "압도적으로 강한 상대를 발견하면 어떻게 할 거야?", choices: [
      { id: "rex-strong-fair", label: "상대의 장점을 살핀 뒤 같은 조건으로 겨룬다", personalityTag: "공정한 도전", habitKey: "rexStrongFair" },
      { id: "rex-strong-eager", label: "눈을 빛내며 당장 어느 쪽이 강한지 확인하려 한다", personalityTag: "강자 선호", habitKey: "rexStrongEager" },
    ] },
    // 작은 렐릭의 실수 앞에서 에티켓을 가르치면서도 약자를 위압하지 않는 배려 방식을 검증한다.
    { id: "rex-small-etiquette", prompt: "작은 렐릭이 실수로 예절을 지키지 못하면?", choices: [
      { id: "rex-small-guide", label: "먼저 자세를 낮추고 천천히 올바른 인사법을 알려 준다", personalityTag: "온화한 지도", habitKey: "rexSmallGuide" },
      { id: "rex-small-example", label: "자신이 먼저 정중히 인사해 따라 할 수 있게 기다린다", personalityTag: "솔선하는 예절", habitKey: "rexSmallExample" },
    ] },
  ],
  spino: [
    // 동시에 울린 경보 앞에서 스피나의 임무 집중과 과묵한 현장 지휘가 각각 어떻게 드러나는지 관찰한다.
    { id: "spino-night-alarm", prompt: "야간 순찰 중 수조 경보와 다른 구역의 구조 요청이 동시에 들어오면?", choices: [
      { id: "spino-alarm-rescue", label: "구조 요청 위치를 짧게 보고하고 즉시 현장으로 향한다", personalityTag: "임무 우선", habitKey: "spinoAlarmRescue" },
      { id: "spino-alarm-command", label: "가까운 경비대원에게 수조 점검을 맡기고 구조 동선을 확보한다", personalityTag: "침착한 지휘", habitKey: "spinoAlarmCommand" },
    ] },
    // 연구원만 이미 아는 어항 장식 취미를 숨기려는 시치미와 물고기를 향한 다정함으로 나누어 관찰한다.
    { id: "spino-aquarium-decoration", prompt: "연구원이 어항 속에 새로 놓인 장식을 알아보면?", choices: [
      { id: "spino-decoration-deny", label: "원래 있던 것이라며 시선을 피하고 장식 각도만 바로잡는다", personalityTag: "서투른 시치미", habitKey: "spinoDecorationDeny" },
      { id: "spino-decoration-shelter", label: "물고기의 은신처가 필요했을 뿐이라고 짧게 설명한다", personalityTag: "숨겨 둔 다정함", habitKey: "spinoDecorationShelter" },
    ] },
    // 함께하는 청소에서도 취미가 들키지 않았다고 믿는 스피나의 신뢰와 실무적인 배려를 행동으로 관찰한다.
    { id: "spino-aquarium-cleaning", prompt: "익숙하지 않은 어항 청소를 연구원이 도와주겠다고 하면?", choices: [
      { id: "spino-cleaning-gloves", label: "거절하려다 여분의 장갑을 조용히 건넨다", personalityTag: "말없는 신뢰", habitKey: "spinoCleaningGloves" },
      { id: "spino-cleaning-roles", label: "자신이 수초를 맡겠다며 역할을 정확히 나눈다", personalityTag: "실무적인 배려", habitKey: "spinoCleaningRoles" },
    ] },
  ],
  luka: [
    // 소파에서 먼저 말을 건 뒤 루카가 침묵과 대화 중 어느 방식으로 연구원과 휴식을 나누는지 관찰한다.
    { id: "luka-sofa-conversation", prompt: "연구소 소파에 누운 루카에게 연구원이 말을 걸면 어떻게 반응해?", choices: [
      { id: "luka-sofa-silence", label: "자리를 내어 주고 나란히 편한 침묵을 즐긴다", personalityTag: "느긋한 친밀감", habitKey: "lukaSofaSilence" },
      { id: "luka-sofa-chat", label: "소파에 누운 채 새로운 이야깃거리를 계속 꺼낸다", personalityTag: "수다스러운 호의", habitKey: "lukaSofaChat" },
    ] },
    // 육식 계열 렐릭과의 단거리 달리기에서 기록 경쟁과 상대를 향한 배려가 행동으로 갈리는 순간을 관찰한다.
    { id: "luka-sprint-rival", prompt: "다른 육식 계열 렐릭과 단거리 출발선에 서면 어떻게 달려?", choices: [
      { id: "luka-sprint-compete", label: "출발 신호와 함께 기록을 노리며 전력으로 치고 나간다", personalityTag: "정면 승부욕", habitKey: "lukaSprintCompete" },
      { id: "luka-sprint-pace", label: "옆 주자의 보폭을 살피며 나란히 결승선을 향한다", personalityTag: "보폭을 맞추는 배려", habitKey: "lukaSprintPace" },
    ] },
    // 치즈케이크 뒤의 걱정을 즉시 훈련으로 잇는지, 즐거움을 한 조각 더 누린 뒤 미루는지 관찰한다.
    { id: "luka-cheesecake-weight", prompt: "치즈케이크를 먹은 루카가 몸무게를 걱정하기 시작하면 어떻게 해?", choices: [
      { id: "luka-cake-training", label: "남은 접시를 치우고 다음 단거리 훈련 계획을 적는다", personalityTag: "계획적인 자기관리", habitKey: "lukaCakeTraining" },
      { id: "luka-cake-more", label: "한 조각만 더 접시에 놓고 고민은 식사 뒤로 미룬다", personalityTag: "현재를 즐기는 낙천성", habitKey: "lukaCakeMore" },
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
  // 경쟁심·강자 선호에는 정중한 승부 절차를, 에티켓·약자 배려에는 위압하지 않는 태도를 대응시킨다.
  rex: { intro: "관찰이라니, 재미있는 걸 묻네.", replies: {
    approach: "숨기 전에 내가 찾아내지.", wait: "바람이 냄새를 가져올 때까지 기다려.", share: "내 무리라면 굶기지 않아.", guard: "강한 순서가 아니라 필요한 순서로 먹어.",
    "rex-size-formal": "훌륭한 체격이군. 이름을 밝히고 정식으로 한 판 청하겠어.", "rex-size-wrestle": "그 체격이 얼마나 대단한지, 괜찮다면 힘으로 겨뤄 보자.",
    "rex-strong-fair": "네 강점을 충분히 본 뒤 같은 조건에서 정정당당히 도전하겠어.", "rex-strong-eager": "눈을 뗄 수 없는 강함이군. 준비가 됐다면 지금 승부를 청하지.",
    "rex-small-guide": "놀라지 않아도 돼. 내가 몸을 낮출 테니 천천히 인사부터 해 보자.", "rex-small-example": "내가 먼저 인사할게. 편해지면 같은 방식으로 답해 줘.",
  }, habits: {
    approach: "소리보다 바람에 실린 냄새를 먼저 좇는다.", wait: "사냥 전 몸을 낮추고 풍향이 바뀌기를 기다린다.", share: "무리의 먹이가 부족하면 자신의 몫을 뒤로 미룬다.", guard: "먹이 주변을 한 바퀴 돈 뒤에야 식사를 시작한다.",
    rexSizeFormal: "큰 상대가 다가오면 어깨를 펴고 발끝을 가지런히 맞춘다.", rexSizeWrestle: "체격이 큰 상대 앞에서는 중심을 낮추고 맞잡을 거리를 가늠한다.",
    rexStrongFair: "강자의 움직임을 끝까지 지켜본 뒤 장비와 출발 위치부터 확인한다.", rexStrongEager: "강한 기척을 알아채면 눈빛이 밝아지고 곧바로 상대의 준비 여부를 살핀다.",
    rexSmallGuide: "작은 렐릭과 이야기할 때 무릎을 굽혀 시선을 같은 높이에 둔다.", rexSmallExample: "작은 렐릭 앞에서는 목소리를 낮추고 먼저 천천히 고개를 숙인다.",
  } },
  // 연구원은 어항 취미를 알지만, 스피나는 임무와 물고기 관리라는 짧은 해명으로 아직 감췄다고 믿는다.
  spino: { intro: "질문은 짧게. 순찰 시간이니까.", replies: {
    approach: "발신 지점부터 확인한다. 수조 쪽은 아니겠지.", wait: "주변이 잠잠해질 때까지 대기한다. 어항을 보는 건 아니다.", share: "필요한 몫만 나눈다. 물고기 먹이도 같은 원칙이다.", guard: "물가를 먼저 확보한다. 수조 상태는 순찰 항목일 뿐이다.",
    "spino-alarm-rescue": "구조 요청 위치 보고. 장비 확인했다. 바로 간다.", "spino-alarm-command": "가까운 경비는 수조 확인. 나는 구조 통로를 확보한다.",
    "spino-decoration-deny": "원래 있던 거다. ...각도가 틀어졌군.", "spino-decoration-shelter": "물고기에게 은신처가 필요했을 뿐이다. 그 이상은 없어.",
    "spino-cleaning-gloves": "혼자 해도 된다. ...여분 장갑은 거기 있다.", "spino-cleaning-roles": "나는 수초를 맡지. 당신은 유리면. 그게 효율적이다.",
  }, habits: {
    approach: "발신지를 좇으면서도 연구원의 시선이 멀어지면 수조 장비 잠금을 한 번 더 확인한다.", wait: "대기 중 어항 쪽을 보지 않는 척하면서 유리에 비친 물고기의 움직임을 확인한다.", share: "배분을 마친 뒤 아무도 보지 않을 때 물고기 먹이의 크기까지 고르게 맞춘다.", guard: "순찰 점검이라고 둘러대며 연구원이 떠난 뒤 수조 가장자리의 물기를 닦는다.",
    spinoAlarmRescue: "보고를 마치기 전 이미 장비 잠금을 확인하고 구조 현장으로 몸을 돌린다.", spinoAlarmCommand: "필요한 지시만 짧게 남기고 구조 인력이 지날 통로를 비운다.",
    spinoDecorationDeny: "대화가 끝나 연구원이 물러난 뒤 장식을 다시 어항 중앙에 맞춘다.", spinoDecorationShelter: "관심 없는 척 자리를 뜬 뒤 물고기가 장식을 쓰는지 멀리서 확인한다.",
    spinoCleaningGloves: "연구원이 닦은 유리의 물자국을 보지 못한 척하다가 몰래 마무리한다.", spinoCleaningRoles: "연구원이 어려워하는 구역을 발견하면 설명 없이 자신의 구역과 바꾸어 맡는다.",
  } },
  // 유일한 연구원인 플레이어와 나누는 휴식·훈련·간식 반응을 루카의 말투와 관찰 문장에 함께 대응시킨다.
  luka: { intro: "왔어, 연구원? 여기 앉아서 천천히 물어봐.", replies: {
    approach: "같이 가 보자. 별일 아니면 산책한 셈 치고.", wait: "조금 누워서 기다리면 무슨 소리인지 알게 될 거야.", share: "네 몫부터 떼어 둘게. 같이 먹는 게 더 맛있잖아.", guard: "내가 보고 있을 테니 연구원부터 편하게 먹어.",
    "luka-sofa-silence": "말하지 않아도 괜찮아. 연구원이 옆에 있으면 편하거든.", "luka-sofa-chat": "마침 할 이야기가 많았어. 오늘 훈련부터 소파 쿠션 이야기까지 들어 볼래?",
    "luka-sprint-compete": "달리기라면 봐주기 없지. 결승선에서 먼저 기다리고 있을게.", "luka-sprint-pace": "혼자 앞서면 금방 끝나잖아. 이번에는 옆에서 같이 달릴래.",
    "luka-cake-training": "접시는 여기까지. 다음 훈련에 질주 한 번을 더 넣으면 되겠어.", "luka-cake-more": "걱정은 다 먹고 해도 늦지 않아. 연구원도 한 조각 더 먹을래?",
  }, habits: {
    approach: "낯선 소리가 나면 연구원과 나란히 천천히 발신지를 찾아간다.", wait: "확인할 때까지 소파에 누워 소리의 간격을 세며 기다린다.", share: "간식을 펼치면 연구원의 몫을 먼저 가까운 접시에 덜어 둔다.", guard: "연구원이 식사를 마칠 때까지 주변을 살피면서도 자리를 비우지 않는다.",
    lukaSofaSilence: "연구원이 곁에 앉으면 소파 한쪽을 비우고 말없이 같은 시간을 보낸다.", lukaSofaChat: "연구원이 소파 곁에 오면 누운 채로도 사소한 이야깃거리를 연달아 꺼낸다.",
    lukaSprintCompete: "육식 계열 렐릭과 출발선에 서면 자세를 낮추고 자신의 최고 기록부터 노린다.", lukaSprintPace: "함께 달리는 렐릭이 뒤처지면 속도를 낮춰 상대의 보폭 옆에 맞춘다.",
    lukaCakeTraining: "치즈케이크를 먹고 몸무게가 신경 쓰이면 곧바로 다음 단거리 훈련 횟수를 적는다.", lukaCakeMore: "치즈케이크 뒤에 몸무게를 걱정하면서도 한 조각을 더 나눈 뒤 생각하기로 한다.",
  } },
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
