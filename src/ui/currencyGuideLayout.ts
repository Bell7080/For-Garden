/**
 * 재화 안내창의 **순수 배치표** — 위에서부터 잰 거리다.
 *
 * Phaser를 읽지 않는 이유는 다른 배치표와 같다 — 화면과 E2E가 같은 값을 읽어야 한다. 스펙이 좌표를
 * 손으로 적어 두었더니 창이 커진 뒤로 어긋나 입력면 밖을 눌렀고 — **조작은 성공한 채 검사만 조용히 깨졌다.**
 *
 * 높이는 손으로 적지 않고 획득처·사용처 줄 수에서 거꾸로 구한다 — 1020으로 못 박아 두었을 때는 줄이
 * 셋뿐인 재화도 창 아래가 텅 비었고, 줄을 늘리면 사용처가 창 밖으로 밀렸다.
 */
export const CURRENCY_GUIDE = {
  width: 780,
  hero: { top: 92, width: 660, height: 176, frameSize: 124 },
  /** 세계관 한 줄(최대 두 줄) — 보유량 아래. */
  lore: { gap: 22, height: 74, size: 25, wrap: 650 },
  section: { width: 640, gap: 26, header: 64, titleSize: 30 },
  row: 56,
  bottomPad: 44,
} as const;

export interface CurrencyGuideLayout {
  readonly height: number;
  /** 아래 값은 모두 창 윗변에서 잰 거리. */
  readonly heroY: number;
  readonly loreY: number;
  readonly sourcesTop: number;
  readonly usesTop: number;
}

export function currencyGuideLayout(sourceCount: number, useCount: number): CurrencyGuideLayout {
  const { hero, lore, section, row, bottomPad } = CURRENCY_GUIDE;
  const heroY = hero.top + hero.height / 2;
  const loreTop = hero.top + hero.height + lore.gap;
  const loreY = loreTop + lore.height / 2;
  const sourcesTop = loreTop + lore.height + section.gap;
  const sectionHeight = (count: number): number => (count > 0 ? section.header + count * row : 0);
  const usesTop = sourcesTop + sectionHeight(sourceCount) + (sourceCount > 0 ? section.gap : 0);
  const height = usesTop + sectionHeight(useCount) + bottomPad;
  return { height, heroY, loreY, sourcesTop, usesTop };
}
