/** 전투 기여도 판이 다른 HUD와 좌표를 협상할 때 쓰는 순수 사각형이다. */
export interface ContributionBounds { left: number; top: number; width: number; height: number }

/** 1080×1920 전투 화면에서 상단 HUD와 하단 프로필 사이에 고정한 기여도 판 배치표다. */
export const BATTLE_CONTRIBUTION_LAYOUT = {
  panel: { left: 24, top: 550, width: 360, height: 700 },
  collapsed: { left: 24, top: 914, width: 88, height: 92 },
  toggle: { x: 68, y: 960, width: 88, height: 92 },
  categories: { left: 108, top: 582, width: 252, height: 76, itemWidth: 84 },
  rows: { left: 108, top: 686, width: 252, height: 96, gap: 12, count: 5 },
  /**
   * 행 왼쪽의 얼굴 액자.
   *
   * 이름만 늘어서면 다섯 줄에서 누구인지 한눈에 읽히지 않는다 — 결과 화면의 기여도 판이
   * 같은 이유로 액자를 붙인다. 자리는 판 왼쪽 여백(24~108)이며, 그래프 칩이 펼친 동안
   * 사라지므로 그 자리가 비어 있다.
   */
  face: { x: 68, size: 66, offsetY: 26 },
  protected: {
    stage: { left: 0, top: 0, width: 1080, height: 230 },
    bossHud: { left: 0, top: 70, width: 520, height: 150 },
    profiles: { left: 0, top: 1430, width: 1080, height: 490 },
  },
} as const;

/** 테스트와 프리팹이 같은 계산을 써 펼침 상태별 실제 화면 경계를 얻는다. */
export function battleContributionBounds(expanded: boolean): ContributionBounds {
  return expanded ? { ...BATTLE_CONTRIBUTION_LAYOUT.panel } : { ...BATTLE_CONTRIBUTION_LAYOUT.collapsed };
}

/** 두 UI 안전 영역이 겹치는지 외곽선 접촉은 허용하며 판정한다. */
export function boundsOverlap(a: ContributionBounds, b: ContributionBounds): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}
