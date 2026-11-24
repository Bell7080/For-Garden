import { RUNE_PICK_GRID, runePickerListTop, runePickerSize } from "./runePickerLayout";

/**
 * 룬 일괄 세공 판의 자리 — 위는 장착 가방과 같은 룬 목록(조작 두 줄 + 카드 격자), 아래는
 * 고른 수 · 모두 선택 → 세공/각인 전환 버튼 둘 → 실행 버튼(세공은 필요 골드가 안에 서는 한 개, 각인은 위·아래 주 옵션 두 개).
 *
 * Phaser 없는 모듈이라 화면과 테스트가 같은 값을 읽는다. 판 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다.
 * 목록은 세 줄까지만 보인다 — 아래 조작이 판 안에 들고도 판이 화면을 넘지 않게.
 */
export const RUNE_BULK_CRAFT = {
  maxRows: 3,
  /** 목록 밑변에서 고른 수 줄까지. */
  listGap: 26,
  selectHeight: 60,
  selectButtonWidth: 230,
  modeGap: 22,
  /** 세공/각인 전환 줄 — 판 폭을 반씩 나눈 버튼 둘. */
  modeHeight: 72,
  modeSpacing: 16,
  buttonGap: 30,
  buttonWidth: 460,
  buttonHeight: 88,
  bottom: 40,
  /** 가방 룬 탭의 진입 버튼(가방 판 가운데 기준) — 일괄 판매 버튼 바로 왼쪽. */
  entry: { width: 180, height: 52, y: -700, gap: 14 },
} as const;

export interface RuneBulkCraftLayout {
  readonly width: number;
  readonly height: number;
  /** 판 윗변(판 가운데 기준). 목록의 조작 두 줄과 격자가 여기서부터 쌓인다. */
  readonly top: number;
  readonly selectY: number;
  readonly modeY: number;
  readonly buttonY: number;
  /** 세공/각인 전환 버튼 둘의 가로 중심과 폭. */
  readonly modeXs: readonly [number, number];
  readonly modeWidth: number;
  /** 각인 판의 실행 버튼 둘(위·아래 주 옵션)의 가로 중심과 폭. */
  readonly engraveXs: readonly [number, number];
  readonly engraveWidth: number;
  /** 왼쪽 이름표·고른 수 글자가 시작하는 x. */
  readonly left: number;
  readonly right: number;
}

/** `total`은 일괄 세공에 넣을 수 있는 룬의 최대 수 — 판 높이가 조건마다 흔들리지 않게 거르기 전 수로 잰다. */
export function runeBulkCraftLayout(total: number): RuneBulkCraftLayout {
  const L = RUNE_BULK_CRAFT;
  const picker = runePickerSize(total, L.maxRows);
  const width = picker.width;
  let cursor = runePickerListTop() + picker.viewHeight + L.listGap;
  const selectTop = cursor; cursor += L.selectHeight + L.modeGap;
  const modeTop = cursor; cursor += L.modeHeight + L.buttonGap;
  const buttonTop = cursor; cursor += L.buttonHeight + L.bottom;
  const height = cursor;
  const half = height / 2;
  const left = -width / 2 + RUNE_PICK_GRID.padX;
  const right = width / 2 - RUNE_PICK_GRID.padX;
  const modeWidth = (right - left - L.modeSpacing) / 2;
  const modeXs = [left + modeWidth / 2, right - modeWidth / 2] as const;
  const engraveWidth = Math.min(L.buttonWidth, modeWidth);
  return {
    width, height,
    top: -half,
    selectY: selectTop + L.selectHeight / 2 - half,
    modeY: modeTop + L.modeHeight / 2 - half,
    buttonY: buttonTop + L.buttonHeight / 2 - half,
    modeXs, modeWidth,
    engraveXs: modeXs, engraveWidth,
    left, right,
  };
}
