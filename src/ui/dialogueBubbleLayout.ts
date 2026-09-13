/**
 * 대사창 한 장의 **순수 비례표**.
 *
 * 로비의 애착 렐릭, 정보창의 전신, 상점의 점원, 그리고 이야기의 대사판이 모두 이 한 표를
 * 읽는다 — 화면마다 제 나름의 띠를 그리면 같은 말이 어디서는 두꺼운 판, 어디서는 맨 글자로
 * 선다.
 *
 * **생김새는 화면 전체의 규칙 그대로다.** 사방 외곽선을 두르지 않고 ① 살짝 기운 면,
 * ② 윗변 한 줄의 강조선, ③ 아래로 옅어지는 밑변 선만 쓴다. 이름은 띠 **안**이 아니라 윗변에
 * 걸터앉는 제목표(`addSectionTitle`)가 맡는다 — 판 안에 넣으면 이름과 본문을 가르려고 선을
 * 한 줄 더 그어야 하고, 그만큼 띠가 두꺼워져 캐릭터를 더 가린다. 제목표는 이미 화면 어디서나
 * 쓰는 문법이라 대사창만 다른 위계로 읽히지 않는다.
 *
 * Phaser를 들여오지 않는 이유는 이 비례를 테스트가 그대로 재야 하기 때문이다.
 */
export const DIALOGUE_BUBBLE = {
  /** 띠의 기울기. 화면의 다른 판과 같은 값을 쓴다. */
  slant: 18,
  /** 글이 띠의 좌우 변에서 들어오는 여백. */
  padX: 34,
  /** 글이 윗변에서 내려오는 여백. 이름표가 윗변에 걸터앉으므로 아래보다 넉넉하다. */
  padTop: 34,
  /** 글이 밑변에서 올라오는 여백. */
  padBottom: 30,
  /** 한 줄짜리 대사도 띠로 읽히는 최소 높이. */
  minHeight: 118,
  /** 이름표 글자 크기. 본문보다 작아야 본문이 먼저 읽힌다. */
  nameSize: 28,
  /** 본문 글자 크기. */
  bodySize: 32,
  lineSpacing: 8,
  /** 이름표의 왼쪽 끝이 띠 왼쪽 변에서 들어오는 양. 깎인 모서리를 피한다. */
  nameInset: 24,
  /** 떠오르며 들어오는 거리와 시간. */
  rise: 18,
  riseMs: 210,
  /** 다 뜬 뒤 머무는 시간과 사라지는 시간. */
  holdMs: 2400,
  fadeMs: 400,
} as const;

/** 본문이 줄바꿈하는 폭. 띠 폭에서 좌우 여백만 뺀다. */
export function dialogueBubbleWrap(width: number): number {
  return width - DIALOGUE_BUBBLE.padX * 2;
}

/**
 * 실제 글 높이에서 거꾸로 구한 띠 높이.
 *
 * 높이를 손으로 적어 두면 대사가 길어지거나 언어를 바꿀 때마다 아래 여백이 어긋난다 —
 * 스킬 쪽지와 같은 규칙이다.
 */
export function dialogueBubbleHeight(bodyHeight: number, minHeight: number = DIALOGUE_BUBBLE.minHeight): number {
  return Math.max(minHeight, DIALOGUE_BUBBLE.padTop + bodyHeight + DIALOGUE_BUBBLE.padBottom);
}

/** 띠를 거는 변. `bottom`이면 넘긴 y가 밑변이라 대사가 길어져도 아래로 자라지 않는다. */
export type DialogueBubbleAnchor = "top" | "center" | "bottom";

/** 그 변에 맞춘 띠의 세로 가운데. 화면은 좌표를 손으로 적지 않는다. */
export function dialogueBubbleCenterY(y: number, height: number, anchor: DialogueBubbleAnchor = "bottom"): number {
  if (anchor === "top") return y + height / 2;
  if (anchor === "center") return y;
  return y - height / 2;
}
