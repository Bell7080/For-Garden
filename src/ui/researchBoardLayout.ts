/**
 * 연구 결과판의 자리.
 *
 * 열 칸이 한 화면에 서는 유일한 자리라 화면마다 눈대중으로 옮기면 곧 갈라진다. 카드 크기·줄
 * 나눔·제목과 안내 문구의 y까지 여기 한 곳에서 구하고, 씬은 결과만 읽는다. Phaser를 모르는
 * 모듈인 이유는 회귀 테스트가 같은 값을 읽어야 하기 때문이다.
 *
 * **줄은 가운데가 가장 길다.** 세로 화면에서 열 칸을 다섯씩 두 줄로 두면 칸이 작아지고 화면
 * 위아래가 통째로 빈다. 넉 줄로 늘이면 마지막 줄에 한 칸만 남아 흘린 것처럼 보인다. 그래서
 * 네 칸을 최대로 두고 남는 칸을 **가운데 줄부터** 채운다 — 열 칸이면 3·4·3이라 위아래가 같은
 * 길이로 남아 판이 상하좌우 대칭이 되고, 칸도 다섯 줄일 때보다 한 뼘 커진다.
 */

/** 기준 해상도의 가로 폭. 호출부가 넘기지 않으면 이 값을 쓴다. */
const BOARD_VIEW_WIDTH = 1080;

export const RESEARCH_BOARD = {
  /** 한 줄에 설 수 있는 최대 칸 수. */
  maxColumns: 4,
  /** 판 좌우에 반드시 남기는 여백. */
  sideMargin: 26,
  columnGap: 12,
  rowGap: 44,
  /** 칸의 세로/가로 비례. 카드 한 장이 서는 자리라 세로로 길다. */
  tileAspect: 1.34,
  /**
   * 액자가 칸 폭에서 차지하는 비율.
   *
   * 중복·재화는 정사각 액자라 칸보다 작다. 새로 만난 렐릭만 칸을 세로로 가득 채우므로,
   * 같은 판에서 **카드가 액자보다 크다**는 것만으로 무엇이 새로 온 것인지 먼저 읽힌다.
   */
  frameRatio: 0.88,
  /** 한 장만 뽑았을 때의 칸 폭. */
  singleWidth: 460,
  /** 판 전체의 세로 중심. */
  centerY: 960,
  /** 판 윗변과 제목 사이. */
  titleGap: 96,
  /** 판 아랫변과 안내 문구 사이. */
  hintGap: 92,
} as const;

/**
 * 줄마다 몇 칸이 서는지.
 *
 * 남는 칸은 가운데 줄부터 채워 위아래 줄 길이가 같게 둔다.
 */
export function researchBoardRows(count: number): number[] {
  if (count <= 0) return [];
  if (count <= RESEARCH_BOARD.maxColumns) return [count];
  const rows = Math.ceil(count / RESEARCH_BOARD.maxColumns);
  const sizes = new Array<number>(rows).fill(Math.floor(count / rows));
  let extra = count % rows;
  // 가운데에서 먼 줄일수록 나중이다. 같은 거리면 위쪽 줄이 먼저 받는다.
  const order = [...sizes.keys()].sort(
    (a, b) => Math.abs(a - (rows - 1) / 2) - Math.abs(b - (rows - 1) / 2) || a - b,
  );
  for (const index of order) {
    if (extra <= 0) break;
    sizes[index] += 1;
    extra -= 1;
  }
  return sizes;
}

export interface ResearchBoardCell {
  x: number;
  y: number;
  row: number;
  column: number;
}

export interface ResearchBoardLayout {
  tileWidth: number;
  tileHeight: number;
  /** 중복 파편·재화가 쓰는 정사각 액자 한 변. */
  frameSize: number;
  cells: ResearchBoardCell[];
  /** 판의 윗변·아랫변. 제목과 안내 문구가 여기서 나온다. */
  top: number;
  bottom: number;
  titleY: number;
  hintY: number;
}

/** 슬롯 수에 맞는 칸 크기와 자리를 구한다. 한 장은 가운데에 크게 한 칸만 선다. */
export function researchBoardLayout(count: number, viewWidth: number = BOARD_VIEW_WIDTH): ResearchBoardLayout {
  const rows = researchBoardRows(count);
  const single = count === 1;
  const tileWidth = single
    ? RESEARCH_BOARD.singleWidth
    : Math.floor(
        (viewWidth - RESEARCH_BOARD.sideMargin * 2 - (RESEARCH_BOARD.maxColumns - 1) * RESEARCH_BOARD.columnGap)
          / RESEARCH_BOARD.maxColumns,
      );
  const tileHeight = Math.round(tileWidth * RESEARCH_BOARD.tileAspect);
  const height = rows.length * tileHeight + Math.max(0, rows.length - 1) * RESEARCH_BOARD.rowGap;
  const top = Math.round(RESEARCH_BOARD.centerY - height / 2);
  const step = tileWidth + RESEARCH_BOARD.columnGap;

  const cells: ResearchBoardCell[] = [];
  rows.forEach((columns, row) => {
    const y = top + tileHeight / 2 + row * (tileHeight + RESEARCH_BOARD.rowGap);
    for (let column = 0; column < columns; column += 1) {
      cells.push({ x: viewWidth / 2 + (column - (columns - 1) / 2) * step, y, row, column });
    }
  });

  return {
    tileWidth,
    tileHeight,
    frameSize: Math.round(tileWidth * RESEARCH_BOARD.frameRatio),
    cells,
    top,
    bottom: top + height,
    titleY: top - RESEARCH_BOARD.titleGap,
    hintY: top + height + RESEARCH_BOARD.hintGap,
  };
}
