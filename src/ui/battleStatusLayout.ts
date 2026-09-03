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
  /**
   * 버프는 최대 폭을 기준으로 왼쪽부터 고정 슬롯을 쓴다. 개수가 바뀔 때 행을 다시 가운데
   * 맞추면 이미 읽고 있던 아이콘까지 좌우로 흔들리므로 빈 슬롯만 재사용한다.
   */
  buffRow: { y: -229, chipSize: 56, gap: 12, maxVisible: 4 },
  /** 발광과 그 위의 버프 액자까지 포함한 로컬 bounds다. */
  bounds: { left: -189, right: 189, top: -257, bottom: 274 },
  battle: { centerY: 1620, centersX: [190, 540, 890], scale: 1 },
  /**
   * 원정 지도의 생존 HUD는 전투와 **같은 크기**로 선다.
   *
   * 축소해 두면 같은 세 칸이 화면마다 다른 물건처럼 보이고, 전투에 들어가는 순간 카드가
   * 커지며 자리를 옮긴다. 가로 기준선은 전투와 완전히 같고 세로만 지도 화면의 출격 줄
   * 위로 올린다.
   */
  expedition: { centerY: 1460, centersX: [190, 540, 890], scale: 1 },
  sortieButton: { top: 1756, bottom: 1864 },
  /** 전장 SD 체력 바와 결과 조작이 점유하는 세로 안전 영역을 회귀 테스트와 공유한다. */
  collisionZones: { battlefieldHpBottom: 1260, ultimateInputTop: 1334, resultUiTop: 1380 },
} as const;

/** 고정 슬롯에 놓인 버프 액자의 로컬 bounds다. 정적 배치 테스트도 이 계산을 그대로 쓴다. */
export function battleBuffChipBounds(slot: number) {
  const row = BATTLE_PROFILE_LAYOUT.buffRow;
  const width = row.maxVisible * row.chipSize + (row.maxVisible - 1) * row.gap;
  const left = -width / 2 + slot * (row.chipSize + row.gap);
  return { left, right: left + row.chipSize, top: row.y - row.chipSize / 2, bottom: row.y + row.chipSize / 2 };
}

/** 배율과 이동을 적용한 프로필의 화면 bounds를 순수 계산해 회귀 테스트와 공유한다. */
export function battleProfileBounds(x: number, y: number, scale: number, showBuffs = false) {
  const bounds = BATTLE_PROFILE_LAYOUT.bounds;
  // 원정처럼 setBuffs를 쓰지 않는 읽기 전용 프로필에는 빈 버프 행의 예약 공간을 실제 외곽으로
  // 세지 않는다. 전투 HUD는 `showBuffs`로 액자가 생긴 상태까지 검사할 수 있다.
  const top = showBuffs ? bounds.top : -BATTLE_PROFILE_LAYOUT.glowSize / 2;
  return {
    left: x + bounds.left * scale,
    right: x + bounds.right * scale,
    top: y + top * scale,
    bottom: y + bounds.bottom * scale,
  };
}

/** 기존 머리 위 상태 뱃지 규격도 같은 전투 HUD 배치표에서 관리한다. */
export const BATTLE_STATUS_LAYOUT = {
  badgeSize: 26,
  badgeRadius: 13,
  firstOffsetX: 62,
  badgeGap: 30,
  /**
   * 수치가 뜨는 높이. SD 키의 몇 할 위인지만 정하고, **떠오르는 거리와 시간은 세기에 따라
   * 달라지므로** `src/ui/damageNumbers.ts`가 정한다.
   */
  popupBodyOffsetRatio: 0.72,
} as const;

export interface StatusBadgeOffsets { stunX: number; bleedX: number; overpaintX: number }

/**
 * 기절을 체력 바 가까이에 고정하고 나머지는 켜진 것만 한 칸씩 바깥으로 민다.
 *
 * 꺼진 상태의 자리를 비워 두지 않는 이유는, 빈칸을 남기면 하나가 사라질 때 남은 뱃지가
 * 제자리에 있는데도 줄이 비어 보이기 때문이다. 순서는 **행동을 막는 것부터** — 기절, 출혈,
 * 덧칠 순으로 체력 바에서 멀어진다.
 */
export function statusBadgeOffsets(stunned: boolean, bleeding = false): StatusBadgeOffsets {
  const first = -BATTLE_STATUS_LAYOUT.firstOffsetX;
  const gap = BATTLE_STATUS_LAYOUT.badgeGap;
  const bleedX = first - (stunned ? gap : 0);
  return { stunX: first, bleedX, overpaintX: bleedX - (bleeding ? gap : 0) };
}
