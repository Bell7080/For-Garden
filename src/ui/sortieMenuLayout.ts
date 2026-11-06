import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/**
 * 로비 출격판의 자리. 판은 화면 가운데에서 `offsetY`만큼 올라 서고, 칸은 판 몸 가운데(0)를 기준으로 선다.
 *
 * 칸의 세로 자리를 화면(`LobbyScene`)과 E2E가 **같은 표**에서 읽는다 — 판을 올리며 칸이 옮겨 간 날
 * 스펙에 손으로 적어 둔 `y = 550`이 스토리 칸과 던전 칸 사이 빈자리를 눌러, 출격판을 지나는 모든 편이
 * 지도에 닿지 못한 채 실패했다.
 */
export const SORTIE_MENU_PANEL = { width: 980, height: 1330, offsetY: -75 } as const;

/** 칸마다 판 몸 기준 가운데 y. 두 던전은 같은 줄에 좌우(`x`)로 나란히 선다. */
export const SORTIE_ENTRY_SPOT = {
  story: { x: 0, y: -455 },
  cake: { x: -204, y: -169 },
  bounty: { x: 204, y: -169 },
  raid: { x: 0, y: 107 },
  expedition: { x: 0, y: 398 },
  ancient: { x: 0, y: 689 },
} as const;
export type SortieEntryId = keyof typeof SORTIE_ENTRY_SPOT;

/** 출격판이 굴러가지 않은 상태에서 그 칸의 화면 좌표(기준 1080×1920). */
export function sortieEntryScreenPoint(id: SortieEntryId): { x: number; y: number } {
  const spot = SORTIE_ENTRY_SPOT[id];
  return { x: BASE_WIDTH / 2 + spot.x, y: BASE_HEIGHT / 2 + SORTIE_MENU_PANEL.offsetY + spot.y };
}
