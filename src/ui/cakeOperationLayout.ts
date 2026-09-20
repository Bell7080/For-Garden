import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_SLOT, BACK_BUTTON_SIZE } from "./popupGeometry";

/**
 * 치즈케이크 대작전 화면의 세로 좌표를 한 곳이 갖는다.
 *
 * 단계가 여덟 줄로 흐르고 그 아래에 배율 칩과 조작 둘이 선다 — 눈대중으로 몇 픽셀씩 내리면
 * 단계가 하나 늘거나 줄 높이가 바뀌는 날 마지막 줄이 조작 줄을 파고든다. 그래서 줄 수에서
 * 거꾸로 구하고, 우하단 뒤로가기와 부딪히지 않는지도 같은 표가 지킨다.
 */

/** 단계 한 줄의 규격. */
export const CAKE_ROW = {
  width: 920,
  height: 128,
  /** 줄과 줄 사이의 여백. */
  gap: 12,
  /** 줄 왼쪽 안쪽 여백 — 이름과 레벨이 서는 자리다. */
  padding: 34,
} as const;

/** 목록이 시작하는 세로 좌표(첫 줄의 **윗변**). */
export const CAKE_LIST_TOP = 268;

/** 화면 제목이 앉는 자리. */
export const CAKE_TITLE = { x: 72, y: 190 } as const;

/** 배율 칩 한 장의 규격. */
export const CAKE_MULTIPLIER_CHIP = { width: 150, height: 92, gap: 22 } as const;

/** 아래 조작 버튼 한 장의 규격. */
export const CAKE_ACTION_BUTTON = { width: 400, height: 116, gap: 32 } as const;

/** 줄 `index`(0부터)의 중심 y. */
export function cakeRowCenterY(index: number): number {
  return CAKE_LIST_TOP + CAKE_ROW.height / 2 + index * (CAKE_ROW.height + CAKE_ROW.gap);
}

/** 목록이 끝나는 세로 좌표(마지막 줄의 **밑변**). */
export function cakeListBottom(count: number): number {
  return CAKE_LIST_TOP + count * CAKE_ROW.height + Math.max(0, count - 1) * CAKE_ROW.gap;
}

/** 배율 칩 줄의 중심 y. 목록 밑변에서 한 뼘 떨어져 선다. */
export function cakeMultiplierRowY(count: number): number {
  return cakeListBottom(count) + 64 + CAKE_MULTIPLIER_CHIP.height / 2;
}

/** 조작 줄의 중심 y. 배율 줄 아래에 붙는다. */
export function cakeActionRowY(count: number): number {
  return cakeMultiplierRowY(count) + CAKE_MULTIPLIER_CHIP.height / 2 + 44 + CAKE_ACTION_BUTTON.height / 2;
}

/** 배율 칩 `index`의 중심 x. 칩 묶음은 화면 가운데에 선다. */
export function cakeMultiplierChipX(index: number, total: number): number {
  const span = total * CAKE_MULTIPLIER_CHIP.width + (total - 1) * CAKE_MULTIPLIER_CHIP.gap;
  return BASE_WIDTH / 2 - span / 2 + CAKE_MULTIPLIER_CHIP.width / 2 + index * (CAKE_MULTIPLIER_CHIP.width + CAKE_MULTIPLIER_CHIP.gap);
}

/** 조작 버튼 `index`의 중심 x(0 = 출격, 1 = 소탕). */
export function cakeActionButtonX(index: number): number {
  const span = 2 * CAKE_ACTION_BUTTON.width + CAKE_ACTION_BUTTON.gap;
  return BASE_WIDTH / 2 - span / 2 + CAKE_ACTION_BUTTON.width / 2 + index * (CAKE_ACTION_BUTTON.width + CAKE_ACTION_BUTTON.gap);
}

/** 조작 줄 밑변이 우하단 뒤로가기의 윗변보다 위인가. 한 화면에 둘이 겹치지 않게 지킨다. */
export function cakeFitsAboveBackButton(count: number): boolean {
  return cakeActionRowY(count) + CAKE_ACTION_BUTTON.height / 2 <= BACK_SLOT.y - BACK_BUTTON_SIZE / 2
    && cakeActionRowY(count) + CAKE_ACTION_BUTTON.height / 2 <= BASE_HEIGHT;
}
