import type { DuelTierId } from "../core/duelArena";

/**
 * 결투장 화면의 자리.
 *
 * **Phaser 없는 순수 표**다 — 판끼리 겹치지 않는지는 눈으로 확인할 수 없는 값이라 화면과 회귀 테스트가
 * 같은 표를 읽는다(`tests/unit/duelLayout.test.ts`). 화면 폭은 1080, 좌표는 화면 좌표다.
 *
 * 위에서부터 **내 자리(티어·점수) → 도전권 줄 → 상대 셋 → 방어덱 → 곁들임 줄** 순이다. 먼저 읽혀야
 * 하는 것은 "지금 어디쯤인가"이고, 그다음이 "누구와 붙을까"다.
 */
export const DUEL_SCREEN = {
  side: 60,
  width: 960,
  title: { y: 150 },
  season: { y: 210 },
  standing: { y: 380, height: 250, emblemX: 190, emblemSize: 150, textX: 300 },
  attempts: { y: 565, buyX: 600, refreshX: 880, buttonWidth: 230, buttonHeight: 68 },
  opponents: { top: 650, height: 214, gap: 18, faceSize: 104, faceGap: 114, faceX: 540, challengeX: 920, challengeWidth: 170 },
  defense: { y: 1418, height: 170, faceX: 470, editX: 900 },
  links: { y: 1610, xs: [200, 440, 680], width: 220, height: 80 },
} as const;

/** 상대 칸 하나의 세로 가운데. */
export function duelOpponentY(index: number): number {
  const { top, height, gap } = DUEL_SCREEN.opponents;
  return top + height / 2 + index * (height + gap);
}

/** 상대 칸 셋이 끝나는 자리 — 방어덱 판은 그 아래에서 시작해야 한다. */
export function duelOpponentsBottom(count = 3): number {
  const { top, height, gap } = DUEL_SCREEN.opponents;
  return top + count * height + (count - 1) * gap;
}

/**
 * 티어의 색. 표식·이름·순위표의 작은 칩이 모두 이 표를 읽는다 — 화면마다 고르면 같은 골드가 어디서는
 * 누렇고 어디서는 주황이다. 낮은 티어는 금속빛, 다이아몬드부터는 보석빛, 챌린저만 밝은 금이다.
 */
export const DUEL_TIER_COLOR: Readonly<Record<DuelTierId, { fill: number; text: string }>> = {
  bronze: { fill: 0xc58a5a, text: "#e6b38a" },
  silver: { fill: 0xb9c6d2, text: "#dde6ef" },
  gold: { fill: 0xf2c45a, text: "#ffdf8a" },
  platinum: { fill: 0x5fd6c0, text: "#9ff0e0" },
  diamond: { fill: 0x6fb0ff, text: "#b3d6ff" },
  master: { fill: 0xb57aff, text: "#d9b8ff" },
  grandmaster: { fill: 0xff6b6b, text: "#ffaaaa" },
  challenger: { fill: 0xffe28a, text: "#fff1c2" },
};
