import { SETTINGS_ROW } from "./settingsLayout";

/**
 * 타이틀 소리 조절 판의 순수 배치표.
 *
 * 줄은 환경설정과 같은 프리팹이라 줄 안쪽 폭(0~900)과 줄 간격을 그대로 따른다. 판은 그 폭에 좌우
 * 여백만 더하고, 높이는 줄 수에서 거꾸로 구한다 — 손으로 적으면 줄을 더할 때 마지막 줄이 판 밖으로 나간다.
 */
const ROW_WIDTH = SETTINGS_ROW.right - SETTINGS_ROW.left;
const ROWS = 5;
const PAD_X = 50;
const PAD_Y = 90;

export const TITLE_SOUND_POPUP = {
  width: ROW_WIDTH + PAD_X * 2,
  height: (ROWS - 1) * SETTINGS_ROW.step + SETTINGS_ROW.hitHeight + PAD_Y * 2,
  rows: ROWS,
  rowWidth: ROW_WIDTH,
  /** 줄의 왼쪽 기준(판 가운데 기준). */
  rowLeft: -ROW_WIDTH / 2,
  /** 첫 줄의 가운데 y(판 가운데 기준). */
  firstRowY: -((ROWS - 1) * SETTINGS_ROW.step) / 2,
  step: SETTINGS_ROW.step,
} as const;
