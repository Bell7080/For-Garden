/** 전투 프로필 한 칸의 1080×1920 기준 실제 외곽과 내부 기준선이다. */
export const BATTLE_PROFILE_LAYOUT = {
  cardWidth: 300,
  cardHeight: 300,
  glowSize: 378,
  hpTextBaselineY: 180,
  hpBarY: 194,
  hpBarHeight: 20,
  ferocityTextBaselineY: 252,
  ferocityBarY: 266,
  ferocityBarHeight: 16,
  barWidth: 300,
  /** 발광까지 포함한 로컬 bounds다. */
  bounds: { left: -189, right: 189, top: -189, bottom: 274 },
  battle: { centerY: 1620, centersX: [190, 540, 890], scale: 1 },
  /** 지도는 내부 치수를 바꾸지 않고 완성된 한 칸만 화면 폭에 맞춰 축소한다. */
  expedition: { centerY: 1450, centersX: [220, 540, 860], scale: 0.76 },
  sortieButton: { top: 1756, bottom: 1864 },
} as const;

/** 배율과 이동을 적용한 프로필의 화면 bounds를 순수 계산해 회귀 테스트와 공유한다. */
export function battleProfileBounds(x: number, y: number, scale: number) {
  const bounds = BATTLE_PROFILE_LAYOUT.bounds;
  return {
    left: x + bounds.left * scale,
    right: x + bounds.right * scale,
    top: y + bounds.top * scale,
    bottom: y + bounds.bottom * scale,
  };
}

/** 기존 머리 위 상태 뱃지 규격도 같은 전투 HUD 배치표에서 관리한다. */
export const BATTLE_STATUS_LAYOUT = {
  badgeSize: 26,
  badgeRadius: 13,
  firstOffsetX: 62,
  badgeGap: 30,
  popupBodyOffsetRatio: 0.72,
  popupRise: 86,
} as const;

export interface StatusBadgeOffsets { stunX: number; bleedX: number }

/** 기절을 체력 바 가까이에 고정하고 출혈은 동시 표시일 때만 한 칸 바깥으로 민다. */
export function statusBadgeOffsets(stunned: boolean): StatusBadgeOffsets {
  const first = -BATTLE_STATUS_LAYOUT.firstOffsetX;
  return { stunX: first, bleedX: first - (stunned ? BATTLE_STATUS_LAYOUT.badgeGap : 0) };
}
