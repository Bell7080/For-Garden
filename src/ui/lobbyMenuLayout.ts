import { BASE_WIDTH } from "../config/gameConfig";
import { LOBBY_RAIL_BOUNDS, LOBBY_RAIL_SIZE, LOBBY_RAIL_STEP, type LobbyInputBounds } from "./lobbyLayout";

/**
 * 로비 메뉴(햄버거)의 자리.
 *
 * 가방 바로 아래에 서는 단추다. 다른 레일 버튼과 같은 크기이고 칸 간격도 같아서 가방과의 여백이
 * 위쪽 칸들과 똑같다. 로비 대사창이 그 띠에 서므로 대사창 폭은 이 단추 왼쪽에서 끝난다(`LOBBY_DIALOGUE`).
 */
const BUTTON_SIZE = LOBBY_RAIL_SIZE;
const bag = LOBBY_RAIL_BOUNDS.utility.inventory;

export const LOBBY_MENU_BUTTON: LobbyInputBounds = {
  x: bag.x,
  y: bag.y + LOBBY_RAIL_STEP,
  width: BUTTON_SIZE,
  height: BUTTON_SIZE,
};

/**
 * 한 줄짜리 메뉴 판. 누르면 단추가 사라지고, 그 자리에 판의 오른쪽 끝과 세로 중심을 맞춰 왼쪽으로
 * 펼쳐진다. 칩은 레일 버튼과 같은 크기다.
 */
export const LOBBY_MENU_TRAY = {
  chip: LOBBY_RAIL_SIZE,
  gap: 24,
  padX: 32,
  height: LOBBY_RAIL_STEP,
  slideMs: 220,
} as const;

/** 칩 개수에서 판의 상자와 칩 중심들을 구한다. 좌표를 화면에 손으로 적지 않는다. */
export function lobbyMenuTrayLayout(chipCount: number) {
  const { chip, gap, padX, height } = LOBBY_MENU_TRAY;
  const width = padX * 2 + chip * chipCount + gap * (chipCount - 1);
  const right = LOBBY_MENU_BUTTON.x + LOBBY_MENU_BUTTON.width / 2;
  const left = right - width;
  const y = LOBBY_MENU_BUTTON.y;
  const chips = Array.from({ length: chipCount }, (_, index) => ({ x: left + padX + chip / 2 + index * (chip + gap), y }));
  const bounds: LobbyInputBounds = { x: left + width / 2, y, width, height };
  /** 접힌 판이 화면 밖으로 완전히 나가는 이동 거리. */
  const slideOut = BASE_WIDTH - left + 24;
  return { bounds, chips, width, slideOut };
}
