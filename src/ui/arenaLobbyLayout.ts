import { DUEL_SCREEN } from "./duelLayout";

/**
 * 아레나 입구의 자리 — 결투장 입구(`DUEL_SCREEN`·`DUEL_PROFILE`)와 **같은 자리**에 같은 것이 선다.
 * 왼쪽 순위 칩(주간 보상·티어 표는 순위표 창 안에서 연다), 가운데 휘장·게이지, 전투 프로필, 아래 도움말 버튼과 매칭 버튼이다.
 * 규칙 글은 늘 떠 있지 않고 도움말 쪽지(`ArenaHelpPopup`)가 연다.
 * 두 PvP 입구가 같은 구도라 오가도 무엇이 어디 있는지 다시 찾지 않는다.
 */
export const ARENA_LOBBY = {
  ...DUEL_SCREEN,
  help: { y: 1500, width: 300, height: 84 },
  match: { y: 1650, width: 960, height: 140 },
} as const;
