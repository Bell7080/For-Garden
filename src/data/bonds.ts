/** 유대 레벨별 대사 ID는 번역 문구와 분리해 콘텐츠 교체 시 저장/규칙을 건드리지 않는다. */
const GENERIC_IDS = Array.from({ length: 11 }, (_, level) => `bond.generic.${level}`);
export const BOND_DIALOGUE_IDS: Readonly<Record<string, readonly string[]>> = {
  anky: Array.from({ length: 11 }, (_, level) => `bond.anky.${level}`),
  rex: Array.from({ length: 11 }, (_, level) => `bond.rex.${level}`),
  spino: Array.from({ length: 11 }, (_, level) => `bond.spino.${level}`),
};

/** 시작 렐릭은 완성형 문구를 제공하고, 나머지는 레벨에 맞춘 공용 문구를 사용한다. */
const STARTER_LINES: Record<string, readonly string[]> = {
  anky: ["누구야?", "또 왔네.", "옆에 있어도 돼.", "오늘은 뭘 할까?", "네 발소리는 알아.", "같이 있으면 편안해.", "등은 내가 지킬게.", "기다리고 있었어.", "네가 오면 안심돼.", "끝까지 함께 갈게.", "우리의 정원은 내가 지켜."],
  rex: ["건드리지 마.", "겁은 없나 봐?", "조금은 흥미롭네.", "다음 사냥도 같이 가.", "네 냄새는 기억했어.", "내 곁에서 떨어지지 마.", "널 노리는 건 내가 문다.", "오늘도 늦었잖아.", "명령보다 네 목소리가 좋아.", "내 무리는 너뿐이야.", "영원히 네 편이 될게."],
  spino: ["...무슨 일이야?", "물가가 그리워.", "조용히 있어도 괜찮아.", "네 이야기를 더 들려줘.", "오늘 물결은 잔잔하네.", "함께 걷는 건 좋아해.", "위험하면 내 뒤로 와.", "네가 올 줄 알았어.", "이 도시도 이제 익숙해.", "네 곁이 내 물가야.", "어디든 함께 흘러가자."],
};
const GENERIC_LINES = ["아직은 조금 낯설어.", "오늘도 만났네.", "조금씩 익숙해지고 있어.", "같이 임무에 나가자.", "네가 오면 반가워.", "곁에 있어도 좋아.", "이번에도 도와줄게.", "기다리고 있었어.", "우린 좋은 동료야.", "오래 함께하고 싶어.", "앞으로도 잘 부탁해."];

/** 반복 터치는 같은 레벨 안에서도 문구가 바뀌도록 터치 순번을 순환시킨다. */
export function bondDialogue(relicId: string, bondLevel: number, interactionIndex: number): { id: string; text: string } {
  const lines = STARTER_LINES[relicId] ?? GENERIC_LINES;
  const offset = interactionIndex % 2 === 0 ? 0 : -1;
  const lineLevel = Math.max(0, Math.min(10, bondLevel + offset));
  return { id: (BOND_DIALOGUE_IDS[relicId] ?? GENERIC_IDS)[lineLevel], text: lines[lineLevel] };
}
