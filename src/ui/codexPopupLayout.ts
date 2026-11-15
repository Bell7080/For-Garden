/**
 * 도감 창의 자리는 팝업 본문 원점(화면 중앙)을 기준으로 이 표 하나가 갖는다.
 *
 * 판 크기와 하단 줄은 업적 창과 같다 — 위에서부터 **기록 점수 요약 → 얼굴 격자 → 하단 줄(아군·적 탭 ·
 * 모두 받기)** 순이다. 요약은 점수 게이지와 다음 마디의 보상 액자를 함께 세워 「얼마나 더 만나면 무엇을
 * 받나」를 한 줄로 말한다.
 */
export const CODEX_POPUP_LAYOUT = {
  popup: { widthInset: 70, heightInset: 210 },
  summary: {
    panelY: -690, panelHeight: 196,
    headerY: -742,
    barY: -664, barHeight: 26,
    /** 오른쪽 다음 마디 칸의 폭. 게이지는 그 앞에서 끝난다. */
    rewardWidth: 250,
    rewardSize: 112,
  },
  /** 얼굴 격자 창 — 요약 아래에서 시작해 탭 한 뼘 위에서 끝나며, 그 안에서만 흐른다. */
  grid: { top: -566, bottom: 588, columns: 5, cell: 156, gap: 24, nameGap: 14, nameSize: 22, rowGap: 34, width: 920 },
  footer: {
    tabY: 652,
    tab: { width: 220, height: 76, gap: 12 },
    claim: { x: 0, y: 772, width: 380, height: 92 },
  },
} as const;

export type CodexTab = "ally" | "enemy";
export const CODEX_TABS: readonly CodexTab[] = ["ally", "enemy"];

/** 한 칸이 차지하는 세로 — 얼굴 액자 + 이름 한 줄 + 줄 사이. */
export function codexRowStride(): number {
  const { grid } = CODEX_POPUP_LAYOUT;
  return grid.cell + grid.nameGap + grid.nameSize + grid.rowGap;
}

/** 그 칸의 얼굴 가운데 — 격자 창의 윗변이 0이다. */
export function codexCellSpot(index: number): { x: number; y: number } {
  const { grid } = CODEX_POPUP_LAYOUT;
  const column = index % grid.columns;
  const row = Math.floor(index / grid.columns);
  return { x: (column - (grid.columns - 1) / 2) * (grid.cell + grid.gap), y: 12 + grid.cell / 2 + row * codexRowStride() };
}

export function codexGridContentHeight(count: number): number {
  const rows = Math.ceil(count / CODEX_POPUP_LAYOUT.grid.columns);
  return 12 + rows * codexRowStride();
}
