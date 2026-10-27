/**
 * 친선전 선택판과 아레나 설정 창의 자리. 선택판은 결투 선택판(`PVP_MENU`)과 같은 판 폭·같은 칸 크기를 쓰고,
 * 설정 창은 대치 띠 → 규칙 줄 넷 → 보내기 순으로 쌓인 높이에서 창 높이를 거꾸로 구한다.
 */
export const ARENA_FRIEND_MENU = {
  width: 980,
  pad: { top: 100, bottom: 96 },
  gap: 60,
  entry: { width: 800, height: 260 },
  tag: { width: 250, height: 46 },
} as const;

export const ARENA_SETUP = {
  width: 980,
  rowWidth: 900,
  pad: { top: 84, bottom: 64 },
  banner: { width: 900, height: 300, face: 140, faceX: 300, nameRoom: 250, mascot: 168, mascotLift: 120 },
  bannerGap: 30,
  row: { height: 150, gap: 16, icon: 100, iconPad: 22, textRoom: 330, chip2: 172, chip3: 122, chipGap: 10, chipPad: 22, chipHeight: 76 },
  error: 56,
  send: { width: 820, height: 128 },
} as const;

/** 줄 수에서 창 높이와 각 덩어리의 중심 y(창 가운데 기준)를 구한다. */
export function arenaSetupLayout(rows: number): { height: number; bannerY: number; rowY: number[]; errorY: number; sendY: number } {
  const S = ARENA_SETUP;
  const rowsHeight = rows * S.row.height + (rows - 1) * S.row.gap;
  const height = S.pad.top + S.banner.height + S.bannerGap + rowsHeight + S.error + S.send.height + S.pad.bottom;
  let top = -height / 2 + S.pad.top;
  const bannerY = top + S.banner.height / 2;
  top += S.banner.height + S.bannerGap;
  const rowY = Array.from({ length: rows }, (_, i) => top + i * (S.row.height + S.row.gap) + S.row.height / 2);
  top += rowsHeight;
  const errorY = top + S.error / 2;
  const sendY = top + S.error + S.send.height / 2;
  return { height, bannerY, rowY, errorY, sendY };
}
