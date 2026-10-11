import { BASE_WIDTH } from "../config/gameConfig";
import { LOBBY_RAIL_BOUNDS, type LobbyInputBounds } from "./lobbyLayout";

/**
 * 로비 메뉴(햄버거)의 자리.
 *
 * 가방 바로 아래에 서는 작은 단추다. 가방 아래는 결투 버튼 위의 빈 띠이고 로비 대사창이 그 띠에
 * 서므로, 대사창 폭은 이 단추 왼쪽에서 끝난다(`LOBBY_DIALOGUE`). 단추가 가방과 같은 크기면 결투
 * 버튼과 겹치므로 한 단 작게 둔다.
 */
const BUTTON_SIZE = 72;
const bag = LOBBY_RAIL_BOUNDS.utility.inventory;

export const LOBBY_MENU_BUTTON: LobbyInputBounds = {
  x: bag.x,
  y: bag.y + bag.height / 2 + 16 + BUTTON_SIZE / 2,
  width: BUTTON_SIZE,
  height: BUTTON_SIZE,
};

/** 한 줄짜리 메뉴 판. 단추 왼쪽에서 옆으로 슉 나온다. */
export const LOBBY_MENU_TRAY = {
  chip: 92,
  gap: 20,
  padX: 24,
  height: 128,
  /** 판 오른쪽 끝과 단추 사이. */
  gapToButton: 14,
  slideMs: 220,
} as const;

/** 칩 개수에서 판의 상자와 칩 중심들을 구한다. 좌표를 화면에 손으로 적지 않는다. */
export function lobbyMenuTrayLayout(chipCount: number) {
  const { chip, gap, padX, height, gapToButton } = LOBBY_MENU_TRAY;
  const width = padX * 2 + chip * chipCount + gap * (chipCount - 1);
  const right = LOBBY_MENU_BUTTON.x - LOBBY_MENU_BUTTON.width / 2 - gapToButton;
  const left = right - width;
  const y = LOBBY_MENU_BUTTON.y;
  const chips = Array.from({ length: chipCount }, (_, index) => ({ x: left + padX + chip / 2 + index * (chip + gap), y }));
  const bounds: LobbyInputBounds = { x: left + width / 2, y, width, height };
  /** 접힌 판이 화면 밖으로 완전히 나가는 이동 거리. */
  const slideOut = BASE_WIDTH - left + 24;
  return { bounds, chips, width, slideOut };
}
