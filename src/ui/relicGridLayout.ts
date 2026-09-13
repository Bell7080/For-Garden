import { BASE_WIDTH } from "../config/gameConfig";

/**
 * 도감 한 화면의 순수 배치표.
 *
 * 카드 규격과 상단 조작 줄이 **같은 좌우 여백**을 쓴다 — 씬이 눈대중으로 몇 픽셀씩 정하면
 * 그리드는 가운데 정렬이고 조작 줄만 어긋난 것처럼 보인다. Phaser를 모르므로 회귀 테스트가
 * 화면을 띄우지 않고 같은 값을 읽는다.
 */

/** 그리드가 좌우로 남기는 여백. 조작 줄도 같은 값에서 시작한다. */
export const RELIC_GRID_MARGIN = 36;

/**
 * 카드 그리드.
 *
 * **한 줄에 넷이다.** 셋일 때는 카드가 커서 한 화면에 여섯 장밖에 서지 않아, 무엇이 있는지
 * 훑으려면 계속 굴려야 했다 — 도감은 하나를 자세히 보는 화면이 아니라 전부를 훑는 화면이다.
 * 비례는 셋일 때(300×400)를 그대로 줄여 카드 안의 얼굴·이름 위계가 바뀌지 않게 한다.
 */
export const RELIC_GRID = {
  columns: 4,
  card: { width: 234, height: 312 },
  gapX: 24,
  gapY: 58,
} as const;

/** 첫 칸의 가로 중심. 그리드 전체 폭을 화면 가운데에 맞춘다. */
export function relicGridStartX(): number {
  const { columns, card, gapX } = RELIC_GRID;
  const width = columns * card.width + (columns - 1) * gapX;
  return (BASE_WIDTH - width) / 2 + card.width / 2;
}

/** 열 하나의 가로 중심. */
export function relicGridColumnX(column: number): number {
  return relicGridStartX() + column * (RELIC_GRID.card.width + RELIC_GRID.gapX);
}

/**
 * 상단 조작 줄.
 *
 * 왼쪽부터 **필터 · 이름 검색 · 정렬**이다. 검색이 가운데에서 남는 폭을 전부 가져가는 이유는
 * 거기에만 글자가 흐르기 때문이다 — 필터와 정렬은 담는 것이 정해져 있어 폭이 고정이다.
 */
export const RELIC_CONTROL_ROW = {
  y: 268,
  height: 84,
  gap: 16,
  filterWidth: 96,
  sortWidth: 300,
} as const;

/**
 * 속성 상성 버튼.
 *
 * **필터 버튼 바로 아래**에 같은 폭으로 선다 — 둘 다 "지금 보는 것을 바꾸지 않고 목록을 읽는
 * 법을 돕는" 조작이라 한 기둥으로 묶인다. 조작 줄에 나란히 세우면 검색 칸을 그만큼 좁힌다.
 */
export const RELIC_AFFINITY_BUTTON = { height: 72, gap: 12 } as const;

/** 상성 버튼의 세로 중심. */
export function relicAffinityButtonY(): number {
  return RELIC_CONTROL_ROW.y + RELIC_CONTROL_ROW.height / 2 + RELIC_AFFINITY_BUTTON.gap + RELIC_AFFINITY_BUTTON.height / 2;
}

/** 목록이 잘리기 시작하는 경계. 상성 버튼 밑변에서 한 뼘 더 내려온다. */
export function relicGridViewportTop(): number {
  return relicAffinityButtonY() + RELIC_AFFINITY_BUTTON.height / 2 + RELIC_AFFINITY_BUTTON.gap;
}

export interface ControlSpot {
  /** 가로 중심. */
  readonly x: number;
  readonly width: number;
}

/** 세 조작이 서는 자리. 남는 폭은 전부 검색 칸이 갖는다. */
export function relicControlSpots(): { filter: ControlSpot; search: ControlSpot; sort: ControlSpot } {
  const { gap, filterWidth, sortWidth } = RELIC_CONTROL_ROW;
  const total = BASE_WIDTH - RELIC_GRID_MARGIN * 2;
  const searchWidth = total - filterWidth - sortWidth - gap * 2;
  const left = RELIC_GRID_MARGIN;
  return {
    filter: { x: left + filterWidth / 2, width: filterWidth },
    search: { x: left + filterWidth + gap + searchWidth / 2, width: searchWidth },
    sort: { x: BASE_WIDTH - RELIC_GRID_MARGIN - sortWidth / 2, width: sortWidth },
  };
}

/**
 * 정렬 목록이 펼쳐지는 판.
 *
 * 버튼 **바로 아래**에 오른쪽 변을 맞춰 붙는다 — 가운데에 띄우면 무엇을 눌러서 열린 판인지
 * 끊어지고, 화면 가운데를 덮어 그리드가 통째로 가려진다.
 */
export const RELIC_SORT_MENU = { rowHeight: 76, gap: 10, padding: 12 } as const;

/** 항목 수에서 거꾸로 구한 판 높이. 손으로 적어 두면 기준이 늘 때마다 어긋난다. */
export function relicSortMenuHeight(count: number): number {
  const { rowHeight, gap, padding } = RELIC_SORT_MENU;
  return padding * 2 + count * rowHeight + Math.max(0, count - 1) * gap;
}

