/**
 * 유적 미리보기 창의 자리 계산.
 *
 * Phaser 없이 읽히는 순수 규칙만 둔다 — 창 높이를 손으로 적어 두면 보상 줄이 늘거나 언어를
 * 바꿀 때마다 아래 여백이 어긋나고, 안쪽 판이 몸판의 깎인 모서리 밖으로 삐져나간다.
 * **높이는 쌓인 내용에서 거꾸로 구한다.**
 */

/** 팝업 몸판과 같은 비율 규칙으로 깎는다. 이 값은 `PopupLayer`가 쓰는 것과 반드시 같아야 한다. */
export { POPUP_BODY_BEVEL_RATIO } from "./popupGeometry";

const BASE = {
  width: 880,
  /**
   * 창 좌우 안쪽 여백.
   *
   * 위쪽 여백과 **합쳐서** 몸판의 깎인 왼쪽 위 모서리를 넘어야 안쪽 판이 그 빗변 안에 든다.
   */
  padX: 56,
  /**
   * 유적 이름은 몸판 윗변에 걸터앉는 공용 제목표가 맡는다 — 창 안의 첫 줄은 판 규격 칸 둘이다
   * (판 크기 · 굴착 횟수). 「5×5 · 굴착 8회 · 권장 LV.1」 한 줄 흐린 글로 두던 때는 판의 크기와
   * 한 판에 휘두를 수가 곁말로 읽혔다(응태 2026-11-23).
   */
  specsTop: 50,
  specsHeight: 112,
  specsGap: 22,
  specsToPanel: 56,
  /** 해금 레벨 표식 — 제목표의 반대쪽, 몸판 윗변 오른쪽에 걸터앉는다. */
  unlockTag: { width: 214, height: 56, inset: 64 },
  /** 기대 획득 한 줄의 높이. 이름표와 열 칸 게이지가 마주 본다. */
  rowHeight: 74,
  /** 제목표가 윗변에 걸터앉으므로 판 안의 첫 줄은 그보다 아래에서 시작한다. */
  panelPadTop: 54,
  panelPadBottom: 24,
  /** 판(또는 결정 띠) 아래에서 시간 레이어까지. */
  panelToStatus: 30,
  /**
   * 결정 띠. 노란 글 한 줄로 두던 때는 이유 줄과 같은 무게라 결정이 맺혔는지 눈에 걸리지 않았다 —
   * 판 아래에 결정색 띠 한 장(단계 마름모 + 두 줄 글)으로 세운다.
   */
  crystalGap: 30,
  crystalHeight: 104,
  /**
   * 시간 레이어 — 지금 들어갈 수 있는지와 그 시간(재탐사까지 · 탐사 후 잠금)을 한 장이 말한다.
   * 맨 글자 한 줄(「탐사 가능」)이 버튼 위에 떠 있던 자리다.
   */
  statusHeight: 96,
  statusToButton: 34,
  buttonHeight: 92,
  bottomPad: 42,
  gauge: { width: 330, height: 30 },
} as const;

export interface ArchaeologySitePopupLayout {
  width: number;
  height: number;
  /** 아래는 모두 판 가운데를 원점으로 한 창 안쪽 좌표다. */
  /** 판 규격 칸 둘(판 크기 · 굴착 횟수). 중심 x는 `xs`, 둘은 같은 크기다. */
  specs: { y: number; width: number; height: number; xs: readonly [number, number] };
  /** 해금 레벨 표식 — 몸판 윗변 오른쪽에 걸터앉는다. */
  unlockTag: { x: number; y: number; width: number; height: number };
  panel: { y: number; width: number; height: number };
  /** 기대 획득 줄의 중심 y. 순서는 넘긴 보상 순서 그대로다. */
  rowYs: number[];
  labelX: number;
  gaugeX: number;
  gauge: { width: number; height: number };
  /** 결정 띠. 결정이 없는 유적에서는 쓰지 않는다. */
  crystal: { y: number; width: number; height: number };
  /** 시간 레이어. */
  status: { y: number; width: number; height: number };
  buttonY: number;
  buttonWidth: number;
  buttonHeight: number;
  /**
   * 「탐사 시작」 버튼의 중심 x다. 닫는 길은 판 밖 우하단 뒤로가기와 판 밖 누르기라 판 안에 닫기를 두지 않는다
   * (응태 2026-11-11 · 2026-11-22) — 진행 버튼 하나만 가운데에 선다.
   */
  startX: number;
}

/** 보상 줄 수만 받으면 창 하나의 모든 자리가 나온다. */
export function archaeologySitePopupLayout(rows: number, withCrystal = false): ArchaeologySitePopupLayout {
  const safeRows = Math.max(1, Math.floor(rows));
  const panelHeight = BASE.panelPadTop + safeRows * BASE.rowHeight + BASE.panelPadBottom;
  const extra = withCrystal ? BASE.crystalGap + BASE.crystalHeight : 0;
  const height = BASE.specsTop + BASE.specsHeight + BASE.specsToPanel
    + panelHeight + extra + BASE.panelToStatus + BASE.statusHeight + BASE.statusToButton + BASE.buttonHeight + BASE.bottomPad;
  const top = -height / 2;
  const panelWidth = BASE.width - BASE.padX * 2;
  const specsY = top + BASE.specsTop + BASE.specsHeight / 2;
  const specWidth = (panelWidth - BASE.specsGap) / 2;
  const specOffset = (specWidth + BASE.specsGap) / 2;
  const panelTop = top + BASE.specsTop + BASE.specsHeight + BASE.specsToPanel;
  const crystalTop = panelTop + panelHeight + BASE.crystalGap;
  const statusY = panelTop + panelHeight + extra + BASE.panelToStatus + BASE.statusHeight / 2;
  const buttonY = statusY + BASE.statusHeight / 2 + BASE.statusToButton + BASE.buttonHeight / 2;
  const tag = BASE.unlockTag;
  const buttonWidth = Math.round(panelWidth * 0.6);
  return {
    width: BASE.width,
    height,
    specs: { y: specsY, width: specWidth, height: BASE.specsHeight, xs: [-specOffset, specOffset] },
    unlockTag: { x: BASE.width / 2 - tag.inset - tag.width / 2, y: top, width: tag.width, height: tag.height },
    panel: { y: panelTop + panelHeight / 2, width: panelWidth, height: panelHeight },
    rowYs: Array.from({ length: safeRows }, (_, index) => panelTop + BASE.panelPadTop + BASE.rowHeight * (index + 0.5)),
    labelX: -panelWidth / 2 + 26,
    // 게이지는 판 오른쪽 변에서 물러나 선다. 이름표는 왼쪽에 붙어 둘이 마주 본다.
    gaugeX: panelWidth / 2 - 26 - BASE.gauge.width / 2,
    gauge: BASE.gauge,
    crystal: { y: crystalTop + BASE.crystalHeight / 2, width: panelWidth, height: BASE.crystalHeight },
    status: { y: statusY, width: panelWidth, height: BASE.statusHeight },
    buttonY,
    buttonWidth,
    buttonHeight: BASE.buttonHeight,
    startX: 0,
  };
}
