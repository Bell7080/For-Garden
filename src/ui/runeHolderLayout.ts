/**
 * 장착자 보기가 켜진 가방에서 룬 카드가 서는 모습.
 *
 * 카드 전체는 그 룬을 낀 렐릭의 **밝은 얼굴**이고(어두운 막도, 갈마드는 박자도 없다), 룬 조각은 액자 그대로 줄어
 * 왼쪽 아래에 앉는다. 얼굴이 돌아가며 룬을 가리던 때는 「이 룬이 무엇인가」와 「누가 끼고 있나」가 번갈아
 * 읽혔고, 끼고 있다는 이유로 가라앉힌 막이 얼굴까지 어둡게 눌렀다. 지금은 둘이 한 장에 함께 읽힌다.
 * Phaser 없는 모듈이라 회귀 테스트가 같은 값을 읽는다.
 */
export const RUNE_HOLDER_FACE = {
  /** 줄어든 룬 액자의 한 변 / 카드 액자의 한 변. */
  runeRatio: 0.42,
  /** 줄어든 룬 액자가 카드 왼쪽·아래 가장자리에서 떨어지는 거리(액자 한 변 비율). */
  inset: 0.04,
} as const;

/** 줄어든 룬 액자의 중심(카드 중심 기준). 왼쪽 아래 모서리는 깎이지 않아 두 변에서 같은 만큼 들어간다. */
export function runeHolderBadgeSpot(frameSize: number): { x: number; y: number; scale: number } {
  const { runeRatio, inset } = RUNE_HOLDER_FACE;
  const half = frameSize * runeRatio / 2;
  const edge = frameSize * inset;
  return { x: -frameSize / 2 + edge + half, y: frameSize / 2 - edge - half, scale: runeRatio };
}

