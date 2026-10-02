/**
 * 노드 미리보기가 화면 가장자리와 겹치지 않도록 쓰는 순수 배치 계약이다.
 *
 * **판은 SD가 서고도 남을 만큼 높다.** 좁게 잡으면 머리가 판 윗변의 구분선에 닿아 잘린 것처럼
 * 보인다 — 카드 그리드가 첫 줄에 머리 여유를 두는 것과 같은 이유다. 아래로도 이름·레벨 줄과
 * 총 전투력 한 줄이 더 들어가므로 그만큼 키웠고, 밑변과도 넉넉히 띄운다 — 마지막 줄이 판
 * 밑변에 닿으면 판이 글자에 눌린 것처럼 보인다.
 */
export const NODE_ENEMY_PREVIEW = { width: 900, height: 560, sdHeight: 200, tailGap: 96 } as const;

/**
 * 관문 상황 한 줄이 서는 자리 — **제목 바로 아래이고, 판 아래가 아니다.**
 *
 * 판 아래 구획은 이미 "이 편성이 얼마나 센가"(총 전투력)가 맡고 있다. 거기에 서사를 붙이면
 * **고를 때 필요한 정보와 고르는 것과 무관한 정보가 같은 무게로 선다.** 새 팝업으로 빼도
 * 안 된다 — 한 번의 선택에 판이 둘 뜨면 그 줄은 "따로 열어 봐야 하는 것"이 되어 아무도 열지
 * 않는다. 제목 다음 줄에 붙으면 구획이 늘어난 것이 아니라 **이름표가 길어진 것**으로 읽힌다.
 *
 * 높이 비용은 한 줄뿐이라 40px이다(520 → 560). 지도 창은 `WINDOW`가 500~1560이라 1060px이
 * 남아 `anchorEnemyPreview`의 클램프에 걸리지 않는다.
 */
export const NODE_ENEMY_SITUATION = { y: -206, size: 24, wrapInset: 56 } as const;

/** 판 안에서 한 적이 차지하는 세로 자리. 표식(속성·직군·돌파)이 이 상자의 모서리에 붙는다. */
export const NODE_ENEMY_SLOT = {
  /** SD 발끝이 서는 판 안쪽 y. */
  ground: 138,
  /** 제목·상황 줄 아래 구분선. SD 머리 끝은 이 선에 닿지 않는다. */
  dividerY: -160,
  /** 제목 글자의 윗선. 상황 한 줄이 이 아래, 구분선 위에 들어간다. */
  titleY: -246,
  /** 이름·레벨 줄. 체력은 적지 않는다 — 붙어 볼지 정하는 데 필요한 것은 총 전투력 하나다. */
  nameY: 158,
  /** 아래 구분선과 총 전투력 한 줄. 판 밑변과 넉넉히 떨어뜨린다. */
  footerDividerY: 210,
  powerY: 230,
} as const;

/** 1/3/5기 모두 같은 판 안에서 좌우 대칭을 이루는 SD 중심을 계산한다. */
export function enemyPreviewColumns(count: number, width = NODE_ENEMY_PREVIEW.width): number[] {
  const safeCount = Math.max(1, count);
  const gap = Math.min(256, (width - 120) / Math.max(1, safeCount - 1));
  return Array.from({ length: safeCount }, (_, index) => (index - (safeCount - 1) / 2) * gap);
}

/** 한 적이 차지하는 상자의 반폭. 표식이 옆 칸을 침범하지 않도록 열 간격에서 구한다. */
export function enemyPreviewSlotHalfWidth(count: number, width = NODE_ENEMY_PREVIEW.width): number {
  const columns = enemyPreviewColumns(count, width);
  if (columns.length < 2) return 115;
  return Math.min(115, Math.abs(columns[1] - columns[0]) / 2 - 6);
}

/** 노드 위 공간이 부족할 때만 아래로 뒤집고, 양쪽 안전 영역 안에 판 전체를 보존한다. */
export function anchorEnemyPreview(nodeY: number, top: number, bottom: number, height: number = NODE_ENEMY_PREVIEW.height): { y: number; above: boolean } {
  const aboveY = nodeY - height / 2 - NODE_ENEMY_PREVIEW.tailGap;
  const belowY = nodeY + height / 2 + NODE_ENEMY_PREVIEW.tailGap;
  const above = aboveY - height / 2 >= top;
  const intended = above ? aboveY : belowY;
  return { y: Math.min(bottom - height / 2, Math.max(top + height / 2, intended)), above };
}

/** 선택 노드 중심이 지도 마스크 안에 남아 있는 동안에만 부착 판을 표시한다. */
export function isEnemyPreviewNodeVisible(nodeY: number, top: number, bottom: number): boolean {
  return nodeY >= top && nodeY <= bottom;
}

