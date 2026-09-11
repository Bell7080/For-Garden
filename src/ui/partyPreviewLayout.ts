/**
 * 스토리 편성 화면 위쪽 — 시작 배치 미리보기의 세로 배치표.
 *
 * 화면이 좌표를 손으로 적지 않는 이유는, 여기서 겹치면 안 되는 것이 셋이나 되기 때문이다:
 * 적 이름줄, 두 편의 전투력이 마주 보는 줄, 그리고 **칸 밖으로 빠져나오는 아군 SD의 머리**다.
 * 전투력 줄을 눈대중으로 내렸다가 아군 정수리에 얹혔던 것이 실제로 그랬다(v0.95.x까지).
 * 값과 그 사이의 여백은 `tests/unit/partyPreviewLayout.test.ts`가 지킨다.
 */

/** 세 자리의 가로 중심. 고른 순서가 왼쪽부터의 자리를 정한다. */
export const PARTY_PREVIEW_COLUMNS = [270, 540, 810] as const;

/** SD가 발을 딛는 줄과 그 위로 차지하는 높이. 적은 위, 아군은 아래다. */
export const PARTY_PREVIEW = {
  enemyRow: 430,
  allyRow: 830,
  /** 두 줄을 가르는 대치선. 적 이름줄 아래, 아군 머리 위다. */
  frontLine: 556,
  /** SD 하나가 바닥에서 위로 차지하는 높이. 곧 머리 끝까지의 거리다. */
  height: 210,
  /** 자리 입력면·선택 밑판이 쓰는 칸 폭. */
  slotWidth: 210,
} as const;

export interface PreviewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 아군 자리의 입력면·드래그 칸. SD가 차지하는 높이 그대로다. */
export function partyAllySlotBox(slot: number): PreviewBox {
  return {
    x: PARTY_PREVIEW_COLUMNS[slot],
    y: PARTY_PREVIEW.allyRow - PARTY_PREVIEW.height / 2,
    width: PARTY_PREVIEW.slotWidth,
    height: PARTY_PREVIEW.height,
  };
}

/**
 * 아군 자리의 **밑판**. 입력면보다 위아래로 조금 더 품는다.
 *
 * 입력면과 같은 칸에 판을 깔면 판 윗변이 정수리에 딱 붙고 발끝이 밑변에 걸린다 — 발굴의
 * 칸처럼 머리 위와 발밑에 한 뼘씩 남겨 SD가 판 **안에** 선 것으로 읽히게 한다.
 */
export const PARTY_ALLY_PLATE = { top: 608, bottom: 846 } as const;

export function partyAllyPlateBox(slot: number): PreviewBox {
  const height = PARTY_ALLY_PLATE.bottom - PARTY_ALLY_PLATE.top;
  return {
    x: PARTY_PREVIEW_COLUMNS[slot],
    y: PARTY_ALLY_PLATE.top + height / 2,
    width: PARTY_PREVIEW.slotWidth,
    height,
  };
}

/** 밑판 중심에서 SD가 발을 딛는 줄까지의 거리. 발밑 투영 그림자가 이 값을 쓴다. */
export function partyAllyGroundOffset(): number {
  return PARTY_PREVIEW.allyRow - partyAllyPlateBox(0).y;
}

/**
 * 두 편의 총 전투력이 마주 보는 줄.
 *
 * **대치선 위에 걸터앉는다.** 아래로 내리면 아군 정수리에 얹혀 아군의 정보로 읽히고, 배경
 * 원화 위에 맨 글자로 두면 어느 쪽 수인지 이전에 글자부터 묻힌다. 그래서 판 한 장을 깔고
 * 선이 그 판 양옆으로 이어지게 둔다.
 */
export const PARTY_POWER_PLATE = { width: 470, height: 60 } as const;

export function partyPowerPlateBounds(): { top: number; bottom: number; left: number; right: number } {
  const y = PARTY_PREVIEW.frontLine;
  const cx = PARTY_PREVIEW_COLUMNS[1];
  return {
    top: y - PARTY_POWER_PLATE.height / 2,
    bottom: y + PARTY_POWER_PLATE.height / 2,
    left: cx - PARTY_POWER_PLATE.width / 2,
    right: cx + PARTY_POWER_PLATE.width / 2,
  };
}
