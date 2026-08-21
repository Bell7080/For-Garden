/** 첫 획득에만 재생하는 짧은 정적 대사. 긴 분기 대사는 DialogueStory로 승격한다. */
export const RELIC_FIRST_MEETINGS: Readonly<Record<string, string>> = {
  rex: "마침내 깨어났군. 이제 내가 길을 열어 주지.",
  anky: "낯선 곳이지만… 네 곁이라면 지켜 볼게.",
  spino: "오래 잠들어 있었어. 물소리가 들리는 곳은 어디지?",
};

/** 아직 전용 대사가 없는 프로토타입도 빈 화면 대신 공통 인사를 쓴다. */
export function firstMeetingLine(relicId: string): string {
  return RELIC_FIRST_MEETINGS[relicId] ?? "당신이 나를 깨운 조사관이군요. 잘 부탁해요.";
}
