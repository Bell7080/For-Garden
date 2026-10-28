/** 전투 기여도 판이 다른 HUD와 좌표를 협상할 때 쓰는 순수 사각형이다. */
export interface ContributionBounds { left: number; top: number; width: number; height: number }

/** 1080×1920 전투 화면에서 상단 HUD와 하단 프로필 사이에 고정한 기여도 판 배치표다. */
export const BATTLE_CONTRIBUTION_LAYOUT = {
  /**
   * 판은 **화면 왼쪽 벽에 붙어 선 세로 띠**다. 위에서 분류 칩 한 줄, 그 아래로 다섯 전투원이
   * 순위 순으로 쌓인다. 상단 HUD(0~230)와 보스전 점수 랭킹 띠(~306) 아래에서 시작해 하단 조작 줄(1250~)과 프로필(1430~)
   * 위에서 끝나고, 순위가 바뀌면 줄이 위아래로 스르륵 자리를 바꾼다.
   */
  panel: { left: 0, top: 312, width: 252, height: 732 },
  /** 판을 **화면 왼쪽으로 완전히 내보내는** 거리. 그림자까지 화면 밖으로 밀어 접은 뒤에는 흔적이 없다. */
  slideOutX: -(252 + 24),
  /**
   * 접힌 상태에서 화면에 남는 것 — **판이 아니라 여는 칩 하나**다.
   *
   * 칩은 전투 조작 줄(배속·자동 궁극기)과 **같은 가로선의 왼쪽 끝**에 선다.
   */
  collapsed: { left: 24, top: 1288 - 38, width: 170, height: 76 },
  categories: { left: 0, top: 320, width: 252, height: 72, itemWidth: 84 },
  /** 칸 하나가 한 전투원의 자리다. 위에서 아래로 순위 순이다. */
  rows: { left: 14, top: 404, width: 224, height: 112, gap: 12, count: 5 },
  /** 칸 안(왼쪽 위 기준) 얼굴 액자. */
  face: { x: 34, y: 38, size: 60 },
  /** 칸 안 이름·수치 열의 왼쪽 시작. */
  text: { x: 72, nameY: 22, valueY: 56 },
  /** 막대는 칸 맨 아래를 가로지른다 — 다섯 막대의 길이 차이가 순위를 말한다. */
  bar: { width: 200, height: 14, y: 96 },
  protected: {
    stage: { left: 0, top: 0, width: 1080, height: 230 },
    bossHud: { left: 0, top: 70, width: 520, height: 150 },
    /** 하단 전투 조작 줄(배속·자동·연출·여는 칩)이 서는 띠. */
    controls: { left: 0, top: 1240, width: 1080, height: 190 },
    profiles: { left: 0, top: 1430, width: 1080, height: 490 },
  },
} as const;

/**
 * 기여도 판을 여닫는 칩 — **배속 칩과 같은 자리·같은 크기**다.
 *
 * 판 안에 두면 펼친 판이 그 칩을 덮어 감췄다 되살려야 하고, 판 왼쪽에 두면 엄지가 화면을
 * 가로질러 가야 한다. 값은 `BATTLE_CONTROLS`(배속·자동 궁극기 줄)에서 따오며, 화면은 이
 * 표만 읽는다.
 */
export const CONTRIBUTION_TOGGLE = {
  ...BATTLE_CONTRIBUTION_LAYOUT.collapsed,
  x: BATTLE_CONTRIBUTION_LAYOUT.collapsed.left + BATTLE_CONTRIBUTION_LAYOUT.collapsed.width / 2,
  y: BATTLE_CONTRIBUTION_LAYOUT.collapsed.top + BATTLE_CONTRIBUTION_LAYOUT.collapsed.height / 2,
} as const;

/** 모든 칸이 같은 x에 선다. */
export function contributionCellX(): number {
  return BATTLE_CONTRIBUTION_LAYOUT.rows.left;
}

/** 칸 하나의 위쪽 y. 순위가 바뀌면 이 자리 사이를 스르륵 옮긴다. */
export function contributionCellY(index: number): number {
  const { rows } = BATTLE_CONTRIBUTION_LAYOUT;
  return rows.top + index * (rows.height + rows.gap);
}

/** 테스트와 프리팹이 같은 계산을 써 펼침 상태별 실제 화면 경계를 얻는다. */
export function battleContributionBounds(expanded: boolean): ContributionBounds {
  return expanded ? { ...BATTLE_CONTRIBUTION_LAYOUT.panel } : { ...BATTLE_CONTRIBUTION_LAYOUT.collapsed };
}

/** 두 UI 안전 영역이 겹치는지 외곽선 접촉은 허용하며 판정한다. */
export function boundsOverlap(a: ContributionBounds, b: ContributionBounds): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}
