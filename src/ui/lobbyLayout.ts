import { BASE_HEIGHT, BASE_WIDTH } from "../config/gameConfig";

/** BottomNav와 같은 기준선이며 로비 배치 검증이 Phaser 구현을 import하지 않게 한다. */
export const LOBBY_NAV_TOP = BASE_HEIGHT - 180;

/** 입력 충돌 검증에서도 런타임과 같은 중심점·크기를 쓰기 위한 로비 버튼 상자다. */
export interface LobbyInputBounds { x: number; y: number; width: number; height: number }

/** 레일 버튼의 실제 입력면과 눌림 확대를 고려한 슬롯 간격을 한곳에서 소유한다. */
const RAIL = { leftX: 106, rightX: BASE_WIDTH - 106, top: 640, step: 152, size: 96 } as const;

/** 역할별 레일 배치표: 임무 콘텐츠는 왼쪽, 가방을 포함한 편의 기능은 오른쪽에 분리한다. */
export const LOBBY_RAIL_BOUNDS = {
  content: {
    mission: { x: RAIL.leftX, y: RAIL.top, width: RAIL.size, height: RAIL.size },
    shop: { x: RAIL.leftX, y: RAIL.top + RAIL.step, width: RAIL.size, height: RAIL.size },
  },
  utility: {
    mail: { x: RAIL.rightX, y: RAIL.top, width: RAIL.size, height: RAIL.size },
    friends: { x: RAIL.rightX, y: RAIL.top + RAIL.step, width: RAIL.size, height: RAIL.size },
    inventory: { x: RAIL.rightX, y: RAIL.top + RAIL.step * 2, width: RAIL.size, height: RAIL.size },
  },
} as const satisfies Record<string, Record<string, LobbyInputBounds>>;

/** 상단 프로필과 홍보 칸을 합친 금지 영역으로 레일과의 세로 여백을 검증한다. */
export const LOBBY_UPPER_BOUNDS: LobbyInputBounds = { x: BASE_WIDTH / 2, y: 158, width: BASE_WIDTH, height: 316 };

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
