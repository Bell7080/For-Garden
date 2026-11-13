import { registerDataText } from "../i18n";
/**
 * 첫 획득의 한마디. 새로 만난 렐릭의 소개 장면(`NewRelicShowcase`)이 빈 화면에 가장 먼저 띄우는
 * 문장이라, 그 개체의 목소리가 한 줄로 읽혀야 한다. 긴 분기 대사는 DialogueStory로 승격한다.
 */
export const RELIC_FIRST_MEETINGS: Readonly<Record<string, string>> = {
  rex: "전투의 여왕은 나야.",
  torika: "대장님 앞은 제가 막을게요!",
  spino: "…물소리가 들리는 곳이라면, 어디든.",
  luka: "연구원님? 급한 일 아니면 나 잠깐만 더 누워 있을게.",
  dodo: "대장님, 이것 좀 보세요! 세기의 대발견이에요!",
  tia: "연구원님, 저 반짝이는 거 보셨어요? 제가 주워 와도 돼요?",
  stella: "바람길은 이미 읽어 뒀어요, 선배.",
  meron: "저, 메론이에요… 그려 드리고 싶은데, 얼굴 좀 보여 주실래요?",
  pachi: "야, 비켜! 보스 앞길은 내가 뚫는다.",
  maki: "진단부터 하겠다냥. 나 이래 봬도 의사다냥!",
  keris: "선배, 찾으시는 책 있어요? 제가 안내해 드릴게요.",
  teku: "리필, 부탁드려요, 대장님. 서두르진 않을게요.",
  plesha: "관측 지점 확인! 앗… 처음 뵙겠습니다, 선배. 오늘 밤 별 같이 세요.",
  yuti: "보스, 이쪽 자리 비었죠? 제가 옆에 있어도 돼요?",
  ark: "므하하하! 보셨어요, 마스터? 다들 벽에 붙었어요. ...잠깐, 방금 그거 무서웠죠?",
  irna: "수평선에 걸렸어요, 오더. 한 발이면 돼요.",
  delopi: "짜잔! 연구원님 열쇠, 여기 있어요.",
  nodonia: "아프면 말하렴, 아가. 대신 맞아 줄 테니.",
  ella: "제자리에 서 있을게요. 뒤는 맡기세요.",
  mette: "당신만을 위한 무대, 이제 시작할게요.",
  deina: "나 데이! 이 벽, 아직 비어 있네. 그려도 돼?",
  maddy: "매디예요, 연구원 씨. 여긴 좀 덥네요. 냉방 더 세게 틀어도 돼요?",
  arte: "A-CLEAN 아르테, 현장 도착했습니다! 연구원님, 발밑 조심하세요.",
  terisa: "찢어진 곳이 있으면… 꿰매 줄게, 아가.",
  parua: "멀리… 멀리요! 다 보여요.",
  shute: "그거 아니라니까? 내 오더 들어, 캐리해 줄게.",
  morphe: "…담당관? 잘 왔어. 잠깐만… 화면 띄워 줄게.",
  kento: "아, 귀찮게… 담당관이야? 알았어, 용건부터 말해. 5분 안에 끝내자.",
  mosana: "…수심 확인. 당신, 줄 잡아. 놓치면 안 건져 줘.",
  anka: "으음… 연구원 씨도 졸려요? 같이 자요… 아, 안 돼요? 그럼 재워 줄게요.",
  dian: "대장님은 제가 지킬게요! …아, 쿠로! 시로!",
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
