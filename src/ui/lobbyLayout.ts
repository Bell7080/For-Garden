import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/** BottomNav의 180px 높이와 같은 순수 레이아웃 기준으로 Phaser 없이 테스트할 수 있게 한다. */
const LOBBY_NAV_TOP = BASE_HEIGHT - 180;

/** 입력 충돌 검증에서도 런타임과 같은 중심점·크기를 쓰기 위한 로비 버튼 상자다. */
export interface LobbyInputBounds { x: number; y: number; width: number; height: number }

/** 임무는 편의 기능 레일과 분리해 프로필·홍보·중앙 무대를 비운 왼쪽 가장자리에 둔다. */
export const LOBBY_MISSION_ENTRY: LobbyInputBounds = { x: 106, y: 1120, width: 96, height: 96 };

/** 원정·출격의 실제 Button 입력 크기를 레이아웃 회귀 테스트와 공유한다. */
export const LOBBY_ACTION_BOUNDS = {
  expedition: { x: BASE_WIDTH - 250, y: LOBBY_NAV_TOP - 400, width: 292, height: 106 },
  sortie: { x: BASE_WIDTH - 290, y: LOBBY_NAV_TOP - 245, width: 520, height: 170 },
  bottomNav: { x: BASE_WIDTH / 2, y: (LOBBY_NAV_TOP + BASE_HEIGHT) / 2, width: BASE_WIDTH, height: BASE_HEIGHT - LOBBY_NAV_TOP },
} as const satisfies Record<string, LobbyInputBounds>;

/** 두 입력면이 닿는 경우도 안전 간격이 없는 충돌로 취급한다. */
export function lobbyBoundsIntersect(a: LobbyInputBounds, b: LobbyInputBounds): boolean {
  return Math.abs(a.x - b.x) * 2 <= a.width + b.width
    && Math.abs(a.y - b.y) * 2 <= a.height + b.height;
}

/** 가장 가까운 축의 양수 간격이며, 겹치면 음수가 되어 회귀 원인을 바로 보여 준다. */
export function lobbyBoundsGap(a: LobbyInputBounds, b: LobbyInputBounds): number {
  const horizontal = Math.abs(a.x - b.x) - (a.width + b.width) / 2;
  const vertical = Math.abs(a.y - b.y) - (a.height + b.height) / 2;
  return Math.max(horizontal, vertical);
}
