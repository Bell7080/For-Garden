/**
 * 노드 미리보기가 화면 가장자리와 겹치지 않도록 쓰는 순수 배치 계약이다.
 *
 * **판은 SD가 서고도 남을 만큼 높다.** 좁게 잡으면 머리가 판 윗변의 구분선에 닿아 잘린 것처럼
 * 보인다 — 카드 그리드가 첫 줄에 머리 여유를 두는 것과 같은 이유다. 아래로도 이름·레벨 줄과
 * 종합 전투력 한 줄이 더 들어가므로 그만큼 키웠다.
 */
export const NODE_ENEMY_PREVIEW = { width: 900, height: 470, sdHeight: 200, tailGap: 96 } as const;

/** 판 안에서 한 적이 차지하는 세로 자리. 표식(속성·직군·돌파)이 이 상자의 모서리에 붙는다. */
export const NODE_ENEMY_SLOT = {
  /** SD 발끝이 서는 판 안쪽 y. */
  ground: 118,
  /** 제목 아래 구분선. SD 머리 끝은 이 선에 닿지 않는다. */
  dividerY: -168,
  /** 이름·레벨 줄과 그 아래 능력치 줄. */
  nameY: 132,
  statsY: 168,
  /** 아래 구분선과 종합 전투력 한 줄. */
  footerDividerY: 196,
  powerY: 214,
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
export function anchorEnemyPreview(nodeY: number, top: number, bottom: number, height = NODE_ENEMY_PREVIEW.height): { y: number; above: boolean } {
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
