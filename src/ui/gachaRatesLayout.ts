/**
 * 연구 확률표 창의 자리 — Phaser를 모르는 순수 배치표.
 *
 * 창 높이를 손으로 적지 않는다. 등급 줄 넷·펼친 등급의 세부 줄·규칙 글에서 **거꾸로 구한다** —
 * 등급 하나를 펼치면 그 줄 수만큼 자라고, 접으면 줄어든다. 한 번에 하나만 펼치므로(아코디언),
 * 픽업 밖이 다섯을 넘는 풀은 두 칸으로 서서, 가장 큰 풀을 펼쳐도 세로 화면 안에 든다(`tests/unit/gachaRates.test.ts`).
 */
export const GACHA_RATES = {
  width: 920,
  padding: 40,
  /**
   * 판 윗변이 서는 화면 높이. 가운데에 두면 펼칠 때마다 판이 위아래로 함께 자라 **방금 누른 등급
   * 줄이 손 밑에서 달아난다** — 윗변을 고정하면 판은 아래로만 자라고 등급 줄은 제자리에 남는다.
   */
  screenTop: 140,
  /** 판 윗변에서 첫 글줄(배너 이름 · 기준)까지. 머리글이 윗변에 걸터앉으므로 그만큼 내린다. */
  topRoom: 92,
  /** 기준 줄에서 첫 등급 줄 가운데까지. */
  captionRoom: 70,
  /** 등급 줄 한 칸. 판 높이는 `tierHeight`, 칸 사이는 그 나머지다. */
  tierStep: 92,
  tierHeight: 78,
  tierLabelSize: 36,
  tierPercentSize: 34,
  /** 세부 줄 한 칸 — 액자가 서는 만큼의 높이다. */
  entryStep: 84,
  entryIcon: 68,
  entryNameSize: 27,
  entryPercentSize: 27,
  /** 세부 줄이 등급 줄보다 들어가는 폭. 어느 등급의 안쪽인지를 들여쓰기가 말한다. */
  entryIndent: 34,
  /** 두 칸으로 설 때 칸 사이. */
  columnGap: 28,
  /** 펼친 목록의 위아래 여백. */
  entryPad: 10,
  /** 등급 표 끝에서 규칙 제목까지. */
  notesGap: 58,
  /** 규칙 제목표에서 규칙 글까지. */
  notesTitleRoom: 58,
  notesSize: 24,
  bottomPad: 44,
  /**
   * 창이 넘지 않을 높이 — 윗변(`screenTop`)에서 판 밖 우하단 뒤로가기(`BACK_SLOT`) 위까지다.
   * 넘으면 규칙 글이 아니라 창 배치가 잘못된 것이다.
   */
  maxHeight: 1580,
} as const;

/** 이 수를 넘는 풀은 두 칸으로 선다. 열 명 남짓한 SSR 풀을 한 줄씩 세우면 세로 화면을 넘는다. */
export const GACHA_RATES_SINGLE_COLUMN_MAX = 5;

/**
 * 펼친 세부 줄을 칸에 앉힌다 — **픽업은 한 줄을 통째로** 갖고 맨 위에 서며, 나머지는 수가 많으면
 * 두 칸으로 나란히 선다. 픽업까지 두 칸에 섞으면 무엇이 이번 연구의 주인공인지가 크기로 읽히지 않는다.
 */
export interface GachaRatesSlot { index: number; row: number; column: 0 | 1; span: 1 | 2; }

export function gachaRatesSlots(entries: readonly { pickup?: boolean }[]): GachaRatesSlot[] {
  const pickups = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => entry.pickup);
  const others = entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => !entry.pickup);
  const twoColumns = others.length > GACHA_RATES_SINGLE_COLUMN_MAX;
  const slots: GachaRatesSlot[] = pickups.map(({ index }, row) => ({ index, row, column: 0, span: 2 }));
  others.forEach(({ index }, order) => {
    slots.push(twoColumns
      ? { index, row: pickups.length + Math.floor(order / 2), column: (order % 2) as 0 | 1, span: 1 }
      : { index, row: pickups.length + order, column: 0, span: 2 });
  });
  return slots;
}

export function gachaRatesRowCount(entries: readonly { pickup?: boolean }[]): number {
  return gachaRatesSlots(entries).reduce((max, slot) => Math.max(max, slot.row + 1), 0);
}

/** 등급 표(등급 줄 + 펼친 세부 줄)의 높이. */
export function gachaRatesTableHeight(tierCount: number, expandedRows: number): number {
  const L = GACHA_RATES;
  const expanded = expandedRows > 0 ? expandedRows * L.entryStep + L.entryPad * 2 : 0;
  return tierCount * L.tierStep + expanded;
}

/** 창 높이. 규칙 글은 언어마다 줄 수가 달라 실제로 잰 높이를 받는다. */
export function gachaRatesPopupHeight(tierCount: number, expandedRows: number, notesHeight: number): number {
  const L = GACHA_RATES;
  return L.topRoom + L.captionRoom + gachaRatesTableHeight(tierCount, expandedRows)
    + L.notesGap + L.notesTitleRoom + notesHeight + L.bottomPad;
}

/** 접힌 등급 줄의 화면 y(가운데). 펼친 등급 아래의 줄만 그 등급의 세부 줄 수만큼 내려간다. */
export function gachaRatesTierScreenY(index: number, expandedIndex: number | null, expandedRows: number): number {
  const L = GACHA_RATES;
  const pushed = expandedIndex !== null && index > expandedIndex && expandedRows > 0 ? expandedRows * L.entryStep + L.entryPad * 2 : 0;
  return L.screenTop + L.topRoom + L.captionRoom + index * L.tierStep + L.tierHeight / 2 + pushed;
}