/**
 * **스토리 관문의 미리보기 — 펼치는 두 칸과 초회 보상 한 줄.**
 *
 * 원정 노드는 적만 보여 주면 되지만 스토리 관문은 적·줄거리·초회 보상 셋을 말해야 한다. 셋을 모두
 * 펼쳐 두면 판이 화면의 절반을 넘어 지도가 가려지므로 **적 정보와 줄거리는 접을 수 있는 칸**이다.
 *
 * - 적 칸의 머리줄이 곧 **총 전투력**이다. 접어도 "얼마나 센가"는 남아야 붙어 볼지 정할 수 있다.
 * - 줄거리 칸은 한 등급 가볍다 — 머리줄이 낮고 글자가 작고 흐리다. 고르는 데 필요한 정보가 아니다.
 * - 초회 보상은 접지 않는다. 판 맨 아래에 늘 서고, 받은 것은 액자 위에 체크가 선다.
 *
 * 좌표는 **판 윗변에서 잰 값**이다. 높이가 칸을 여닫을 때마다 바뀌므로 가운데 기준으로 적어 두면
 * 모든 줄이 함께 흔들린다 — 그리는 쪽이 마지막에 `height / 2`만 빼서 가운데 좌표로 옮긴다.
 */
export const STORY_PREVIEW = {
  /** 판 모서리 깎임. 판 높이를 따르면 칸을 여닫을 때 글줄 시작점(left)이 함께 움직인다. */
  bevel: 96,
  padTop: 30,
  titleSize: 32,
  titleDivider: 92,
  /** 적 칸 머리줄(총 전투력 · 적 정보 ▾)의 높이. */
  enemyHeader: 78,
  /** 펼친 적 칸. 표식은 칸 윗변에서, 발끝·이름줄은 같은 윗변에서 잰다. */
  enemyBody: { badgeTop: 38, ground: 292, nameY: 312, height: 364 },
  /** 줄거리 칸 머리줄 — 적 칸보다 낮다. */
  storyHeader: 60,
  storyText: { size: 24, inset: 56, padTop: 2, padBottom: 22 },
  reward: { labelGap: 20, labelSize: 22, frame: 96, gap: 118, rowGap: 16, padBottom: 30 },
} as const;

export interface StoryPreviewLayoutInput {
  enemiesOpen: boolean;
  storyOpen: boolean;
  /** 줄거리가 없는 관문은 줄거리 칸 자체를 세우지 않는다. */
  hasStory: boolean;
  /** 펼친 줄거리 글의 실제 높이(재서 넘긴다). */
  storyTextHeight: number;
  rewardCount: number;
}

export interface StoryPreviewLayout {
  height: number;
  titleY: number;
  dividers: number[];
  enemyHeaderY: number;
  /** 펼친 적 칸의 윗변. 접혀 있으면 없다. */
  enemyBodyTop?: number;
  storyHeaderY?: number;
  storyTextY?: number;
  rewardLabelY?: number;
  rewardRowY?: number;
}

/** 여닫힌 상태에서 각 줄의 자리와 판 높이를 판 윗변 기준으로 구한다. */
export function storyPreviewLayout(input: StoryPreviewLayoutInput): StoryPreviewLayout {
  const spec = STORY_PREVIEW;
  const dividers: number[] = [spec.titleDivider];
  let cursor = spec.titleDivider;
  const enemyHeaderY = cursor + spec.enemyHeader / 2;
  cursor += spec.enemyHeader;
  let enemyBodyTop: number | undefined;
  if (input.enemiesOpen) {
    enemyBodyTop = cursor;
    cursor += spec.enemyBody.height;
  }
  let storyHeaderY: number | undefined;
  let storyTextY: number | undefined;
  if (input.hasStory) {
    dividers.push(cursor);
    storyHeaderY = cursor + spec.storyHeader / 2;
    cursor += spec.storyHeader;
    if (input.storyOpen) {
      storyTextY = cursor + spec.storyText.padTop;
      cursor += spec.storyText.padTop + input.storyTextHeight + spec.storyText.padBottom;
    }
  }
  let rewardLabelY: number | undefined;
  let rewardRowY: number | undefined;
  if (input.rewardCount > 0) {
    dividers.push(cursor);
    rewardLabelY = cursor + spec.reward.labelGap;
    rewardRowY = rewardLabelY + spec.reward.labelSize + spec.reward.rowGap + spec.reward.frame / 2;
    cursor = rewardRowY + spec.reward.frame / 2 + spec.reward.padBottom;
  } else {
    cursor += spec.reward.padBottom;
  }
  return { height: cursor, titleY: spec.padTop, dividers, enemyHeaderY, enemyBodyTop, storyHeaderY, storyTextY, rewardLabelY, rewardRowY };
}

/** 보상 액자 줄의 x. 판 폭 안에 들도록 간격만 좁힌다. */
export function storyPreviewRewardColumns(count: number, width = NODE_ENEMY_PREVIEW.width): number[] {
  const { frame, gap } = STORY_PREVIEW.reward;
  const step = Math.min(gap, (width - 120 - frame) / Math.max(1, count - 1));
  return Array.from({ length: count }, (_, index) => (index - (count - 1) / 2) * step);
}
