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
  /** 원정 증강 표식 줄. 버프 액자와 같은 높이에 더 작은 칩으로 선다. */
  augmentRow: { y: -229, chipSize: 40, gap: 7, maxVisible: 5 },
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

/**
 * 프로필 버프 액자의 겹 수가 앉는 자리.
 *
 * 머리 위 상태 칩(22px)의 값을 그대로 쓰면 56px 액자에서는 판이 점만큼 작아 숫자가 그 밖으로
 * 넘치고, 액자 색과 같은 글자라 그림 위에서 읽히지도 않는다. 크기에 비례해 키우고 **흰 글자에
 * 검은 테두리**를 둘러 어떤 액자 색 위에서도 같은 무게로 읽히게 한다.
 */
export function battleBuffStackSpot(size: number) {
  const plateRadius = Math.max(BATTLE_STATUS_LAYOUT.stackCount.plateRadius, size * 0.19);
  return {
    plateRadius,
    // 액자 오른쪽 아래는 빗변으로 깎여 있으므로 두 변에서 같은 만큼만 들어가면 그 빗변을 넘는다.
    x: size / 2 - plateRadius - 2,
    y: size / 2 - plateRadius - 2,
    fontSize: Math.max(BATTLE_STATUS_LAYOUT.stackCount.size, Math.round(size * 0.3)),
    strokeWidth: Math.max(3, Math.round(size * 0.075)),
  };
}

/**
 * 원정 증강 표식이 서는 줄.
 *
 * 버프 액자와 **같은 y·같은 왼쪽 끝**을 쓴다. 두 줄이 다른 자리에 서면 같은 프로필 위에서
 * 서로 다른 체계의 표식으로 읽힌다. 전투에는 증강이 없고 원정 지도에는 전투 버프가 없어
 * 두 줄이 한 화면에서 겹치지 않는다.
 */
export function expeditionAugmentChipOffsets(count: number): { x: number; y: number }[] {
  const row = BATTLE_PROFILE_LAYOUT.augmentRow;
  const buffs = BATTLE_PROFILE_LAYOUT.buffRow;
  // 왼쪽 끝은 버프 줄의 첫 슬롯과 같다. 개수가 늘어도 이미 읽고 있던 표식이 흔들리지 않게
  // 가운데 정렬하지 않고 **왼쪽부터 쌓는다.**
  const left = -(buffs.maxVisible * buffs.chipSize + (buffs.maxVisible - 1) * buffs.gap) / 2;
  return Array.from({ length: count }, (_, index) => ({
    x: left + row.chipSize / 2 + index * (row.chipSize + row.gap),
    y: row.y,
  }));
}

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

/** 머리 위 상태 칩 규격도 같은 전투 HUD 배치표에서 관리한다. */
export const BATTLE_STATUS_LAYOUT = {
  /**
   * 상태 칩 한 장.
   *
   * 예전에는 작은 마름모가 **체력 바 옆**에 붙었다. 옆으로 늘어놓으면 상태가 둘만 걸려도
   * 바가 밀려 어디까지가 체력인지 흐려지고, 겹 수를 적을 자리도 없었다. 지금은 **바 위**에
   * 한 줄로 서고, 칩 하나가 상태 하나다.
   */
  /**
   * 칩 한 장의 크기.
   *
   * 작게 둔다 — 여기서 읽어야 하는 것은 "무언가 묻어 있다"와 **어느 계열인가**(색·문양),
   * 그리고 겹 수뿐이다. 정확한 수치가 필요한 손은 눌러서 쪽지를 연다. 키우면 그만큼 SD와
   * 체력 바를 가린다.
   */
  chipSize: 22,
  chipGap: 4,
  /**
   * 머리 위 체력 바의 폭. 칩 줄이 **바 왼쪽 끝**부터 붙으므로 두 값이 갈리면 줄이 바를 벗어난다.
   * `UnitHealthBar`도 이 값을 읽어 한 곳만 고치면 둘이 함께 움직인다.
   */
  hpBarWidth: 96,
  /**
   * 체력 바 위로 띄우는 높이.
   *
   * 18일 때는 칩 아래 변(중심에서 11)이 바의 끝 빗금 꼭대기(중심에서 7.4)와 겹쳐, 지나간
   * 시간을 덮는 반투명 부채꼴이 바 위에 그대로 얹혔다. 칩 절반(11)에 바의 끝 빗금 절반(7.4)을
   * 더하고도 남을 만큼 띄운다.
   */
  chipRowLift: 28,
  /** 칩 아래 변이 바의 끝 빗금 꼭대기에 닿지 않는지 테스트가 이 값으로 잰다. */
  hpBarCapHalfHeight: 7.4,
  /**
   * 겹 수가 붙는 자리 — 칩 **우하단**이다.
   *
   * 가운데에 적으면 표식 그림과 숫자가 겹쳐 둘 다 흐려진다. 작은 판을 깔아 밝은 배경 원화
   * 위에서도 수가 살아남게 한다.
   *
   * **칩 안에 앉힌다.** 칩을 줄일 때 이 값이 예전 큰 칩 기준으로 남아 판이 칩 밖으로 4px
   * 넘쳐 **바로 아래 체력 바 위로 흘러내렸다.** 오른쪽 아래는 빗변으로 깎여 있어(`bevel`)
   * 두 변에서 같은 만큼만 들어가면 그 빗변을 넘는다 — 룬 액자의 표식과 같은 규칙이다.
   * `tests/unit/battleStatusLayout.test.ts`가 판이 칩 안에 드는지 지킨다.
   */
  stackCount: { offsetX: 4, offsetY: 4, size: 11, plateRadius: 4 },
  /** 칩 액자의 깎임. 겹 수 판이 이 빗변을 넘지 않아야 한다. */
  chipBevel: 8,
  /**
   * 지나간 시간을 덮는 반투명 검정의 진하기.
   *
   * 원형 게이지 대신 **덮이는 부채꼴**을 쓴다 — 고리는 칩 안에 선 하나를 더 그어 표식과 겹치고,
   * 이만큼 작은 칩에서는 그 선이 곧 그림이 된다. 덮이는 쪽은 아무 그림도 더하지 않고 남은 시간만 말한다.
   */
  clockAlpha: 0.62,
  /**
   * 수치가 뜨는 높이. SD 키의 몇 할 위인지만 정하고, **떠오르는 거리와 시간은 세기에 따라
   * 달라지므로** `src/ui/damageNumbers.ts`가 정한다.
   */
  popupBodyOffsetRatio: 0.72,
} as const;

/**
 * 상태 칩 `count`장이 설 x 좌표. **체력 바 왼쪽 끝**부터 오른쪽으로 붙는다.
 *
 * 순서는 고정이므로(기절→출혈→덧칠→손질) 같은 상태는 늘 같은 자리 근처에 서고, 첫 칸은
 * 무엇이 걸리든 바 왼쪽 끝이다 — 가운데 정렬하면 상태가 하나 붙을 때마다 줄 전체가 밀린다.
 */
export function unitStatusChipOffsets(count: number): number[] {
  const { chipSize, chipGap, hpBarWidth } = BATTLE_STATUS_LAYOUT;
  // 가운데 정렬하면 상태가 붙고 떨어질 때마다 이미 읽고 있던 칩까지 좌우로 흔들린다.
  // 바 왼쪽 끝에 붙여 두면 첫 칸은 늘 같은 자리다.
  const left = -hpBarWidth / 2;
  return Array.from({ length: count }, (_, index) => left + chipSize / 2 + index * (chipSize + chipGap));
}
