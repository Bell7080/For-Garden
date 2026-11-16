/**
 * 도감 창의 자리는 팝업 본문 원점(화면 중앙)을 기준으로 이 표 하나가 갖는다.
 *
 * 판 크기와 하단 줄은 업적 창과 같다 — 위에서부터 **기록 점수 요약 → 정렬 줄 → 전시 격자 → 하단 줄
 * (아군·적 탭 · 모두 받기)** 순이다. 격자는 얼굴 액자가 아니라 **세로로 긴 스탠딩 칸**이 네 줄로 선
 * 전시대이고, 정렬이 등급·소속이면 묶음마다 공용 제목표가 끼어 구역을 가른다.
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
  /** 정렬 줄 — 요약 판 바로 아래, 목록 쪽으로 솟는 라벨 셋. */
  sort: { y: -548, tab: { width: 196, height: 62, gap: 10 } },
  /** 전시 격자 창 — 정렬 줄 아래에서 시작해 탭 한 뼘 위에서 끝나며, 그 안에서만 흐른다. */
  grid: { top: -500, bottom: 588, columns: 4, cardWidth: 212, cardHeight: 392, gap: 24, rowGap: 26, width: 920, headerHeight: 76, headerGap: 10, padTop: 10 },
  footer: {
    tabY: 652,
    tab: { width: 220, height: 76, gap: 12 },
    claim: { x: 0, y: 772, width: 380, height: 92 },
  },
} as const;

export type CodexTab = "ally" | "enemy";
export const CODEX_TABS: readonly CodexTab[] = ["ally", "enemy"];

/** 전시 정렬 — 개체번호순(도감 순서 그대로) · 등급별 구역 · 소속별 구역. */
export type CodexSort = "number" | "rarity" | "squad";
export const CODEX_SORTS: readonly CodexSort[] = ["number", "rarity", "squad"];

const RARITY_ORDER = ["SSR", "SR", "R"] as const;

export interface CodexGroupable { id: string; rarity: string; squad: string }

/** 칸들을 정렬대로 구역으로 묶는다. 구역 안의 순서는 도감 순서 그대로다. 번호순은 이름 없는 한 구역이다. */
export function groupCodexEntries<T extends CodexGroupable>(entries: readonly T[], sort: CodexSort, squadOrder: readonly string[]): { key?: string; entries: T[] }[] {
  if (sort === "number") return entries.length ? [{ entries: [...entries] }] : [];
  const order: readonly string[] = sort === "rarity" ? RARITY_ORDER : squadOrder;
  const keyOf = (entry: T) => (sort === "rarity" ? entry.rarity : entry.squad);
  const keys = [...new Set(entries.map(keyOf))].sort((a, b) => rank(order, a) - rank(order, b));
  return keys.map((key) => ({ key, entries: entries.filter((entry) => keyOf(entry) === key) }));
}

function rank(order: readonly string[], key: string): number {
  const index = order.indexOf(key);
  return index < 0 ? order.length : index;
}

/** 한 줄이 차지하는 세로 — 카드 높이 + 줄 사이. */
export function codexRowStride(): number {
  const { grid } = CODEX_POPUP_LAYOUT;
  return grid.cardHeight + grid.rowGap;
}

export interface CodexGridPlan {
  /** 구역 제목의 세로 가운데(격자 창 윗변이 0). 이름 없는 구역은 서지 않는다. */
  headers: { key: string; y: number }[];
  /** 칸마다 카드 가운데. 구역의 순서대로 이어진다. */
  cards: { x: number; y: number }[];
  height: number;
}

/** 구역 크기들에서 제목·카드 자리를 차례로 쌓는다. 화면은 이 값만 읽는다. */
export function codexGridPlan(groups: readonly { key?: string; count: number }[]): CodexGridPlan {
  const { grid } = CODEX_POPUP_LAYOUT;
  const headers: CodexGridPlan["headers"] = [];
  const cards: CodexGridPlan["cards"] = [];
  let y = grid.padTop;
  for (const group of groups) {
    if (group.key !== undefined) {
      headers.push({ key: group.key, y: y + grid.headerHeight / 2 });
      y += grid.headerHeight + grid.headerGap;
    }
    for (let index = 0; index < group.count; index += 1) {
      const column = index % grid.columns;
      const row = Math.floor(index / grid.columns);
      cards.push({ x: codexColumnX(column), y: y + grid.cardHeight / 2 + row * codexRowStride() });
    }
    const rows = Math.ceil(group.count / grid.columns);
    y += rows * codexRowStride();
  }
  return { headers, cards, height: y + grid.padTop };
}

export function codexColumnX(column: number): number {
  const { grid } = CODEX_POPUP_LAYOUT;
  return (column - (grid.columns - 1) / 2) * (grid.cardWidth + grid.gap);
}
