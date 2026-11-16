/**
 * 후원 지층 창과 프리미엄 화면 칩의 자리 — 화면은 좌표를 손으로 적지 않고 이 표를 읽는다.
 *
 * 창은 위에서부터 **지금 지층(큰 표식 · 이름 · 기금/다음 문턱)** → **지층 사다리(일곱 표식 + 지나온 길)** →
 * **고른 지층의 혜택(승급 기념품 한 줄 + 혜택 카드 두 열)** → **오늘의 후원 보급 + 받기**다(응태 2026-11-16 — 등급 사다리를 눌러
 * 그 등급의 혜택을 넘겨 보는 구성). 창 높이는 카드가 가장 많은 지층에 맞춰 굳힌다 — 지층을 넘길 때마다 판 높이가 바뀌면
 * 갈아 끼우기가 출렁인다(`patronPopupHeight`).
 */
export const PATRON_POPUP = {
  width: 960,
  pad: 48,
  hero: { top: 64, emblemY: 60, emblem: 40, nameY: 136, nameSize: 52, fundY: 190, fundSize: 30, height: 216 },
  ladder: { top: 300, height: 240, emblemY: 60, emblem: 26, plate: { width: 104, top: 12, bottom: 134 }, trackY: 110, node: 11, lineHeight: 8, noteY: 168, noteSize: 28, howtoY: 208, howtoSize: 24, inset: 64 },
  benefit: { top: 562, headerHeight: 62, reward: { height: 120, frame: 80, button: { width: 180, height: 70 } }, gap: 14, columns: 2, card: { height: 106, frame: 78 }, labelSize: 29 },
  daily: { headerHeight: 62, frame: 96, gap: 18, frameY: 112, button: { width: 380, height: 96, y: 238 }, tag: { height: 46, size: 26, emblem: 10, padX: 16, gap: 10, angle: -6 }, height: 306 },
  bottomPad: 36,
} as const;

/** 혜택 카드 줄 수. */
export const patronBenefitRows = (cards: number): number => Math.ceil(Math.max(0, cards) / PATRON_POPUP.benefit.columns);

/** 혜택 카드 묶음이 시작하는 y(판 윗변 기준) — 기념품 한 줄 아래. */
export function patronCardsTop(): number {
  const B = PATRON_POPUP.benefit;
  return B.top + B.headerHeight + B.reward.height + B.gap;
}

/** 카드 하나의 가운데(판 윗변·가운데 기준). */
export function patronCardSpot(index: number, inner: number): { x: number; y: number; width: number } {
  const B = PATRON_POPUP.benefit;
  const width = (inner - B.gap * (B.columns - 1)) / B.columns;
  const column = index % B.columns;
  const row = Math.floor(index / B.columns);
  return { x: -inner / 2 + width / 2 + column * (width + B.gap), y: patronCardsTop() + row * (B.card.height + B.gap) + B.card.height / 2, width };
}

/** 오늘의 보급 묶음이 시작하는 y. */
export function patronDailyTop(maxCards: number): number {
  const B = PATRON_POPUP.benefit;
  const rows = patronBenefitRows(maxCards);
  return patronCardsTop() + rows * B.card.height + Math.max(0, rows - 1) * B.gap + 26;
}

/** 카드가 가장 많은 지층이 정하는 창 높이. */
export function patronPopupHeight(maxCards: number): number {
  return patronDailyTop(maxCards) + PATRON_POPUP.daily.height + PATRON_POPUP.bottomPad;
}

/** 사다리 위 표식 하나의 x — 첫·끝 표식은 판 안쪽으로 `inset`만큼 들인다. */
export function patronLadderX(index: number, count: number, inner: number): number {
  const L = PATRON_POPUP.ladder;
  const span = inner - L.inset * 2;
  return count <= 1 ? 0 : -span / 2 + (span * index) / (count - 1);
}

/** 프리미엄 화면 오른쪽 위, 「프리미엄」 제목과 마주 보는 칩. 오른쪽 끝을 제목의 왼쪽 여백과 같게 둔다. */
export const PATRON_CHIP = { right: 1080 - 60, y: 214, width: 360, height: 80, emblem: 22, nameSize: 26, fundSize: 19 } as const;
