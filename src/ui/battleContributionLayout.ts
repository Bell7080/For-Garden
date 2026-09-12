/** 전투 기여도 판이 다른 HUD와 좌표를 협상할 때 쓰는 순수 사각형이다. */
export interface ContributionBounds { left: number; top: number; width: number; height: number }

/** 1080×1920 전투 화면에서 상단 HUD와 하단 프로필 사이에 고정한 기여도 판 배치표다. */
export const BATTLE_CONTRIBUTION_LAYOUT = {
  panel: { left: 24, top: 550, width: 360, height: 700 },
  /**
   * 판을 **화면 밖으로 완전히 내보내는** 자리.
   *
   * 예전에는 컨테이너를 판 **폭만큼**(-360) 밀었는데, 판이 화면 왼쪽 여백(24) 안쪽에서
   * 시작하므로 그만큼이 그대로 남아 접은 뒤에도 오른쪽 변 한 뼘이 전장에 걸쳐 있었다.
   * 여백과 그림자까지 함께 밀어 접으면 확실히 사라진다.
   */
  slideOutX: -(24 + 360 + 24),
  /**
   * 접힌 상태에서 화면에 남는 것 — **판이 아니라 여는 칩 하나**다.
   *
   * 그 칩은 판 왼쪽이 아니라 전투 조작 줄(배속 칩 바로 위)에 선다(`CONTRIBUTION_TOGGLE`).
   * 엄지가 이미 배속·자동 궁극기를 누르는 자리라, 같은 손짓으로 열고 닫게 하려는 것이다.
   */
  collapsed: { left: 1080 - 335 - 85, top: 1288 - 92 - 38, width: 170, height: 76 },
  categories: { left: 108, top: 582, width: 252, height: 76, itemWidth: 84 },
  rows: { left: 116, top: 686, width: 244, height: 96, gap: 12, count: 5 },
  /**
   * 행 왼쪽의 얼굴 액자.
   *
   * 이름만 늘어서면 다섯 줄에서 누구인지 한눈에 읽히지 않는다 — 결과 화면의 기여도 판이
   * 같은 이유로 액자를 붙인다. 여는 칩이 판 밖(전투 조작 줄)으로 나간 뒤로는 판 왼쪽 여백이
   * 통째로 비어 있어, 액자를 **한눈에 얼굴이 읽히는 크기**까지 키웠다.
   */
  face: { x: 68, size: 84, offsetY: 26 },
  /** 막대는 액자가 커진 만큼 짧아진다 — 한 행에서 먼저 읽어야 하는 것은 누구인지다. */
  bar: { width: 216, height: 14, offsetY: 48 },
  protected: {
    stage: { left: 0, top: 0, width: 1080, height: 230 },
    bossHud: { left: 0, top: 70, width: 520, height: 150 },
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

/** 행 하나의 가운데 y. 순위가 바뀌면 이 자리 사이를 스르륵 옮긴다. */
export function contributionRowCenterY(index: number): number {
  const { rows } = BATTLE_CONTRIBUTION_LAYOUT;
  return rows.top + index * (rows.height + rows.gap) + rows.height / 2 - 18;
}

/** 테스트와 프리팹이 같은 계산을 써 펼침 상태별 실제 화면 경계를 얻는다. */
export function battleContributionBounds(expanded: boolean): ContributionBounds {
  return expanded ? { ...BATTLE_CONTRIBUTION_LAYOUT.panel } : { ...BATTLE_CONTRIBUTION_LAYOUT.collapsed };
}

/** 두 UI 안전 영역이 겹치는지 외곽선 접촉은 허용하며 판정한다. */
export function boundsOverlap(a: ContributionBounds, b: ContributionBounds): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left && a.top < b.top + b.height && a.top + a.height > b.top;
}
