import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 타이틀 하단 버튼 줄의 자리.
 *
 * 언어 버튼 하나로 시작하지만 구글·애플 로그인, 계정 전환처럼 둘셋으로 늘어도 같은 줄에 그대로
 * 서도록 **개수에서 자리를 구한다** — 버튼을 더할 때 좌표를 손으로 옮기지 않는다. 줄은 가운데 정렬이고,
 * 위로는 로딩 칸(마름모)과 진입 문구, 왼쪽 아래로는 버전 표기를 피한다(`titleActionLayout.test.ts`).
 */
export const TITLE_ACTION_ROW = {
  /** 줄 가운데의 세로 자리. 로딩 칸(0.94H, 반지름 30) 바로 아래다. */
  centerY: BASE_HEIGHT - 48,
  height: 64,
  /** 버튼 한 칸의 폭과 칸 사이 틈. */
  buttonWidth: 260,
  /** 세 칸일 때만 버전 표기를 피해 압축한다. 현재 두 버튼은 넓은 칸을 사용한다. */
  compactButtonWidth: 200,
  gap: 18,
  /** 한 줄에 서는 버튼의 상한. 이보다 늘면 줄을 나누는 설계가 먼저 필요하다. */
  maxButtons: 3,
} as const;

export interface TitleActionSlot {
  readonly x: number;
  readonly width: number;
}

/** 버튼 `count`개가 설 가로 자리를 왼쪽부터 돌려준다. 가운데 정렬이다. */
export function titleActionSlots(count: number): readonly TitleActionSlot[] {
  const { gap, maxButtons } = TITLE_ACTION_ROW;
  const n = Math.max(0, Math.min(Math.floor(count), maxButtons));
  const buttonWidth = n === maxButtons ? TITLE_ACTION_ROW.compactButtonWidth : TITLE_ACTION_ROW.buttonWidth;
  const total = n * buttonWidth + Math.max(0, n - 1) * gap;
  const left = (BASE_WIDTH - total) / 2;
  return Array.from({ length: n }, (_, i) => ({ x: left + buttonWidth / 2 + i * (buttonWidth + gap), width: buttonWidth }));
}

/** 아이콘과 라벨이 서로의 영역을 침범하지 않는 공용 내부 배치다. */
export function titleActionContent(width: number): { iconX: number; labelX: number; labelWidth: number } {
  const iconX = -width / 2 + 28;
  const left = iconX + 15 + 12;
  const right = width / 2 - 14;
  return { iconX, labelX: (left + right) / 2, labelWidth: right - left };
}

/**
 * 타이틀 중단의 로딩 줄 자리. 아래 버튼 줄과 안전한 여백을 두려고 한곳에서 정한다.
 * 진입 문구(로딩 중에는 진행률 숫자)가 위, 로딩 칸이 그 아래이며 칸 아래 끝이 버튼 줄 윗변에서
 * `TITLE_LOADING_LAYOUT.buttonGap` 이상 떨어져 있어야 한다(`titleActionLayout.test.ts`).
 */
export const TITLE_LOADING_LAYOUT = {
  promptY: BASE_HEIGHT * 0.86,
  diamondsY: BASE_HEIGHT * 0.91,
  /** 로딩 칸 한 개의 바깥 반지름(`LoadingDiamonds`의 OUTER). */
  diamondRadius: 30,
  /** 로딩 칸 아래 끝과 버튼 줄 윗변 사이에 최소로 남기는 여백. */
  buttonGap: 56,
} as const;

/**
 * 처음 여는 기기의 로그인 버튼 줄. 로딩 칸이 사라진 자리에 세로로 쌓이고, 아래 끝은 하단 버튼 줄
 * 윗변에서 `bottomGap` 위에 닿는다. 개수에서 자리를 구하므로 버튼을 더해도 좌표를 옮기지 않는다.
 */
export const TITLE_LOGIN_LAYOUT = {
  width: 600,
  height: 92,
  gap: 20,
  /** 하단 버튼 줄 윗변과 맨 아래 버튼 사이의 여백. */
  bottomGap: 56,
  /** 한 번에 서는 버튼의 상한. */
  maxButtons: 5,
} as const;

/** 로그인 버튼 `count`개의 가운데 y를 위에서 아래로 돌려준다. 맨 아래가 하단 줄 위에 붙는다. */
export function titleLoginSlots(count: number): readonly number[] {
  const { height, gap, bottomGap, maxButtons } = TITLE_LOGIN_LAYOUT;
  const n = Math.max(0, Math.min(Math.floor(count), maxButtons));
  const bottom = TITLE_ACTION_ROW.centerY - TITLE_ACTION_ROW.height / 2 - bottomGap;
  return Array.from({ length: n }, (_, i) => bottom - height / 2 - (n - 1 - i) * (height + gap));
}
