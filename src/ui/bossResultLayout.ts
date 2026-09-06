/** Phaser 없이 폰토스 결과 화면의 실제 점유 영역을 검증하기 위한 사각형이다. */
export interface BossResultBounds { left: number; top: number; width: number; height: number }

/**
 * 1080×1920 결과 화면의 순수 배치표다.
 *
 * 보상 액자, 점수 본문, 보조 행동, 주 행동을 위에서 아래로 분리해 글꼴 배율이나 보상 개수가
 * 바뀌어도 각 영역의 계약을 테스트에서 먼저 깨뜨리도록 한다.
 */
export const BOSS_RESULT_LAYOUT = {
  viewport: { width: 1080, height: 1920 },
  title: { x: 540, y: 260 },
  rewards: { left: 80, top: 390, width: 920, height: 340, frameSize: 142, frameGap: 178 },
  score: { left: 90, top: 790, width: 900, height: 500 },
  utilities: {
    y: 1450, height: 88, width: 330, gap: 28,
  },
  lobby: { left: 230, top: 1640, width: 620, height: 112 },
} as const;

/** 중심 좌표로 그리는 두 보조 버튼을 각각 실제 bounds로 바꾼다. */
export function bossResultUtilityBounds(): readonly [BossResultBounds, BossResultBounds] {
  const { width, gap, height, y } = BOSS_RESULT_LAYOUT.utilities;
  const total = width * 2 + gap;
  const firstLeft = (BOSS_RESULT_LAYOUT.viewport.width - total) / 2;
  return [
    { left: firstLeft, top: y - height / 2, width, height },
    { left: firstLeft + width + gap, top: y - height / 2, width, height },
  ];
}

/** 가장자리가 맞닿는 것은 허용하되 실제 면적이 겹치면 true다. */
export function bossResultBoundsOverlap(a: BossResultBounds, b: BossResultBounds): boolean {
  return a.left < b.left + b.width && a.left + a.width > b.left
    && a.top < b.top + b.height && a.top + a.height > b.top;
}
