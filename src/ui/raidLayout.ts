/**
 * 레이드 화면의 **순수 배치표** — Phaser를 읽지 않는다.
 *
 * 화면이 좌표를 손으로 적지 않는 이유는 이 판이 위에서부터 보스 · 남은 체력 · 기여 목록 ·
 * 하단 조작으로 쌓이는데, 그 사이를 눈대중으로 잡으면 한 줄이 늘거나 줄 때마다 아래가 전부
 * 어긋나기 때문이다. 간격은 `tests/unit/raidLayout.test.ts`가 지킨다.
 */

import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 보스가 서는 자리.
 *
 * 전신 원화는 **머리 관절이 아니라 바닥선**으로 세운다 — 레이드는 그 한 마리만 보는 화면이라
 * 인물이 화면 아래 절반을 차지하고, 위로는 남은 체력 줄이 걸린다.
 */
export const RAID_BOSS_SPOT = { centerX: BASE_WIDTH / 2, bottom: 980, height: 720 } as const;

/** 남은 체력 게이지. 보스 발밑을 지나 화면 폭을 거의 다 쓴다. */
export const RAID_HP_BAR = {
  centerX: BASE_WIDTH / 2,
  y: 1040,
  width: 880,
  height: 46,
  /** 남은 체력을 눈금으로도 셈하게 한다. 한 칸이 전체의 1/8이다. */
  ticks: 7,
  /** 게이지 위의 이름표와 아래의 수치가 앉는 자리. */
  labelY: 992,
  valueY: 1094,
} as const;

/**
 * 기여 목록이 흐르는 창.
 *
 * 순위표와 **같은 줄 규격**(`RANKING_LIST`)을 쓰되 자리만 이 화면에 맞춘다 — 같은 모양의
 * 목록이 화면마다 다른 줄 높이로 서면 같은 정보가 두 양식으로 읽힌다.
 */
export const RAID_BOARD = {
  titleY: 1168,
  viewport: { top: 1216, bottom: BASE_HEIGHT - 232 },
  centerX: BASE_WIDTH / 2,
} as const;

/**
 * 하단 조작.
 *
 * 이 화면이 하는 일은 보스에게 들어가는 것 하나뿐이라 버튼도 하나다. 전리품 상점은 출격판
 * 밖이 맡는다 — 레이드와 원정의 증표를 함께 쓰는 자리를 레이드 안에 두면, 원정 증표를
 * 쓰려고 레이드를 거쳐 들어가게 된다. 우하단은 공용 뒤로가기 자리라 그 위를 지나지 않는다.
 */
export const RAID_ACTIONS = {
  y: BASE_HEIGHT - 132,
  sortie: { centerX: 716, width: 420, height: 124 },
} as const;

/**
 * 남은 체력 게이지의 색.
 *
 * 체력 바가 아니라 **깎아 내는 표적**이라 아군 체력의 연두가 아니고, 전장에서 아군이 받는
 * 피해와 같은 붉은 계열이다 — 이 화면에서 그 색이 뜻하는 것은 "여기를 민다"이다.
 */
export const RAID_HP_BAR_COLOR = 0xd2463c;

/** 시즌 머리글 — 제목, 초기화 시각, 남은 도전 횟수. */
export const RAID_HEADER = { titleX: 76, titleY: 132, seasonY: 196, attemptsY: 236 } as const;

/** 목록이 흐르는 창의 높이와 중심. 마스크와 입력면이 같은 값을 쓴다. */
export function raidBoardViewport(): { height: number; centerY: number } {
  const { top, bottom } = RAID_BOARD.viewport;
  return { height: bottom - top, centerY: (top + bottom) / 2 };
}
