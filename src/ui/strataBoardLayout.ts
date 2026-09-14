/**
 * 지층 탐사판의 순수 배치표다.
 *
 * Phaser를 모르는 곳에 두는 이유는 화면과 회귀 테스트가 **같은 값**을 읽어야 하기 때문이다.
 * 칸 크기를 화면에서 눈대중으로 정하면 판이 5×5에서 6×5로 늘 때 판 밖으로 나간다.
 */

import type { StrataZoneTone } from "../data/strataLayers";

/** 판이 쓸 수 있는 자리와 칸 사이의 여백이다. */
export const STRATA_BOARD = {
  /** 판이 차지하는 최대 폭. 좌우 가장자리에 손가락이 지나갈 자리를 남긴다. */
  maxWidth: 900,
  /** 칸 사이 간격. 칸이 맞붙으면 어디까지가 한 칸인지 흐려진다. */
  gap: 14,
  /** 깎임 — 칸 한 변에 대한 비율. 화면 전체의 기울기 체계를 따른다. */
  bevelRatio: 0.2,
  /** 칸 하나가 가질 수 있는 최대 한 변. 칸 수가 적을 때 판이 통째로 커지지 않게 한다. */
  maxCell: 168,
} as const;

/** 칸 한 변과 판 전체 크기를 칸 수에서 거꾸로 구한다. */
export function strataBoardMetrics(columns: number, rows: number): { cell: number; width: number; height: number } {
  const cell = Math.min(STRATA_BOARD.maxCell, Math.floor((STRATA_BOARD.maxWidth - STRATA_BOARD.gap * (columns - 1)) / columns));
  return {
    cell,
    width: cell * columns + STRATA_BOARD.gap * (columns - 1),
    height: cell * rows + STRATA_BOARD.gap * (rows - 1),
  };
}

/** 판 가운데를 원점으로 한 칸 하나의 중심이다. */
export function strataTileCenter(index: number, columns: number, rows: number): { x: number; y: number } {
  const { cell, width, height } = strataBoardMetrics(columns, rows);
  const step = cell + STRATA_BOARD.gap;
  return {
    x: -width / 2 + cell / 2 + (index % columns) * step,
    y: -height / 2 + cell / 2 + Math.floor(index / columns) * step,
  };
}

/**
 * 구역의 색.
 *
 * **은은해야 한다** — 칸마다 또렷한 색을 칠하면 어디에 무엇이 있는지 말하는 표가 되어, 탐사가
 * 「색을 읽고 고르는 일」이 아니라 「정답을 보고 누르는 일」이 된다. 알파가 낮은 것은 그래서다.
 */
export const STRATA_ZONE_TONE: Readonly<Record<StrataZoneTone, { color: number; alpha: number }>> = {
  soil: { color: 0x6b5a3c, alpha: 0.2 },
  teal: { color: 0x2f8f8a, alpha: 0.22 },
  gold: { color: 0xc9a227, alpha: 0.22 },
  deep: { color: 0x7a2f4a, alpha: 0.24 },
};
