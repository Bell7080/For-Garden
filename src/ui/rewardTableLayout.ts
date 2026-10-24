/**
 * 보상표 창(`RewardTable`)의 **순수 배치표** — 주간 순위 보상·티어 보상이 같은 줄 규격을 쓴다.
 *
 * 창 높이는 손으로 적지 않고 섹션·줄 수에서 거꾸로 구한다(줄이 늘면 마지막 줄이 판 밖으로 나가던 일을 막는다).
 * 좌표는 팝업 가운데가 0인 로컬 좌표다. Phaser를 모르므로 테스트가 화면을 띄우지 않고 겹침을 잰다.
 */
export const REWARD_TABLE = {
  width: 940,
  /** 줄 판의 폭. 창 안쪽 여백을 뺀 값이다. */
  rowWidth: 840,
  rowHeight: 112,
  rowGap: 12,
  /** 판 위쪽 — 제목표 아래의 규칙 판. */
  rules: { top: 70, height: 118 },
  /** 섹션 제목표(`addSectionTitle`)가 서는 줄의 높이와, 그 아래 첫 줄까지의 틈. */
  section: { height: 58, gap: 30 },
  /** 마지막 줄 아래 여백. */
  bottom: 56,
  /** 줄 안의 자리 — 줄 가운데가 0이다. */
  badgeX: -340,
  textX: -268,
  /** 보상 액자. 오른쪽 끝에서 왼쪽으로 쌓는다. */
  reward: { size: 84, gap: 14, right: 396 },
  /** 지금 내 자리 줄 왼쪽 위의 「현재」 표식. */
  currentTag: { width: 104, height: 34 },
} as const;

export interface RewardTableShape {
  sections: readonly { rows: number; titled: boolean }[];
  /** 줄이 많은 표(섹션 둘)는 줄을 한 뼘 낮춰 창이 화면을 넘지 않게 한다. */
  compact?: boolean;
}

/** 줄 높이·틈 — 촘촘한 표는 92·10이다. */
export function rewardTableRowMetrics(compact = false): { rowHeight: number; rowGap: number } {
  return compact ? { rowHeight: 92, rowGap: 10 } : { rowHeight: REWARD_TABLE.rowHeight, rowGap: REWARD_TABLE.rowGap };
}

export interface RewardTablePlacement {
  height: number;
  rulesY: number;
  /** 섹션마다 제목표 y(제목이 없으면 null)와 줄 중심 y들. */
  sections: { titleY: number | null; rowYs: number[] }[];
}

/** 섹션·줄 수에서 창 높이와 모든 줄의 자리를 구한다. */
export function rewardTablePlacement(shape: RewardTableShape): RewardTablePlacement {
  const { rules, section, bottom } = REWARD_TABLE;
  const { rowHeight, rowGap } = rewardTableRowMetrics(shape.compact);
  let cursor = rules.top + rules.height + 26;
  const sections = shape.sections.map((entry) => {
    let titleY: number | null = null;
    if (entry.titled) {
      titleY = cursor + section.height / 2;
      cursor += section.height + section.gap - 18;
    }
    const rowYs = Array.from({ length: entry.rows }, (_, index) => cursor + rowHeight / 2 + index * (rowHeight + rowGap));
    cursor += entry.rows * (rowHeight + rowGap) - rowGap + section.gap;
    return { titleY, rowYs };
  });
  const height = cursor - section.gap + bottom;
  const shift = -height / 2;
  return {
    height,
    rulesY: shift + rules.top + rules.height / 2,
    sections: sections.map((entry) => ({ titleY: entry.titleY === null ? null : entry.titleY + shift, rowYs: entry.rowYs.map((y) => y + shift) })),
  };
}

/** 보상 액자 `index`(오른쪽부터 0)의 x. */
export function rewardTableRewardX(index: number): number {
  const { size, gap, right } = REWARD_TABLE.reward;
  return right - size / 2 - index * (size + gap);
}

/** 순위 구간의 표기 — 1 · 2–3 · 101+. */
export function rankBandLabel(from: number, upTo: number | null): string {
  if (upTo === null) return `${from}+`;
  return upTo === from ? `${from}` : `${from}–${upTo}`;
}
