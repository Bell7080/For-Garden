/**
 * 연구원 레벨업 판의 자리 — Phaser를 모르는 순수 배치표.
 *
 * 위에서부터 **영웅 줄(애착 렐릭 SD + LV.n › LV.m) → 레벨업 보상(액자) → 새로 열린 것(그림 칸)** 순이다.
 * 판 높이는 손으로 적지 않고 열린 것의 줄 수에서 거꾸로 구한다 — 한꺼번에 여러 레벨이 오르면 칸이 늘어난다.
 */
export const LEVEL_UP_POPUP = {
  width: 900,
  /** 제목표 아래 첫 줄까지. */
  topRoom: 96,
  hero: {
    height: 300,
    sd: { x: -270, groundRatio: 0.92, height: 230, shadow: 180 },
    /** 「LV.n ›」 작은 줄 · 큰 LV · 「연구원 레벨 +k」 줄의 세로 자리(영웅 줄 위끝 기준). */
    levelX: 90,
    fromY: 62,
    toY: 158,
    gainY: 256,
    fromSize: 40,
    toSize: 118,
    gainSize: 28,
    /** 큰 LV 둘레에 반짝이는 네 갈래 별 — 큰 LV 가운데 기준 상대 자리와 크기. */
    sparkles: [
      { x: -170, y: -58, size: 18 }, { x: 168, y: -66, size: 24 }, { x: 196, y: 30, size: 14 },
      { x: -150, y: 46, size: 13 }, { x: 40, y: -92, size: 11 },
    ],
  },
  section: { titleSize: 26, titleRoom: 66, gap: 26 },
  reward: { frame: 128, spacing: 72, captionGap: 34, captionSize: 22, captionWidth: 220 },
  unlock: { width: 190, height: 196, gapX: 18, gapY: 18, perRow: 4, glyph: 74, glyphY: -26, avatar: 104, nameY: 64, nameSize: 23 },
  bottomRoom: 48,
} as const;

export function levelUpRewardHeight(): number {
  const { section, reward } = LEVEL_UP_POPUP;
  return section.titleRoom + reward.frame + reward.captionGap + reward.captionSize;
}

export function levelUpUnlockRows(count: number): number {
  return Math.ceil(count / LEVEL_UP_POPUP.unlock.perRow);
}

export function levelUpUnlockHeight(count: number): number {
  if (count === 0) return 0;
  const { section, unlock } = LEVEL_UP_POPUP;
  const rows = levelUpUnlockRows(count);
  return section.gap + section.titleRoom + rows * unlock.height + (rows - 1) * unlock.gapY;
}

export function levelUpPopupHeight(unlockCount: number): number {
  const L = LEVEL_UP_POPUP;
  return L.topRoom + L.hero.height + L.section.gap + levelUpRewardHeight() + levelUpUnlockHeight(unlockCount) + L.bottomRoom;
}

/** 열린 것 칸들의 가운데 자리. 마지막 줄은 남은 칸만큼 가운데로 모인다. */
export function levelUpUnlockCells(count: number): Array<{ x: number; row: number }> {
  const { unlock } = LEVEL_UP_POPUP;
  const cells: Array<{ x: number; row: number }> = [];
  for (let index = 0; index < count; index += 1) {
    const row = Math.floor(index / unlock.perRow);
    const inRow = Math.min(unlock.perRow, count - row * unlock.perRow);
    const column = index - row * unlock.perRow;
    const total = inRow * unlock.width + (inRow - 1) * unlock.gapX;
    cells.push({ x: -total / 2 + unlock.width / 2 + column * (unlock.width + unlock.gapX), row });
  }
  return cells;
}
