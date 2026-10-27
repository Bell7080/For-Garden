import { DUEL_SCREEN } from "./duelLayout";

/**
 * 아레나 입구의 자리 — 결투장 입구(`DUEL_SCREEN`·`DUEL_PROFILE`)와 **같은 자리**에 같은 것이 선다.
 * 왼쪽 칩(순위 · 주간 보상), 가운데 휘장·게이지, 전투 프로필, 아래 규칙 한 줄과 매칭 버튼이다.
 * 두 PvP 입구가 같은 구도라 오가도 무엇이 어디 있는지 다시 찾지 않는다.
 */
export const ARENA_LOBBY = {
  ...DUEL_SCREEN,
  rewardChip: DUEL_SCREEN.shopChip,
  rules: { y: 1462, wrap: 900 },
  match: { y: 1650, width: 960, height: 140 },
} as const;
