import { RUNE_PICK_GRID, runePickerListTop, runePickerSize } from "./runePickerLayout";

/**
 * 룬 일괄 세공 판의 자리 — 위는 장착 가방과 같은 룬 목록(조작 두 줄 + 카드 격자), 아래는
 * 고른 수 · 모두 선택 → 각인 자리 칩 → 세공 버튼(필요 골드가 버튼 안에 선다).
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
  engraveGap: 22,
  /** 각인 줄 — 왼쪽 이름표 칸, 오른쪽에 칩 셋. */
  engraveLabelWidth: 150,
  engraveHeight: 74,
  chipGap: 12,
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
  readonly engraveY: number;
  readonly buttonY: number;
  /** 각인 칩 셋의 가로 중심과 칩 폭. */
  readonly chipXs: readonly number[];
  readonly chipWidth: number;
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
  const selectTop = cursor; cursor += L.selectHeight + L.engraveGap;
  const engraveTop = cursor; cursor += L.engraveHeight + L.buttonGap;
  const buttonTop = cursor; cursor += L.buttonHeight + L.bottom;
  const height = cursor;
  const half = height / 2;
  const left = -width / 2 + RUNE_PICK_GRID.padX;
  const right = width / 2 - RUNE_PICK_GRID.padX;
  const chipsLeft = left + L.engraveLabelWidth;
  const chipWidth = (right - chipsLeft - L.chipGap * 2) / 3;
  return {
    width, height,
    top: -half,
    selectY: selectTop + L.selectHeight / 2 - half,
    engraveY: engraveTop + L.engraveHeight / 2 - half,
    buttonY: buttonTop + L.buttonHeight / 2 - half,
    chipXs: [0, 1, 2].map((index) => chipsLeft + chipWidth / 2 + index * (chipWidth + L.chipGap)),
    chipWidth,
    left, right,
  };
}
