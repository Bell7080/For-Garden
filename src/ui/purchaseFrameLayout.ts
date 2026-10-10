/**
 * 현금 결제 팝업(테마 틀)의 자리. 세로로 **이름 → 상품 줄 → 보너스 → 제한 → 값 버튼**가 쌓이고,
 * 상품 줄은 개수에 맞춰 액자를 키워 가로로 쭉 편다. 값은 전부 여기 한 곳이다.
 */
export const PURCHASE_FRAME = {
  width: 980, height: 900, inner: 860,
  nameY: -392, badgeTop: -352,
  frameY: -105, frameGap: 24, frameMax: 240,
  bonusY: 50,
  limitY: 150,
  /** 값이 곧 결제 버튼이다 — 검은 판 위에 금빛 값만 서고 판 전체가 누름을 받는다. */
  buyY: 268, buyHeight: 150, buyWidth: 780,
  statusY: 385,
  maxTiles: 4,
} as const;

/** 액자 한 변과 가운데 x들. 개수가 적으면 키우고 많으면 줄인다. */
export function purchaseFrameSlots(count: number): { size: number; xs: number[] } {
  const n = Math.max(1, Math.min(PURCHASE_FRAME.maxTiles, count));
  const gap = PURCHASE_FRAME.frameGap;
  const size = Math.min(PURCHASE_FRAME.frameMax, Math.floor((PURCHASE_FRAME.inner - gap * (n - 1)) / n));
  const span = n * size + (n - 1) * gap;
  return { size, xs: Array.from({ length: n }, (_, i) => -span / 2 + size / 2 + i * (size + gap)) };
}

/** 상품 줄 뒤 발광 — 줄 폭보다 넓은 납작한 마름모 여러 겹. 값은 여기 한 곳이고 모든 테마가 같다. */
export const PURCHASE_ITEM_GLOW = { layers: 7, alphaPerLayer: 0.05, baseWidth: 420, stepWidth: 120, baseHeight: 150, stepHeight: 34 } as const;

export interface FrameBox { name: string; top: number; bottom: number }

/** 세로로 차지하는 칸들 — 서로 겹치지 않아야 한다(테스트가 지킨다). */
export function purchaseFrameBoxes(count: number): FrameBox[] {
  const { size } = purchaseFrameSlots(count);
  const P = PURCHASE_FRAME;
  return [
    { name: "name", top: P.nameY - 24, bottom: P.nameY + 24 },
    { name: "frames", top: P.frameY - size / 2, bottom: P.frameY + size / 2 },
    { name: "bonus", top: P.bonusY - 20, bottom: P.bonusY + 20 },
    { name: "limit", top: P.limitY - 18, bottom: P.limitY + 18 },
    { name: "buy", top: P.buyY - P.buyHeight / 2, bottom: P.buyY + P.buyHeight / 2 },
    { name: "status", top: P.statusY - 16, bottom: P.statusY + 16 },
  ];
}
