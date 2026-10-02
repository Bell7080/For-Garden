/**
 * 보상 영수증의 칸 배치 — Phaser 없이 검증하는 순수 표.
 *
 * 가로로 밀어 넘기던 때는 끌기와 보상 누르기가 같은 손을 두고 겹쳤다. 지금은 **줄이 아래로
 * 늘어난다**: 한 줄에 4칸, 17칸부터는 5줄에 나눠 담고 판 높이는 줄 수에서 거꾸로 구한다.
 */
export const REWARD_POPUP_GRID = {
  width: 920,
  /** 한 줄이 쓸 수 있는 가로 폭. */
  viewport: 820,
  frame: 158,
  /** 한 줄 4칸일 때 칸 중심 간격. */
  gap: 198,
  /** 줄 하나가 차지하는 세로(액자 + 이름 줄 + 여백). */
  rowPitch: 230,
  /** 한 줄 기본 칸 수. */
  perRow: 4,
  /** 이 수를 넘으면 줄을 더 늘리지 않고 5줄에 나눠 담는다. */
  maxRows: 5,
  /** 한 줄짜리 판의 높이. */
  baseHeight: 360,
  /** 액자 중심이 줄 중심보다 위로 서는 거리. */
  frameY: -8,
  /** 이름 줄이 줄 중심에서 내려가는 거리. */
  labelY: 99,
  /** 줄이 쌓이는 연출의 간격(ms). 칸마다 이만큼씩 늦게 든다. */
  staggerMs: 55,
} as const;

export interface RewardGridCell {
  index: number;
  row: number;
  /** 줄 안에서 판 가운데 기준 x. */
  x: number;
  /** 판 내용 가운데 기준 y(액자 중심). */
  y: number;
  /** 이름 줄의 y. */
  labelY: number;
}

export interface RewardGridLayout {
  count: number;
  rows: number;
  columns: number;
  gap: number;
  /** 판 높이(경험치 블록 몫은 부르는 쪽이 더한다). */
  height: number;
  /** 한 줄짜리 판에서 늘어난 높이의 절반 — 판이 가운데에서 자라므로 맨 아래 선이 이만큼 내려간다. */
  growHalf: number;
  cells: RewardGridCell[];
}

export function rewardGridLayout(count: number): RewardGridLayout {
  const g = REWARD_POPUP_GRID;
  const safe = Math.max(1, Math.floor(count));
  const capacity = g.perRow * (g.maxRows - 1);
  const columns = safe <= capacity ? g.perRow : Math.ceil(safe / g.maxRows);
  const rows = Math.ceil(safe / columns);
  // 칸이 한 줄에 많아지면 폭 안에 들도록 간격만 좁힌다.
  const gap = columns <= 1 ? g.gap : Math.min(g.gap, (g.viewport - g.frame) / (columns - 1));
  const cells: RewardGridCell[] = [];
  for (let index = 0; index < safe; index += 1) {
    const row = Math.floor(index / columns);
    const inRow = row === rows - 1 ? safe - row * columns : columns;
    const column = index - row * columns;
    const y = (row - (rows - 1) / 2) * g.rowPitch;
    cells.push({
      index, row,
      x: (column - (inRow - 1) / 2) * gap,
      y: y + g.frameY,
      labelY: y + g.labelY,
    });
  }
  const extra = (rows - 1) * g.rowPitch;
  return { count: safe, rows, columns, gap, height: g.baseHeight + extra, growHalf: extra / 2, cells };
}
