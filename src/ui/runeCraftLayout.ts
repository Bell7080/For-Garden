/**
 * 룬 쪽지와 세공 판의 **순수 배치표**다.
 *
 * 두 판 모두 높이가 룬에 따라 달라진다 — 옵션 줄 수가 등급마다 다르기 때문이다. 높이를 손으로
 * 박아 두면 고급 룬에서는 아래가 통째로 비고 전설 룬에서는 마지막 줄이 판을 넘는다. 그래서
 * **쌓인 내용에서 거꾸로 높이를 구하고**, 화면은 여기서 꺼낸 값만 읽는다(스테미나 창과 같은
 * 방식이다). 자리를 화면에서 눈대중으로 정하면 판이 커질 때마다 어긋난 곳을 눈으로 찾아야 한다.
 *
 * 모든 y는 **판 윗변에서 아래로 잰 거리(px)**다. 화면은 `판 중심 - 높이/2`에 이 값을 더한다.
 */

/** 판 하나가 몇 줄을 담는지. 주 옵션은 늘 둘이지만 규칙을 셈으로 두어 화면이 예외를 만들지 않게 한다. */
export interface RuneOptionCounts {
  mainCount: number;
  subCount: number;
}

/** 세공 판의 고정 수치. 줄 수와 무관한 것만 둔다. */
export const RUNE_CRAFT_PANEL = {
  /** 판 한 변. 세로 화면(1080) 좌우에 70px씩 남는다. */
  width: 940,
  /** 판 가운데가 앉는 화면 y. 위로 올리면 액자가 상단 재화 줄에 닿는다. */
  centerY: 940,
  /** 줄 판이 판 좌우에서 안으로 들어오는 여백(양쪽 합). */
  rowInset: 88,
  /** 액자와 이름줄. */
  frame: { x: -378, y: 126, size: 132 },
  textX: -324,
  rarityY: 88,
  nameY: 116,
  nameWrap: 300,
  equippedY: 186,
  /** 지갑 칸. 세공은 골드를 쓰는 화면이라 늘 보인다. */
  wallet: { x: 330, y: 106, width: 180, height: 62 },
  /** 확률 수치 줄(글자 아래끝)과 막대. */
  chanceLabelY: 252,
  chanceBarY: 284,
  chanceLabelSize: 30,
  /** 수치 글자가 줄 양 끝에서 안으로 들어오는 거리. */
  chanceLabelInset: 40,
  mainLabelY: 352,
  firstMainY: 420,
  mainRow: { height: 88, step: 100 },
  /** 주 옵션 마지막 줄 아래끝에서 "보조 옵션" 이름표까지. */
  subLabelGap: 46,
  /** "보조 옵션" 이름표에서 첫 보조 줄 가운데까지. */
  subRowGap: 58,
  subRow: { height: 66, step: 76 },
  /** 보조 옵션이 없는 등급에 서는 한 줄의 아래끝(첫 줄 자리 기준). */
  emptySubHeight: 22,
  /** 마지막 줄 아래끝에서 구분선까지. */
  hairlineGap: 54,
  /** 구분선에서 결과 문구 윗끝까지. */
  noticeGap: 24,
  /** 구분선에서 버튼 가운데까지. */
  buttonGap: 120,
  button: { width: 560, height: 84 },
  /** 버튼 아래끝에서 판 밑변까지. */
  bottomMargin: 62,
} as const;

/**
 * 줄 안의 세공 표식 자리.
 *
 * 세 칸이 먼저 서고 그 뒤 빈 자리가 각인 몫이다. 크기는 **성공·실패·각인이 거의 같다** —
 * 각인을 키우면 한 줄 안에서 다른 종류의 표식으로 읽히고 그 칸 하나가 룬 전체보다 먼저 눈에
 * 들어온다. 완성은 크기가 아니라 빛이 말한다.
 */
export const RUNE_CRAFT_MARKS = {
  firstX: 150,
  step: 66,
  engraveX: 380,
  mainOuter: 24,
  subOuter: 21,
  engraveOuter: 25,
  /** 표식이 줄 오른쪽 끝에서 최소한 이만큼 떨어져 있어야 한다. */
  edgeMargin: 8,
  /** 옵션 이름이 표식 왼쪽에서 멈추는 폭. */
  labelWrap: 330,
} as const;

