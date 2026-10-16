import type { AchievementCategory } from "../data/achievements";

/**
 * 업적 창의 자리는 팝업 본문 원점(화면 중앙)을 기준으로 이 표 하나가 갖는다.
 *
 * 위에서부터 **달성 요약 → 업적 목록 → 하단 줄(갈래 탭 · 모두 받기)** 순이고, 판 크기와 하단 줄은 임무
 * 기록과 같다 — 기간 대신 갈래를 고를 뿐 같은 손짓이다. 업적에는 기간이 없어 첫 줄이 연구도 대신
 * **이제껏 몇 단계를 밟았나**와 얻은 수식어 수를 말한다.
 */
export const ACHIEVEMENTS_POPUP_LAYOUT = {
  popup: { widthInset: 70, heightInset: 210 },
  summary: {
    panelY: -690, panelHeight: 196,
    headerY: -742,
    barY: -664, barHeight: 26,
    /** 오른쪽 수식어 칸의 폭. 게이지는 그 앞에서 끝난다. */
    modifierWidth: 250,
  },
  /** 업적 목록 창 — 요약 아래에서 시작해 갈래 탭 한 뼘 위에서 끝나며, 그 안에서만 흐른다. */
  list: { top: -566, bottom: 588, cardGap: 196, cardWidth: 920, cardHeight: 180 },
  row: {
    eyebrowY: -56, titleY: -14, objectiveY: 30, barY: 62,
    rewardSize: 112,
    pipSize: 9, pipGap: 24,
  },
  footer: {
    tabY: 652,
    tab: { width: 172, height: 76, gap: 8, left: -470 },
    claim: { x: 0, y: 772, width: 380, height: 92 },
  },
} as const;

/** 갈래마다 왼쪽 빗금의 색. 줄을 읽기 전에 어느 갈래의 기록인지 색이 먼저 말한다. */
export const ACHIEVEMENT_CATEGORY_TONE: Readonly<Record<AchievementCategory, number>> = {
  growth: 0x7fd36b,
  battle: 0xd85f34,
  explore: 0x6fa8d6,
  daily: 0xd8b978,
};

/** 탭은 「전체」가 첫 칸이고 그 뒤로 갈래가 선다. */
export type AchievementTab = "all" | AchievementCategory;

export function achievementsTabX(index: number): number {
  const { tab } = ACHIEVEMENTS_POPUP_LAYOUT.footer;
  return tab.left + tab.width / 2 + index * (tab.width + tab.gap);
}

export function achievementRowY(index: number): number {
  const { list } = ACHIEVEMENTS_POPUP_LAYOUT;
  return list.cardHeight / 2 + 8 + index * list.cardGap;
}

export function achievementListContentHeight(count: number): number {
  const { list } = ACHIEVEMENTS_POPUP_LAYOUT;
  return count === 0 ? 0 : 16 + list.cardHeight + (count - 1) * list.cardGap;
}

export interface AchievementOrderInput { id: string; claimedTiers: number; claimableTiers: number; tierCount: number }

/**
 * 줄 순서 — **받을 것 → 진행 중 → 끝난 것**. 같은 무리 안에서는 표의 순서를 지킨다 — 진행 비율로 줄 세우면
 * 값이 조금 오를 때마다 줄이 뒤섞인다.
 */
export function orderAchievements<T extends AchievementOrderInput>(rows: readonly T[]): T[] {
  const rank = (row: T): number => (row.claimableTiers > 0 ? 0 : row.claimedTiers >= row.tierCount ? 2 : 1);
  return rows.map((row, index) => ({ row, index })).sort((a, b) => rank(a.row) - rank(b.row) || a.index - b.index).map(({ row }) => row);
}
