import { BASE_WIDTH } from "../config/gameConfig";
import { DIALOGUE_PANEL_TOP } from "./dialogueStageLayout";

/**
 * 대사판 안의 자리표 — 화자 이름표 · 소속/직책 한 줄 · 본문 · 선택지.
 *
 * 이름표는 판 윗선에 걸터앉고(공용 제목표), 그 바로 아래에 **누구인가를 한 줄 더 말하는 수식어**
 * (「테러조 간부」 · 「앱솔루트 팽」)가 소속 엠블럼과 함께 선다. 본문은 그 줄 밑에서 시작하고,
 * 선택지는 판 위·조작 칩 줄 위에 쌓여 스탠딩을 가리는 대신 어둠 한 겹 위에서 또렷하게 읽힌다.
 *
 * Phaser 없는 모듈이라 화면과 회귀 테스트(`tests/unit/dialoguePanelLayout.test.ts`)가 같은 값을 읽는다.
 */
export const DIALOGUE_PANEL = {
  name: { x: 82, y: DIALOGUE_PANEL_TOP - 10, size: 44 },
  /** 소속·직책 수식어. 엠블럼은 글자 왼쪽에 서고, 엠블럼이 없는 소속은 글자만 같은 자리에 선다. */
  title: { x: 96, y: DIALOGUE_PANEL_TOP + 50, size: 26, emblem: 38, gap: 12 },
  body: { x: 92, y: DIALOGUE_PANEL_TOP + 104, size: 38, minSize: 26, width: BASE_WIDTH - 184, bottom: DIALOGUE_PANEL_TOP + 404 },
  next: { x: BASE_WIDTH - 100, y: DIALOGUE_PANEL_TOP + 424 },
  /** 조작 칩 줄(자동·로그·숨기기)의 윗변. 선택지는 이 위에서 끝난다. */
  toolsTop: DIALOGUE_PANEL_TOP - 62 - 31,
  choice: { width: BASE_WIDTH - 120, height: 136, gap: 24, fontSize: 40, minFontSize: 28, clearance: 36, shadeAlpha: 0.55, shadePad: 56 },
} as const;

/** 본문이 들어갈 높이. 진행 표식(▼) 위에서 끝난다. */
export function dialogueBodyHeight(): number {
  return DIALOGUE_PANEL.body.bottom - DIALOGUE_PANEL.body.y;
}

/** `count`개 선택지 중 `index`번째의 가운데 y. 마지막 선택지의 밑변이 조작 칩 줄보다 `clearance` 위에 선다. */
export function dialogueChoiceY(index: number, count: number): number {
  const { height, gap, clearance } = DIALOGUE_PANEL.choice;
  const bottom = DIALOGUE_PANEL.toolsTop - clearance;
  const lastCenter = bottom - height / 2;
  return lastCenter - (count - 1 - index) * (height + gap);
}

/** 선택지 뒤에 까는 어둠의 위·아래. */
export function dialogueChoiceShade(count: number): { top: number; bottom: number } {
  const { height, shadePad } = DIALOGUE_PANEL.choice;
  return { top: dialogueChoiceY(0, count) - height / 2 - shadePad, bottom: DIALOGUE_PANEL_TOP - 10 };
}
