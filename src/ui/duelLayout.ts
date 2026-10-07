import type { DuelTierId } from "../core/duelArena";
import { BASE_HEIGHT } from "../config/gameConfig";

/**
 * 결투장 화면의 자리.
 *
 * **Phaser 없는 순수 표**다 — 판끼리 겹치지 않는지는 눈으로 확인할 수 없는 값이라 화면과 회귀 테스트가
 * 같은 표를 읽는다(`tests/unit/duelLayout.test.ts`). 화면 폭은 1080, 좌표는 화면 좌표다.
 *
 * 씬은 **내 자리를 보여 주는 무대**다 — 위에서부터 티어 휘장 → 점수 게이지 → 전투 프로필 →
 * 방어·도전 → 좌하단 「대전」·「전적」 라벨이다. 상대 고르기는 도전이 여는 팝업, 순위는 왼쪽 칩이 연다.
 * 한 화면에 상대 셋·방어덱·링크 줄까지 쌓던 때는 무엇이 이 화면의 주 조작인지가 크기로 읽히지 않았다.
 */
export const DUEL_SCREEN = {
  side: 60,
  width: 960,
  title: { y: 160 },
  season: { y: 222 },
  /** 왼쪽 칩 줄 — 순위(위)와 결투 상점(아래). 연구소·고고학의 상점 칩과 같은 크기다. */
  rankChip: { x: 112, y: 380, size: 104 },
  shopChip: { x: 112, y: 556, size: 104 },
  emblem: { x: 540, y: 420, size: 220 },
  tierName: { y: 568 },
  gauge: { y: 636, width: 500, height: 26, nextSize: 58 },
  /** 전투 프로필 판의 세로 자리(`DUEL_PROFILE`이 판 안을 갖는다). */
  profile: { y: 1035, top: 710, bottom: 1360 },
  seasonReward: { y: 1450, width: 300, height: 72 },
  /** 하단 두 조작. 방어는 작은 판, 도전은 화면의 주 조작이라 크다. */
  actions: { y: 1650, height: 160, defense: { x: 60, width: 330 }, challenge: { x: 410, width: 610 }, faceSize: 78, faceGap: 90 },
  /** 좌하단 라벨 줄 — 가방·고고학과 같은 `CategoryTab`. 오른쪽 아래는 공용 뒤로가기 자리다. */
  tabs: { y: BASE_HEIGHT - 96, width: 240, height: 84, gap: 16 },
  /** 전적 탭 목록. */
  history: { titleY: 300, top: 370, bottom: 1730, rowHeight: 176, rowGap: 14, faceSize: 92, unitSize: 64 },
} as const;

/**
 * 전투 프로필 판 안 — 판 가운데가 0인 로컬 좌표다. 왼쪽이 플레이어 얼굴(프로필 사진 + 테두리)과 이름·레벨·전적,
 * 오른쪽이 티어 셋과 연승 줄이다. 얼굴의 테두리 장식은 가운데에서 `size × PROFILE_FRAME_REACH`까지 뻗는다.
 */
export const DUEL_PROFILE = {
  y: DUEL_SCREEN.profile.y,
  width: DUEL_SCREEN.width,
  height: DUEL_SCREEN.profile.bottom - DUEL_SCREEN.profile.top,
  padX: 40,
  avatar: { x: -275, y: -80, size: 210, nameY: 110, nameRoom: 330, levelY: 152, recordY: 194 },
  rows: { labelX: -90, emblemX: 90, emblemSize: 64, valueX: 136, firstY: -195, gap: 130, bonusChip: { width: 220, height: 54 } },
} as const;

/** 프로필 오른쪽 줄 `index`(0 현재 · 1 시즌 최고 · 2 지난 시즌 · 3 연승)의 중심 y. */
export function duelProfileRowY(index: number): number {
  return DUEL_PROFILE.rows.firstY + index * DUEL_PROFILE.rows.gap;
}

/** 라벨 `index`의 가운데 x. */
export function duelTabX(index: number): number {
  const { width, gap } = DUEL_SCREEN.tabs;
  return DUEL_SCREEN.side + width / 2 + index * (width + gap);
}

