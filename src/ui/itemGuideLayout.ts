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
  /** 「얻는 방법」 — 효과 설명 아래에 제목줄과 줄마다 한 수급처가 선다. 줄이 없으면 이 칸 자체가 없다. */
  sources: { gap: 24, header: 60, line: 40 },
  bottomPad: 60,
} as const;

/** 「얻는 방법」 제목줄의 위에서부터 잰 자리. */
export function itemGuideSourcesTop(): number {
  const { section, bodyHeight, sources } = ITEM_GUIDE;
  return section.top + 60 + bodyHeight + sources.gap;
}

export function itemGuideHeight(withUse: boolean, sourceCount = 0): number {
  const { section, bodyHeight, use, bottomPad, sources } = ITEM_GUIDE;
  const textBottom = sourceCount > 0 ? itemGuideSourcesTop() + sources.header + sourceCount * sources.line : section.top + 60 + bodyHeight;
  return withUse ? textBottom + 40 + use.height + use.bottom : textBottom + bottomPad;
}
