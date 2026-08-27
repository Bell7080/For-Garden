/**
 * 전투 상태 표시의 1080×1920 기준 배치표다.
 *
 * 상태의 실제 소유자는 `src/core/skirmish.ts`이며, 이 순수 모델은 씬이 그 결과를 체력 바 주변에
 * 겹치지 않게 놓도록 좌표만 계산한다. Phaser 객체나 별도의 상태 타이머를 소유하지 않는다.
 */
export const BATTLE_STATUS_LAYOUT = {
  badgeSize: 26,
  badgeRadius: 13,
  /** 체력 바 왼쪽 끝에서 첫 뱃지 중심까지의 거리와 동시 표시 간 고정 간격이다. */
  firstOffsetX: 62,
  badgeGap: 30,
  /** 회복 숫자는 체력 바 아래, SD 상체 위에서 시작해 프로필 영역과 떨어져 떠오른다. */
  popupBodyOffsetRatio: 0.72,
  popupRise: 86,
} as const;

export interface StatusBadgeOffsets {
  stunX: number;
  bleedX: number;
}

/** 기절을 체력 바 가까이에 고정하고, 출혈은 기절이 함께 있을 때만 한 칸 바깥으로 민다. */
export function statusBadgeOffsets(stunned: boolean): StatusBadgeOffsets {
  const first = -BATTLE_STATUS_LAYOUT.firstOffsetX;
  return {
    stunX: first,
    bleedX: first - (stunned ? BATTLE_STATUS_LAYOUT.badgeGap : 0),
  };
}