/** 판 안에서 N번째 줄의 세로 중심(판 가운데 기준). */
export function relicSortMenuRowY(index: number, count: number): number {
  const { rowHeight, gap, padding } = RELIC_SORT_MENU;
  return -relicSortMenuHeight(count) / 2 + padding + rowHeight / 2 + index * (rowHeight + gap);
}

/**
 * 들어올 때 칸이 차례로 깔리는 몫.
 *
 * **얕게 둔다.** 칸마다 온전한 시차를 주면 스무 장이 다 서기까지 2초가 넘게 걸려, 탭을
 * 바꾼 손이 목록을 읽기 전에 기다리게 된다. 그래서 지연에 **상한**을 두고 그 뒤의 칸은
 * 함께 들어온다 — 첫 줄이 촤르륵 깔리는 것만 보이고 나머지는 이미 서 있다.
 */
export const RELIC_GRID_INTRO = { step: 22, cap: 260, duration: 200, rise: 24 } as const;

/** N번째 칸이 기다리는 시간(ms). 상한에 닿은 뒤로는 전부 같은 순간에 들어온다. */
export function relicGridIntroDelay(index: number): number {
  return Math.min(index * RELIC_GRID_INTRO.step, RELIC_GRID_INTRO.cap);
}

/**
 * 필터 판.
 *
 * **높이를 손으로 적지 않는다.** 축이 하나 늘거나 언어가 바뀌어 줄이 한 칸 더 필요해지면
 * 적어 둔 높이만 그대로 남아 마지막 줄이 판 밖으로 나간다(무역 창이 그랬다). 쌓인 내용에서
 * 거꾸로 구한다.
 */
export const RELIC_FILTER_POPUP = {
  width: 760,
  /** 좌우 안쪽 여백. 칩 폭이 여기서 나온다. */
  padding: 40,
  /** 칩 사이 틈. */
  gap: 12,
  /** 머리글 아래 첫 칸 제목까지. */
  top: 58,
  bottom: 40,
  /** 칸 제목 줄이 차지하는 높이. 제목 가운데가 그 절반에 선다. */
  labelHeight: 30,
  /** 제목 아래에서 칩 윗변까지. */
  labelGap: 42,
  /** 칸과 칸 사이. */
  sectionGap: 34,
  /** 아이콘이 함께 서는 칩(속성·직군). */
  iconChipHeight: 122,
  /** 글자만 서는 칩(사거리). */
  textChipHeight: 74,
  reset: { height: 68, gap: 30 },
} as const;

/** 한 줄에 `count`개가 설 때 칩 하나의 폭. */
export function relicFilterChipWidth(count: number): number {
  const { width, padding, gap } = RELIC_FILTER_POPUP;
  return (width - padding * 2 - gap * Math.max(0, count - 1)) / count;
}

/** 한 줄에서 `index`번째 칩의 가로 중심(판 가운데 기준). */
export function relicFilterChipX(index: number, count: number): number {
  const { width, padding, gap } = RELIC_FILTER_POPUP;
  const chip = relicFilterChipWidth(count);
  return -width / 2 + padding + chip / 2 + index * (chip + gap);
}

export interface FilterSectionSpec {
  /** 그 줄의 칩 높이. 아이콘이 서는 줄과 글자만 서는 줄이 다르다. */
  readonly chipHeight: number;
}

export interface FilterPopupLayout {
  readonly height: number;
  /** 판 가운데 기준. 제목은 세로 가운데, 칩은 줄의 세로 가운데다. */
  readonly sections: ReadonlyArray<{ readonly labelY: number; readonly chipY: number }>;
  /** 조건 해제 줄. 조건이 하나도 없으면 그 줄을 세우지 않으므로 값만 돌려준다. */
  readonly resetY: number;
}

/** 쌓인 내용에서 판 높이와 각 줄의 세로 자리를 함께 구한다. */
export function relicFilterPopupLayout(sections: readonly FilterSectionSpec[], reset: boolean): FilterPopupLayout {
  const { top, bottom, labelHeight, labelGap, sectionGap } = RELIC_FILTER_POPUP;
  let cursor = top;
  const stacked = sections.map((section) => {
    const labelTop = cursor;
    const chipTop = labelTop + labelGap;
    cursor = chipTop + section.chipHeight + sectionGap;
    return { labelTop, chipTop, chipHeight: section.chipHeight };
  });
  if (stacked.length > 0) cursor -= sectionGap;
  let resetTop = cursor;
  if (reset) {
    resetTop = cursor + RELIC_FILTER_POPUP.reset.gap;
    cursor = resetTop + RELIC_FILTER_POPUP.reset.height;
  }
  const height = cursor + bottom;
  const half = height / 2;
  return {
    height,
    sections: stacked.map((section) => ({
      labelY: section.labelTop + labelHeight / 2 - half,
      chipY: section.chipTop + section.chipHeight / 2 - half,
    })),
    resetY: resetTop + RELIC_FILTER_POPUP.reset.height / 2 - half,
  };
}
