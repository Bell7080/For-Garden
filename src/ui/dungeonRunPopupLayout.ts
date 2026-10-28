/**
 * 던전 입구의 **횟수 창** 자리 — 자동 전투와 소탕이 함께 쓰는 한 장의 순수 배치표.
 *
 * 위에서부터 **단계 이름 → 횟수 판(큰 수 · MIN/MAX · − 막대 +) → 스테미나 충전 칸 셋 → 갈래 줄(자동 전투는
 * 옵션 두 칩, 소탕은 소탕권 줄) → 예상 소모 | 예상 획득 → 확정 버튼**이고, 취소는 판 밖 우하단의 공용
 * 뒤로가기가 맡는다. 좌표는 판 윗변 기준(`top` = 0)이며 판 높이는 확정 버튼에서 거꾸로 구한다.
 *
 * 막대의 값 셈(`runSliderValue`·`runSliderRatio`)도 여기 둔다 — 손가락 자리에서 횟수를 고르는 규칙을
 * 화면을 띄우지 않고 테스트로 고정하기 위해서다.
 */
export const DUNGEON_RUN_POPUP = {
  width: 900,
  /** 판 좌우 안쪽 여백. 안쪽 판이 몸판의 깎인 왼쪽 위 모서리를 넘지 않게 위 여백과 함께 본다. */
  padX: 56,
  tierY: 96,
  /** 횟수 판 — 큰 수가 가운데, MIN·MAX가 양옆, 그 아래 − 막대 +. */
  count: {
    top: 140, height: 248,
    plateY: 64, plateWidth: 300, plateHeight: 92, valueSize: 52,
    sideWidth: 150, sideHeight: 72, sideGap: 24,
    sliderY: 192, stepSize: 66, trackHeight: 34, knobWidth: 34, knobHeight: 62, trackGap: 22,
    /** 한 판의 스테미나 — 큰 수 아래 작은 한 줄. */
    perRunY: 128,
  },
  /** 스테미나 충전 — 제목표와 같은 크기의 칸 셋. */
  recharge: { titleY: 432, top: 462, height: 188, gap: 16 },
  /** 갈래 줄 — 자동 전투는 옵션 칩 둘, 소탕은 소탕권 줄. */
  branch: { y: 712, height: 84, adWidth: 270, adHeight: 62, adGap: 16, icon: 52 },
  /** 예상 소모(왼쪽) | 예상 획득(오른쪽). */
  summary: { top: 776, height: 214, titleY: 38, frame: 104, frameY: 128, gap: 126, valueSize: 34 },
  notice: { y: 1018, size: 22 },
  confirm: { y: 1104, width: 460, height: 116, fontSize: 38 },
  bottomPad: 56,
} as const;

/** 충전 칸 한 장의 안쪽 자리(칸 가운데 기준). 그림 → 회복량 → 버튼. */
export const DUNGEON_RUN_CELL = {
  frameX: -56, frameY: -34, frameSize: 84,
  gainX: 42, gainY: -50, gainSize: 36,
  nameX: 42, nameY: -14, nameSize: 19,
  buttonY: 58, buttonHeight: 54, padX: 12,
} as const;

export type DungeonRunMode = "auto" | "sweep";

/**
 * 두 창의 **색 한 벌**. 판·막대·확정 버튼이 모두 이 색을 읽는다 — 같은 틀이지만 무엇을 여는 창인지가
 * 첫눈에 갈려야 한다. 자동 전투는 맑은 비취(손을 떼고 흘려보내는 흐름), 소탕은 호박빛(한 번에 거두는
 * 수확)이다. 게임의 금빛 강조(`COLOR.accent`)를 사이에 두고 한쪽은 차갑게, 한쪽은 따뜻하게 비켜 섰다.
 */
export const DUNGEON_RUN_TONE: Readonly<Record<DungeonRunMode, { accent: number; accentText: string; deep: number; glass: number }>> = {
  auto: { accent: 0x5fd6b4, accentText: "#8eead0", deep: 0x0c2a24, glass: 0x0f1d1c },
  sweep: { accent: 0xf2a84a, accentText: "#ffc988", deep: 0x2e1d08, glass: 0x1d1710 },
};

export function dungeonRunPopupHeight(): number {
  const { confirm, bottomPad } = DUNGEON_RUN_POPUP;
  return confirm.y + confirm.height / 2 + bottomPad;
}

/** 안쪽 판의 폭. */
export function dungeonRunInnerWidth(): number {
  return DUNGEON_RUN_POPUP.width - DUNGEON_RUN_POPUP.padX * 2;
}

/** 막대 줄의 조각 자리(판 가운데 기준) — 왼쪽 −, 가운데 막대, 오른쪽 +. */
export function dungeonRunSliderSpan(): { minus: number; plus: number; trackLeft: number; trackWidth: number } {
  const inner = dungeonRunInnerWidth();
  const { stepSize, trackGap } = DUNGEON_RUN_POPUP.count;
  const pad = 28;
  const minus = -inner / 2 + pad + stepSize / 2;
  const plus = inner / 2 - pad - stepSize / 2;
  const trackLeft = minus + stepSize / 2 + trackGap;
  const trackWidth = plus - stepSize / 2 - trackGap - trackLeft;
  return { minus, plus, trackLeft, trackWidth };
}

/** 충전 칸 셋의 가운데 x와 한 칸의 폭. */
export function dungeonRunRechargeCells(): { width: number; centers: readonly [number, number, number] } {
  const inner = dungeonRunInnerWidth();
  const { gap } = DUNGEON_RUN_POPUP.recharge;
  const width = (inner - gap * 2) / 3;
  const first = -inner / 2 + width / 2;
  return { width, centers: [first, first + width + gap, first + (width + gap) * 2] };
}

/**
 * 막대 위 자리(0~1)를 횟수로 — 가장 가까운 칸에 붙는다. 끝이 하나뿐(1~1)이면 언제나 그 값이다.
 */
export function runSliderValue(ratio: number, min: number, max: number): number {
  if (max <= min) return min;
  const clamped = Math.min(1, Math.max(0, ratio));
  return Math.round(min + clamped * (max - min));
}

/** 횟수를 막대 위 자리(0~1)로. 끝이 하나뿐이면 가득 찬 막대로 선다. */
export function runSliderRatio(value: number, min: number, max: number): number {
  if (max <= min) return 1;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