/** 전적 줄 `index`(0부터)의 중심 y — 목록 컨테이너 안의 좌표다. */
export function duelHistoryRowY(index: number): number {
  const { rowHeight, rowGap } = DUEL_SCREEN.history;
  return index * (rowHeight + rowGap) + rowHeight / 2;
}

/** 전적 줄 수에서 끌어 올릴 수 있는 한계(음수). 창보다 짧으면 0이다. */
export function duelHistoryMinScroll(rows: number): number {
  const { top, bottom, rowHeight, rowGap } = DUEL_SCREEN.history;
  const content = rows > 0 ? rows * (rowHeight + rowGap) - rowGap : 0;
  return Math.min(0, bottom - top - content);
}

/**
 * 상대 선택 팝업 — 줄 하나가 상대 하나다. `y`는 팝업 가운데가 0인 로컬 좌표다.
 *
 * 줄 안은 왼쪽부터 **애착 렐릭 얼굴 → 이름·티어(옆에 점수)·전투력 → 방어덱 셋 → 도전**이다.
 */
export const DUEL_OPPONENT_POPUP = {
  width: 980,
  rowWidth: 920,
  rowHeight: 196,
  rowGap: 14,
  top: 100,
  bottomRoom: 150,
  faceX: -370,
  faceSize: 120,
  textX: -290,
  /** 이름·티어 줄이 쓸 수 있는 폭 — 넘치면 글자를 가로로 누른다. */
  textRoom: 300,
  unitX: 60,
  unitGap: 94,
  unitSize: 86,
  challengeX: 375,
  challengeWidth: 140,
  challengeHeight: 108,
  refresh: { width: 300, height: 76 },
} as const;

/** 상대 `count`명을 담는 팝업 높이. 손으로 적지 않고 줄 수에서 거꾸로 구한다. */
export function duelOpponentPopupHeight(count: number): number {
  const { top, bottomRoom, rowHeight, rowGap } = DUEL_OPPONENT_POPUP;
  return top + Math.max(1, count) * (rowHeight + rowGap) - rowGap + bottomRoom;
}

/** 상대 줄 `index`의 중심 y(팝업 로컬). */
export function duelOpponentRowY(index: number, count: number): number {
  const { top, rowHeight, rowGap } = DUEL_OPPONENT_POPUP;
  return -duelOpponentPopupHeight(count) / 2 + top + rowHeight / 2 + index * (rowHeight + rowGap);
}

/**
 * 순위표 머리의 시상대 — 1등이 가운데에서 가장 높고 2·3등이 양옆에 선다. 목록과 함께 흐르는 머리라
 * 줄 규격(`RANKING_LIST`)은 그대로 두고 목록이 이 높이만큼 아래에서 시작한다.
 */
export const DUEL_PODIUM = {
  height: 330,
  /** 등수 순서(1·2·3)의 가로 자리와 단 높이. */
  spots: [
    { x: 0, plinth: 120, face: 132 },
    { x: -270, plinth: 82, face: 112 },
    { x: 270, plinth: 60, face: 112 },
  ],
  plinthWidth: 220,
  /** 단 밑변 — 시상대 머리 안의 y. */
  baseY: 300,
} as const;

/**
 * 결투장 순위표의 흐르는 창과 **아래에 붙박인 내 줄**. `y`는 팝업 가운데가 0인 로컬 좌표다(판 높이 1740).
 *
 * 내 줄을 목록 위에 따로 세우던 때는 시상대·1등보다 내가 먼저 읽혔다 — 순위표는 위에서부터 읽는 판이라
 * 내 자리는 맨 아래에 붙어 목록이 흐르는 동안에도 그 자리를 지킨다. 목록 창은 그 줄 위의 구분선에서 끝난다.
 */
export const DUEL_RANKING_VIEW = {
  viewport: { top: -740, bottom: 640 },
  divider: 660,
  meY: 730,
} as const;

/** 순위표 오른쪽 위의 「티어」 버튼 — 판 오른쪽 변과 윗변에서 잰 자리. */
export const DUEL_RANKING_TIER_BUTTON = { right: 120, top: 76, width: 200, height: 68 } as const;

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
