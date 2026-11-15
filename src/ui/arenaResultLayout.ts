/**
 * 아레나 결과판의 자리 — 판 가운데를 원점으로 한 세로 좌표.
 *
 * 위에서부터 모드 칩 → 큰 표제(승리·패배·무승부)와 그 뒤의 빗금 띠 → 끝난 사유 → 두 편이 마주 보는 VS 줄(얼굴 ·
 * 이름 · 세 자리 얼굴) → 랭크전이면 RP 블록(결투장과 같은 `addDuelStandingRow`), 친선전이면 변동 없음 한 줄 →
 * 조작 줄(기여도 · 친선전 다시 하기)이다. 판 높이는 블록 끝에서 거꾸로 구한다.
 */
export const ARENA_RESULT = {
  width: 960,
  mode: { y: -520, width: 210, height: 50, font: 24 },
  banner: { y: -425, height: 150, font: 96, stripe: 1100 },
  reason: { y: -320, font: 24, wrap: 820 },
  versus: { y: -190, avatar: 116, nameY: 92, nameFont: 30, sideX: 250, vsFont: 64, crownY: -96 },
  team: { y: -18, frame: 84, gap: 14 },
  standing: { y: 92 },
  friendly: { y: 170, font: 26 },
  actions: { y: 420, width: 340, height: 88, gap: 26 },
  height: 1180,
  hintFromBottom: 130,
} as const;

/** 한 편의 세 얼굴이 서는 x(편 가운데 기준). */
export function arenaResultTeamX(index: number, count: number): number {
  const { frame, gap } = ARENA_RESULT.team;
  return (index - (count - 1) / 2) * (frame + gap);
}

/** 조작 줄의 버튼 x. 하나면 가운데다. */
export function arenaResultActionX(index: number, count: number): number {
  const { width, gap } = ARENA_RESULT.actions;
  return (index - (count - 1) / 2) * (width + gap);
}