/** 세공 판 한 장의 자리. `y`는 모두 판 윗변 기준이다. */
export interface RuneCraftLayout {
  height: number;
  rowWidth: number;
  mainRows: readonly number[];
  subRows: readonly number[];
  subLabelY: number;
  emptySubY: number;
  hairlineY: number;
  noticeY: number;
  buttonY: number;
}

/** 옵션 줄 수에서 세공 판의 높이와 모든 y를 구한다. */
export function runeCraftLayout({ mainCount, subCount }: RuneOptionCounts): RuneCraftLayout {
  const panel = RUNE_CRAFT_PANEL;
  const mainRows = Array.from({ length: Math.max(0, mainCount) }, (_, index) => panel.firstMainY + index * panel.mainRow.step);
  const mainBottom = (mainRows.at(-1) ?? panel.firstMainY) + panel.mainRow.height / 2;
  const subLabelY = mainBottom + panel.subLabelGap;
  const emptySubY = subLabelY + panel.subRowGap;
  const subRows = Array.from({ length: Math.max(0, subCount) }, (_, index) => emptySubY + index * panel.subRow.step);
  // 보조 옵션이 없는 등급도 "없다" 한 줄이 그 자리에 서므로 높이를 함께 센다 — 빼면 그 등급만
  // 구분선이 글자 위로 올라온다.
  const rowsBottom = subRows.length > 0
    ? (subRows.at(-1) ?? emptySubY) + panel.subRow.height / 2
    : emptySubY + panel.emptySubHeight;
  const hairlineY = rowsBottom + panel.hairlineGap;
  const buttonY = hairlineY + panel.buttonGap;
  return {
    height: buttonY + panel.button.height / 2 + panel.bottomMargin,
    rowWidth: panel.width - panel.rowInset,
    mainRows,
    subRows,
    subLabelY,
    emptySubY,
    hairlineY,
    noticeY: hairlineY + panel.noticeGap,
    buttonY,
  };
}

/**
 * 룬 쪽지의 고정 수치.
 *
 * 쪽지도 **화면 가운데에 선다.** 누른 자리에 붙이면 판이 커진 만큼 화면 가장자리로 밀려
 * 우하단 공용 뒤로가기와 겹치고, 어디를 눌렀는지에 따라 같은 창이 매번 다른 자리에서 열린다.
 */
export const RUNE_NOTE_PANEL = {
  width: 640,
  centerY: 960,
  /** 잠금·즐겨찾기 칩 한 줄. */
  chip: { x: -244, y: 84, size: 52, gap: 62 },
  frame: { x: -204, y: 196, size: 136 },
  textX: -124,
  rarityY: 148,
  nameY: 174,
  nameWrap: 300,
  equippedY: 232,
  hairlineY: 288,
  hairlineWidth: 520,
  firstStatY: 332,
  statStep: 50,
  /** 옵션 이름과 수치가 판 좌우에서 안으로 들어오는 거리. */
  statInset: 52,
  /** 마지막 옵션 줄 아래끝에서 세공 진행 한 줄까지. */
  progressGap: 34,
  /** 진행 줄에서 버튼 줄 가운데까지. */
  buttonGap: 84,
  buttonHeight: 74,
  bottomMargin: 46,
} as const;

/** 룬 쪽지 한 장의 자리. `y`는 모두 판 윗변 기준이다. */
export interface RuneNoteLayout {
  height: number;
  statRows: readonly number[];
  progressY: number;
  buttonY: number;
}

/** 옵션 줄 수에서 쪽지의 높이와 모든 y를 구한다. */
export function runeNoteLayout(statCount: number): RuneNoteLayout {
  const panel = RUNE_NOTE_PANEL;
  const statRows = Array.from({ length: Math.max(0, statCount) }, (_, index) => panel.firstStatY + index * panel.statStep);
  const statsBottom = (statRows.at(-1) ?? panel.firstStatY) + panel.statStep / 2;
  const progressY = statsBottom + panel.progressGap;
  const buttonY = progressY + panel.buttonGap;
  return {
    height: buttonY + panel.buttonHeight / 2 + panel.bottomMargin,
    statRows,
    progressY,
    buttonY,
  };
}
