/**
 * 유적 미리보기 창의 자리 계산.
 *
 * Phaser 없이 읽히는 순수 규칙만 둔다 — 창 높이를 손으로 적어 두면 보상 줄이 늘거나 언어를
 * 바꿀 때마다 아래 여백이 어긋나고, 안쪽 판이 몸판의 깎인 모서리 밖으로 삐져나간다.
 * **높이는 쌓인 내용에서 거꾸로 구한다.**
 */

/** 팝업 몸판과 같은 비율 규칙으로 깎는다. 이 값은 `PopupLayer`가 쓰는 것과 반드시 같아야 한다. */
export const POPUP_BODY_BEVEL_RATIO = 0.14;

const BASE = {
  width: 880,
  /**
   * 창 좌우 안쪽 여백.
   *
   * 위쪽 여백과 **합쳐서** 몸판의 깎인 왼쪽 위 모서리를 넘어야 안쪽 판이 그 빗변 안에 든다.
   */
  padX: 56,
  /** 유적 이름은 몸판 윗변에 걸터앉는 공용 제목표가 맡는다 — 창 안의 첫 줄은 판 규격이다. */
  subtitleTop: 72,
  subtitleToPanel: 44,
  /** 기대 획득 한 줄의 높이. 이름표와 다섯 칸 게이지가 마주 본다. */
  rowHeight: 74,
  /** 제목표가 윗변에 걸터앉으므로 판 안의 첫 줄은 그보다 아래에서 시작한다. */
  panelPadTop: 54,
  panelPadBottom: 24,
  panelToReason: 48,
  reasonToButton: 64,
  buttonHeight: 92,
  bottomPad: 42,
  gauge: { width: 330, height: 30 },
} as const;

export interface ArchaeologySitePopupLayout {
  width: number;
  height: number;
  /** 아래는 모두 판 가운데를 원점으로 한 창 안쪽 좌표다. */
  subtitleY: number;
  panel: { y: number; width: number; height: number };
  /** 기대 획득 줄의 중심 y. 순서는 넘긴 보상 순서 그대로다. */
  rowYs: number[];
  labelX: number;
  gaugeX: number;
  gauge: { width: number; height: number };
  reasonY: number;
  buttonY: number;
  buttonWidth: number;
  buttonHeight: number;
  /** 닫기·시작 두 버튼의 중심 x다. */
  buttonCenters: readonly [number, number];
}

/** 보상 줄 수만 받으면 창 하나의 모든 자리가 나온다. */
export function archaeologySitePopupLayout(rows: number): ArchaeologySitePopupLayout {
  const safeRows = Math.max(1, Math.floor(rows));
  const panelHeight = BASE.panelPadTop + safeRows * BASE.rowHeight + BASE.panelPadBottom;
  const height = BASE.subtitleTop + BASE.subtitleToPanel
    + panelHeight + BASE.panelToReason + BASE.reasonToButton + BASE.buttonHeight / 2 + BASE.bottomPad;
  const top = -height / 2;
  const subtitleY = top + BASE.subtitleTop;
  const panelTop = subtitleY + BASE.subtitleToPanel;
  const panelWidth = BASE.width - BASE.padX * 2;
  const reasonY = panelTop + panelHeight + BASE.panelToReason;
  const buttonY = reasonY + BASE.reasonToButton;
  const buttonWidth = (panelWidth - 28) / 2;
  return {
    width: BASE.width,
    height,
    subtitleY,
    panel: { y: panelTop + panelHeight / 2, width: panelWidth, height: panelHeight },
    rowYs: Array.from({ length: safeRows }, (_, index) => panelTop + BASE.panelPadTop + BASE.rowHeight * (index + 0.5)),
    labelX: -panelWidth / 2 + 26,
    // 게이지는 판 오른쪽 변에서 물러나 선다. 이름표는 왼쪽에 붙어 둘이 마주 본다.
    gaugeX: panelWidth / 2 - 26 - BASE.gauge.width / 2,
    gauge: BASE.gauge,
    reasonY,
    buttonY,
    buttonWidth,
    buttonHeight: BASE.buttonHeight,
    buttonCenters: [-(buttonWidth + 28) / 2, (buttonWidth + 28) / 2],
  };
}
