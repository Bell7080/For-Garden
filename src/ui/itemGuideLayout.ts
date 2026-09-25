/**
 * 재료·소비품 안내창의 순수 배치표 — **위에서부터 잰 거리**다.
 *
 * 폭과 위 판은 재화 안내창과 같은 값이다(`CURRENCY_GUIDE_SIZE`·`HERO`) — 같은 가방에서 두 종류를 번갈아
 * 눌러도 창이 같은 자리·같은 크기로 선다. 높이는 손으로 적지 않고 「사용하기」가 서는지에서 구한다.
 */
export const ITEM_GUIDE = {
  width: 780,
  hero: { top: 92, width: 660, height: 176, frameSize: 124 },
  section: { top: 330, width: 630 },
  /** 설명 두 줄이 들어갈 몫. */
  bodyHeight: 110,
  use: { width: 340, height: 88, bottom: 56 },
  bottomPad: 60,
} as const;

export function itemGuideHeight(withUse: boolean): number {
  const { section, bodyHeight, use, bottomPad } = ITEM_GUIDE;
  const textBottom = section.top + 60 + bodyHeight;
  return withUse ? textBottom + 40 + use.height + use.bottom : textBottom + bottomPad;
}
