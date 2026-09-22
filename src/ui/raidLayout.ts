/**
 * 레이드 화면의 **순수 배치표** — Phaser를 읽지 않는다.
 *
 * 화면이 좌표를 손으로 적지 않는 이유는 이 판이 위에서부터 보스 · 남은 체력 · 기여 목록 ·
 * 하단 조작으로 쌓이는데, 그 사이를 눈대중으로 잡으면 한 줄이 늘거나 줄 때마다 아래가 전부
 * 어긋나기 때문이다. 간격은 `tests/unit/raidLayout.test.ts`가 지킨다.
 */

import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";

/**
 * 보스가 서는 자리.
 *
 * **원정 기록 화면과 같은 문법이다**(`RANKING.boss`) — 발끝을 화면 아래로 내보내고 크게 세워
 * 화면 위쪽에 **상반신만** 남긴다. 상자에 맞춰 줄이면 그 한 마리만 보는 화면인데 얼굴보다
 * 여백이 먼저 읽힌다. 두 화면이 같은 값을 쓰는 이유는 시즌 보스를 세우는 일이 같은 일이기
 * 때문이고, 다르게 적으면 같은 개체가 원정에서는 크고 레이드에서만 작게 선다.
 *
 * 아래 절반은 그리지 않는 것이 아니라 **어둠에 잠긴다**(`fade`) — 자르면 그 선이 가로줄로
 * 보이고, 그대로 두면 기여 목록의 유리 줄 뒤로 다리가 비쳐 목록이 흐려진다. 검정→투명
 * 그라데이션 한 겹이 남은 체력 줄의 배경도 함께 맡는다.
 */
export const RAID_BOSS_SPOT = {
  centerX: BASE_WIDTH / 2,
  groundY: BASE_HEIGHT + 40,
  height: 1720,
  /** 원화가 잠기는 띠. 위는 투명, 아래는 짙은 검정이고 아랫변이 목록 윗변에 닿는다. */
  fade: { top: 760, bottom: 1216 },
} as const;

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
 * **이 줄에 서는 것은 출격 하나뿐이다.** 전리품 상점 입구는 로비 출격판 밖 줄이 이미 갖고
 * 있어, 레이드 화면에도 같은 문을 달아 두면 같은 가게로 들어가는 입구가 둘이 된다 — 증표를
 * 쓰러 가는 길은 한 자리로 충분하다. 그래서 출격이 화면 가운데를 그대로 쓴다.
 *
 * 우하단은 공용 뒤로가기 자리라 그 위를 지나지 않는다.
 */
export const RAID_ACTIONS = {
  y: BASE_HEIGHT - 132,
  sortie: { centerX: BASE_WIDTH / 2, width: 420, height: 124 },
} as const;

/** 출격이 우하단 공용 뒤로가기와 벌린 가로 간격이다. 양수여야 한다. */
export function raidSortieBackGap(): number {
  return (BACK_SLOT.x - BACK_BUTTON_SIZE / 2) - (RAID_ACTIONS.sortie.centerX + RAID_ACTIONS.sortie.width / 2);
}

/**
 * 편성 단계.
 *
 * **원정과 같은 순서다** — 들어가면 시즌 판(보스 전신 + 기여 목록)이 먼저 뜨고, 출격이 편성을
 * 연다. 눌리는 즉시 전투로 넘어가던 때는 누구를 데려갈지 정할 자리가 없어, 하루 세 번뿐인
 * 도전을 지난 판의 편성 그대로 치르게 됐다.
 *
 * 칸은 네 화면이 함께 쓰는 판 한 장(`addFormationSlotPlate`)이고, 목록은 도감·원정과 같은
 * 그리드 규칙을 쓴다. 이 표가 갖는 것은 자리뿐이다.
 */
export const RAID_PREPARATION = {
  titleY: 292,
  slots: { y: 560, firstX: 230, stepX: 310, width: 250, height: 290 },
  roster: { top: 780, bottom: 1520 },
  hintY: 1570,
  start: { y: 1690, width: 560, height: 132 },
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
