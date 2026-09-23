import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "./popupGeometry";

/**
 * 던전 입구(현상수배·치즈케이크 대작전)의 **세로 좌표 소유자**.
 *
 * 두 화면은 같은 일을 한다 — 단계를 고르고, 배율을 고르고, 출격하거나 소탕한다. 각자 배치표를
 * 갖던 때는 현상수배만 아래에 편성 칸을 세우고 대작전만 배율을 세워, 같은 손짓이 화면마다
 * 다른 자리에 섰다. 이제 한 표를 읽고, 편성은 두 곳 모두 **스토리와 같은 편성 화면**이 맡는다.
 *
 * **아래 세 줄(요약 판 · 배율 · 조작)은 목록 길이와 무관하게 같은 자리에 선다.** 목록 밑변에서
 * 거꾸로 쌓으면 단계가 다섯인 현상수배와 여덟인 대작전의 요약 판이 서로 다른 높이에 서서,
 * "같은 양식"이 자리부터 갈린다. 목록은 그 위에서 끝나야 하며 테스트가 그것을 지킨다.
 *
 * Phaser를 모르는 순수 표다 — 화면과 회귀 테스트가 같은 값을 읽는다.
 */
export const DUNGEON_LOBBY = {
  title: { x: 72, y: 190 },
  /** 제목 줄 오른쪽 끝의 곁들임 수(현상수배의 남은 입장). */
  headline: { x: BASE_WIDTH - 72, y: 190 },
  /** 목록 첫 줄의 **윗변**. */
  listTop: 250,
  row: {
    width: 920,
    height: 118,
    gap: 10,
    /** 줄 왼쪽 안쪽 여백 — 이름과 레벨이 서는 자리다. */
    padding: 34,
    /** 한 판의 보상 액자. 줄 오른쪽 끝에 선다. */
    rewardSize: 84,
    /** 그 판에 서는 적 얼굴(현상수배의 세 라운드). 보상 액자 왼쪽으로 늘어선다. */
    faceSize: 78,
    faceGap: 90,
  },
  /**
   * 고른 단계의 **적 전투력 · 보상** 판.
   *
   * 현상수배 아래에 서던 "출전 순서" 자리를 이 판이 맡는다. 순서는 편성 화면이 이미 적과 나란히
   * 보여 주므로 입구에서는 **들어갈지 말지를 정하는 두 수**만 남긴다.
   */
  summary: { y: 1368, width: 920, height: 136 },
  multiplier: { y: 1508, chipWidth: 150, chipHeight: 92, gap: 22 },
  action: { y: 1650, width: 400, height: 116, gap: 32 },
} as const;

/** 줄 `index`(0부터)의 중심 y. */
export function dungeonRowCenterY(index: number): number {
  const { listTop, row } = DUNGEON_LOBBY;
  return listTop + row.height / 2 + index * (row.height + row.gap);
}

/** 목록이 끝나는 세로 좌표(마지막 줄의 **밑변**). */
export function dungeonListBottom(count: number): number {
  const { listTop, row } = DUNGEON_LOBBY;
  return listTop + count * row.height + Math.max(0, count - 1) * row.gap;
}

/** 요약 판의 윗변. 목록은 그보다 위에서 끝나야 한다. */
export function dungeonSummaryTop(): number {
  return DUNGEON_LOBBY.summary.y - DUNGEON_LOBBY.summary.height / 2;
}

/** 배율 칩 `index`의 중심 x. 칩 묶음은 화면 가운데에 선다. */
export function dungeonMultiplierChipX(index: number, total: number): number {
  const { chipWidth, gap } = DUNGEON_LOBBY.multiplier;
  const span = total * chipWidth + (total - 1) * gap;
  return BASE_WIDTH / 2 - span / 2 + chipWidth / 2 + index * (chipWidth + gap);
}

/** 조작 버튼 `index`의 중심 x(0 = 출격, 1 = 소탕). */
export function dungeonActionButtonX(index: number): number {
  const { width, gap } = DUNGEON_LOBBY.action;
  const span = 2 * width + gap;
  return BASE_WIDTH / 2 - span / 2 + width / 2 + index * (width + gap);
}

/** 조작 줄 밑변이 우하단 뒤로가기 윗변보다 위인가. */
export function dungeonActionFitsAboveBackButton(): boolean {
  const bottom = DUNGEON_LOBBY.action.y + DUNGEON_LOBBY.action.height / 2;
  return bottom <= BACK_SLOT.y - BACK_BUTTON_SIZE / 2 && bottom <= BASE_HEIGHT;
}

/** 줄 안에서 `slot`번째 적 얼굴의 x(줄 중심 기준). 보상 액자 왼쪽에서부터 왼쪽으로 늘어선다. */
export function dungeonRowFaceX(slot: number, count: number): number {
  const { width, padding, rewardSize, faceGap } = DUNGEON_LOBBY.row;
  const right = width / 2 - padding - rewardSize - 36;
  return right - (count - 1 - slot) * faceGap - DUNGEON_LOBBY.row.faceSize / 2;
}
