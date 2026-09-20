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
    // 무역은 상점 바로 아래에 선다. 사는 곳과 바꾸는 곳이라 같은 콘텐츠 레일에 이웃하되,
    trade: { x: RAIL.leftX, y: RAIL.top + RAIL.step * 2, width: RAIL.size, height: RAIL.size },
  },
  utility: {
    mail: { x: RAIL.rightX, y: RAIL.top, width: RAIL.size, height: RAIL.size },
    friends: { x: RAIL.rightX, y: RAIL.top + RAIL.step, width: RAIL.size, height: RAIL.size },
    inventory: { x: RAIL.rightX, y: RAIL.top + RAIL.step * 2, width: RAIL.size, height: RAIL.size },
  },
} as const satisfies Record<string, Record<string, LobbyInputBounds>>;

/**
 * 로비 대사창의 자리.
 *
 * **애착 렐릭의 허리께에 선다.** 예전에는 화면 위쪽(y 900)에 떠서 오른쪽 레일의 친구·가방
 * 아이콘과 왼쪽의 상점·무역을 통째로 덮었다 — 말을 듣는 동안 누를 것이 사라지는 자리였다.
 * 지금은 레일 세 줄이 끝나는 아래, 결투 버튼이 시작하는 위의 빈 띠에 선다: 얼굴도 가리지
 * 않고 조작도 가리지 않는 유일한 자리다.
 *
 * 높이는 여기서 정하지 않는다 — 공용 대사창이 실제 글 높이에서 거꾸로 구하고, 밑변을 여기에
 * 걸므로 대사가 길어져도 결투 버튼 쪽으로 자라지 않는다.
 */
export const LOBBY_DIALOGUE = { centerX: BASE_WIDTH / 2, width: 960, bottom: 1265 } as const;

/**
 * 오른 유대를 알리는 표식의 자리.
 *
 * 대사창 **밖**, 그 위 오른쪽이다 — 캐릭터가 한 말과 시스템이 준 보상이 한 판에 섞이지
 * 않으면서도 한 사건으로 읽힌다.
 */
export const LOBBY_BOND_MARK = { x: 780, y: LOBBY_DIALOGUE.bottom - 200 } as const;

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
