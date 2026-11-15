import { RELIC_FILTER_POPUP, relicFilterPopupLayout } from "./relicGridLayout";

/**
 * 룬 일괄 판매 판의 자리 — 위는 조건 칩 네 줄(필터 판과 같은 배치표), 아래는 미리보기 · 보호 안내 · 예상 수령 · 판매 버튼.
 *
 * Phaser 없는 모듈이라 화면과 테스트가 같은 값을 읽는다. 판 높이는 손으로 적지 않고 쌓인 줄에서 거꾸로 구한다.
 */
export const RUNE_BULK_SELL = {
  width: RELIC_FILTER_POPUP.width,
  /** 칩 줄과 미리보기 사이. */
  summaryGap: 34,
  frame: 76,
  frameGap: 10,
  /** 미리보기 액자 수. 넘치면 마지막 칸이 `+N`이 된다. */
  maxFrames: 8,
  noteGap: 18,
  noteHeight: 30,
  barGap: 18,
  barHeight: 84,
  buttonGap: 26,
  buttonWidth: 380,
  buttonHeight: 84,
  bottom: 44,
  /** 가방 룬 탭 오른쪽 위의 진입 버튼(가방 판 가운데 기준). 조작 줄 위 · 제목표 띠 옆의 빈 자리다. */
  entry: { width: 180, height: 52, y: -700 },
} as const;

export interface RuneBulkSellLayout {
  readonly height: number;
  readonly sections: ReadonlyArray<{ readonly labelY: number; readonly chipY: number }>;
  readonly previewY: number;
  readonly noteY: number;
  readonly barY: number;
  readonly buttonY: number;
}

export function runeBulkSellLayout(sectionCount: number): RuneBulkSellLayout {
  const L = RUNE_BULK_SELL;
  const chips = relicFilterPopupLayout(Array.from({ length: sectionCount }, () => ({ chipHeight: RELIC_FILTER_POPUP.textChipHeight })), false);
  const chipsBottom = chips.height - RELIC_FILTER_POPUP.bottom;
  let cursor = chipsBottom + L.summaryGap;
  const previewTop = cursor; cursor += L.frame + L.noteGap;
  const noteTop = cursor; cursor += L.noteHeight + L.barGap;
  const barTop = cursor; cursor += L.barHeight + L.buttonGap;
  const buttonTop = cursor; cursor += L.buttonHeight + L.bottom;
  const height = cursor;
  const shift = chips.height / 2 - height / 2;
  return {
    height,
    sections: chips.sections.map(({ labelY, chipY }) => ({ labelY: labelY + shift, chipY: chipY + shift })),
    previewY: previewTop + L.frame / 2 - height / 2,
    noteY: noteTop + L.noteHeight / 2 - height / 2,
    barY: barTop + L.barHeight / 2 - height / 2,
    buttonY: buttonTop + L.buttonHeight / 2 - height / 2,
  };
}

/** 미리보기 `index`번째 액자의 가로 중심. 줄은 판 가운데로 모인다. */
export function runeBulkSellFrameX(index: number, count: number): number {
  const { frame, frameGap } = RUNE_BULK_SELL;
  const total = count * frame + Math.max(0, count - 1) * frameGap;
  return -total / 2 + frame / 2 + index * (frame + frameGap);
}
