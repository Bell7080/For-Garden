import { RUNE_LIST_CONTROLS } from "./runeListControlsLayout";
import { runePickerListTop, runePickerSize, RUNE_PICK_GRID } from "./runePickerLayout";

/**
 * 룬을 「눌러 보고 → 선택」으로 넣는 고르기 판(특성 연구 · 합성)의 자리.
 *
 * 위에서부터 제목표 → **고른 룬의 정보 판** → 공용 조작 두 줄 → 카드 목록 → 밑동의 「선택」 줄이다.
 * 카드를 누르기만 해서는 칸에 들어가지 않는다 — 정보 판이 그 룬을 먼저 보여 주고, 「선택」이 넣는다
 * (룬 정비 창의 「교체 비교 → 적용」과 같은 두 걸음). Phaser 없는 모듈이라 화면과 테스트가 같은 값을 읽는다.
 */
export const RUNE_SELECT = {
  /** 판 윗변에서 정보 판 윗변까지 — 제목표 띠 아래. */
  infoTop: 78,
  infoHeight: 252,
  infoPad: 24,
  icon: 150,
  /** 정보 판 아래에서 조작 첫 줄 윗변까지. */
  controlsGap: 22,
  /** 정보 판이 자리를 먹으므로 목록은 세 줄까지만 보이고 나머지는 끌어 내린다. */
  maxRows: 3,
  /** 목록 아래에서 「선택」 줄 가운데까지. */
  footerGap: 74,
  footerBottom: 70,
  button: { width: 380, height: 96, fontSize: 36 },
  /** 합성처럼 칸이 여럿이면 「선택」 왼쪽에 칸 줄이 선다. */
  slot: { size: 76, gap: 18 },
  /**
   * 칸이 여럿인 판의 「한 번에 선택」 토글 — 「선택」 바로 위 오른쪽 끝에 작게 선다(응태 2026-11-25).
   * 목록과 「선택」 사이 여백에 앉히고 「선택」을 그만큼 아래로 내린다 — 판은 조금만 길어진다.
   */
  toggle: { width: 240, height: 56, listGap: 18, buttonGap: 14, footerBottom: 46 },
} as const;

export interface RuneSelectRows {
  width: number;
  height: number;
  /** 정보 판 윗변(판 가운데 기준). */
  infoTop: number;
  /** 공용 고르기 격자를 세울 윗변 — `mountRunePickerGrid`의 `top`. */
  gridTop: number;
  /** 목록 아랫변. */
  listBottom: number;
  footerY: number;
  /** 「한 번에 선택」 토글의 가운데 y. 칸이 하나인 판에는 서지 않는다. */
  toggleY?: number;
}

/**
 * `total`은 판 크기를 정할 룬 수(거르기 전의 최대) — 조건이 바뀌어도 판이 줄었다 늘지 않는다.
 * `multi`는 칸이 여럿인 판(합성) — 「선택」 위에 「한 번에 선택」 토글 자리가 생긴다.
 */
export function runeSelectRows(total: number, multi = false): RuneSelectRows {
  const S = RUNE_SELECT;
  const grid = runePickerSize(total, S.maxRows);
  const infoBottom = S.infoTop + S.infoHeight;
  // 격자의 조작 첫 줄은 격자 윗변에서 `controlsY`에 가운데가 선다 — 그 윗변이 정보 판 아래 `controlsGap`에 오도록 거꾸로 구한다.
  const gridTopFromTop = infoBottom + S.controlsGap - (RUNE_PICK_GRID.controlsY - RUNE_LIST_CONTROLS.rowHeight / 2);
  const listBottomFromTop = gridTopFromTop + runePickerListTop() + grid.viewHeight;
  const T = S.toggle;
  const toggleFromTop = listBottomFromTop + T.listGap + T.height / 2;
  const footerFromTop = multi ? toggleFromTop + T.height / 2 + T.buttonGap + S.button.height / 2 : listBottomFromTop + S.footerGap;
  const height = footerFromTop + S.button.height / 2 + (multi ? T.footerBottom : S.footerBottom);
  const top = -height / 2;
  return {
    width: grid.width, height,
    infoTop: top + S.infoTop,
    gridTop: top + gridTopFromTop,
    listBottom: top + listBottomFromTop,
    footerY: top + footerFromTop,
    ...(multi ? { toggleY: top + toggleFromTop } : {}),
  };
}

/** 칸 줄의 x들(가운데 기준). 칸 줄과 「선택」 버튼이 한 줄에 함께 선다. */
export function runeSelectFooterXs(width: number, slots: number): { button: number; slots: number[] } {
  const S = RUNE_SELECT;
  if (slots <= 1) return { button: 0, slots: [] };
  const right = width / 2 - RUNE_PICK_GRID.padX;
  const button = right - S.button.width / 2;
  const left = -width / 2 + RUNE_PICK_GRID.padX + S.slot.size / 2;
  return { button, slots: Array.from({ length: slots }, (_, i) => left + i * (S.slot.size + S.slot.gap)) };
}

/** 다음에 채울 칸 — 지금 칸 뒤의 빈 칸부터, 없으면 앞의 빈 칸. 다 찼으면 -1. */
export function nextEmptySlot(filled: readonly boolean[], from: number): number {
  for (let step = 1; step <= filled.length; step += 1) {
    const index = (from + step) % filled.length;
    if (!filled[index]) return index;
  }
  return -1;
}

/**
 * 「한 번에 선택」으로 고른 룬이 들어갈 칸의 차례 — 지금 칸(비었으면)부터 다음 빈 칸으로 이어진다.
 * 하나씩 넣을 때 `nextEmptySlot`이 밟는 차례와 같다. 빈 칸이 없으면 빈 목록이다.
 */
export function emptySlotOrder(filled: readonly boolean[], from: number): number[] {
  const order: number[] = [];
  let index = from >= 0 && from < filled.length && !filled[from] ? from : nextEmptySlot(filled, from);
  const taken = [...filled];
  while (index >= 0 && !order.includes(index)) {
    order.push(index);
    taken[index] = true;
    index = nextEmptySlot(taken, index);
  }
  return order;
}
