import { registerDataText } from "../i18n";
/**
 * 첫 획득의 한마디. 새로 만난 렐릭의 소개 장면(`NewRelicShowcase`)이 빈 화면에 가장 먼저 띄우는
 * 문장이라, 그 개체의 목소리가 한 줄로 읽혀야 한다. 긴 분기 대사는 DialogueStory로 승격한다.
 */
export const RELIC_FIRST_MEETINGS: Readonly<Record<string, string>> = {
  rex: "전투의 여왕은 나야.",
  anky: "대장님 앞은 제가 막을게요!",
  spino: "…물소리가 들리는 곳이라면, 어디든.",
  luka: "달리는 건 자신 있어. 소파 다음으로.",
  dodo: "대장님, 이것 좀 보세요! 세기의 대발견이에요!",
  tia: "반짝이는 건 다 내 거야!",
  stella: "바람길은 이미 읽어 뒀어요, 선배.",
  meron: "네? 마음에 안 드신다고요...?",
  pachi: "야, 비켜! 보스 앞길은 내가 뚫는다.",
  maki: "잠깐, 나 이래 봬도 의사라고?",
  keris: "나만 봐요, 선배.",
  delopi: "짜잔! 연구원님 열쇠, 여기 있어요.",
  nodonia: "아프면 말하렴, 아가. 대신 맞아 줄 테니.",
  ella: "제자리에 서 있을게요. 뒤는 맡기세요.",
  mette: "당신만을 위한 무대, 이제 시작할게요.",
  deina: "네가 예술을 알아?",
  maddy: "파워 냉방으로 부탁드려요.",
  terisa: "찢어진 곳이 있으면… 꿰매 줄게, 아가.",
  parua: "멀리… 멀리요! 다 보여요.",
  shute: "그거 아니라니까? 내 오더 들어.",
  morphe: "다 띄워. 난 여기서 볼게.",
  dian: "대장님은 내가 지킬게! …아, 쿠로! 시로!",
};

/** 아직 전용 대사가 없는 프로토타입도 빈 화면 대신 공통 인사를 쓴다. */
export function firstMeetingLine(relicId: string): string {
  return RELIC_FIRST_MEETINGS[relicId] ?? FIRST_MEETING_FALLBACK.text;
}

/** 첫 대면 문구를 개체 ID로 덮어쓸 수 있게 등록한다. */
/** 전용 문구가 없는 개체가 쓰는 기본 첫 인사. */
export const FIRST_MEETING_FALLBACK = { text: "당신이 나를 깨운 조사관이군요. 잘 부탁해요." };
registerDataText(FIRST_MEETING_FALLBACK, "text", "firstMeeting.fallback");

for (const relicId of Object.keys(RELIC_FIRST_MEETINGS)) {
  registerDataText(RELIC_FIRST_MEETINGS, relicId, `firstMeeting.${relicId}`);
}
