/** 노드 미리보기가 화면 가장자리와 겹치지 않도록 쓰는 순수 배치 계약이다. */
export const NODE_ENEMY_PREVIEW = { width: 840, height: 320, sdHeight: 168, tailGap: 96 } as const;

/** 1/3/5기 모두 같은 판 안에서 좌우 대칭을 이루는 SD 중심을 계산한다. */
export function enemyPreviewColumns(count: number, width = NODE_ENEMY_PREVIEW.width): number[] {
  const safeCount = Math.max(1, count);
  const gap = Math.min(256, (width - 120) / Math.max(1, safeCount - 1));
  return Array.from({ length: safeCount }, (_, index) => (index - (safeCount - 1) / 2) * gap);
}

/** 노드 위 공간이 부족할 때만 아래로 뒤집고, 양쪽 안전 영역 안에 판 전체를 보존한다. */
export function anchorEnemyPreview(nodeY: number, top: number, bottom: number, height = NODE_ENEMY_PREVIEW.height): { y: number; above: boolean } {
  const aboveY = nodeY - height / 2 - NODE_ENEMY_PREVIEW.tailGap;
  const belowY = nodeY + height / 2 + NODE_ENEMY_PREVIEW.tailGap;
  const above = aboveY - height / 2 >= top;
  const intended = above ? aboveY : belowY;
  return { y: Math.min(bottom - height / 2, Math.max(top + height / 2, intended)), above };
}
