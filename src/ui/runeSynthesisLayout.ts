/**
 * 룬 합성대의 순수 배치표다. 모든 y는 화면 좌표다.
 *
 * **위가 합성대(가운데 빛 + 나란한 재료 칸 셋), 가운데가 확률, 아래가 합성 버튼**이다. 특성 연구대와 같은 판·같은
 * 기둥(좌우 여백)을 써서 두 탭이 한 장비의 두 자리로 읽힌다.
 */
import { RESEARCH_BENCH, RESEARCH_SHIFT_X } from "./researchBenchLayout";

export const RUNE_SYNTHESIS = {
  /** 합성대 판의 위·아래. */
  top: 320,
  bottom: 1030,
  /** 재료 칸 한 변. */
  slot: 180,
  /** 가운데 빛의 크기. 룬이 모여 터지는 자리다. */
  core: 120,
  /** 확률 판. 합성대 밑변에서 이만큼 아래에 선다. */
  oddsGap: 26,
  oddsHeight: 380,
  /**
   * 확률 판 안의 한 줄 — 이름표 → 게이지 → 칸마다 범례(`■ 이름` 위, 굵은 `N%` 아래).
   *
   * **수치는 막대 안에 넣지 않는다.** 밝은 등급색 위의 작은 글자는 뭉개지고, 2%처럼 좁은 칸은
   * 숫자가 들어갈 자리가 없어 통째로 사라졌다. 막대는 기운 쪽만 말하고 숫자는 그 아래 범례가 맡는다.
   * **범례는 이름과 수를 위아래로 쌓는다** — 한 줄에 `■ 이름 N%`를 늘어놓던 때는 특성 줄이 다섯
   * 칸이 되면 칸 폭이 이름과 수를 다 담지 못해 이웃 칸의 글자와 맞붙었다(「특성 없음」은 눌려 뭉갰다).
   * y는 판 윗변에서 잰다.
   */
  oddsRows: [{ label: 56, bar: 94, name: 138, percent: 174 }, { label: 222, bar: 260, name: 304, percent: 340 }],
  oddsBar: 40,
  /** 범례의 등급색 칸 한 변과 글자 크기. */
  oddsSwatch: 22,
  oddsLabelSize: 26,
  oddsNameSize: 24,
  oddsPercentSize: 34,
  /** 범례 칸끼리 비우는 최소 폭. 이름이 넘치면 이 안에서 가로로만 누른다. */
  oddsCellGap: 12,
  /** 확률이 바뀌어 다시 그릴 때 칸이 왼쪽부터 차오르는 시간(ms). */
  oddsFillMs: 420,
  /** 터진 뒤 결과 룬과 판정 문구가 서 있는 시간(ms). 그다음 룬 쪽지가 열린다. */
  resultHoldMs: 900,
  resultSlot: 230,
  /** 합성 버튼. */
  buttonWidth: 720,
  buttonHeight: 112,
  buttonGap: 36,
  /** 룬이 가운데로 빨려 드는 시간(ms). 터지기까지 0.7초를 넘기지 않는다. */
  gatherMs: 620,
} as const;

/** 판 좌우. 특성 연구대와 같은 기둥에 상점 칩을 비키는 밀기까지 같다. */
export function runeSynthesisPlateBounds(screenWidth: number): { left: number; right: number; top: number; bottom: number } {
  return { left: RESEARCH_BENCH.inset + RESEARCH_SHIFT_X, right: screenWidth - RESEARCH_BENCH.inset + RESEARCH_SHIFT_X, top: RUNE_SYNTHESIS.top, bottom: RUNE_SYNTHESIS.bottom };
}

/**
 * 재료 칸 셋 — 왼쪽(1) → 가운데(2) → 오른쪽(3)으로 한 줄에 나란히 서고, 능력 판이 저마다 제 칸 바로 밑에 선다.
 *
 * 세 칸이 같은 높이·같은 폭이라 좌우가 맞고, 줄 수가 달라도 판의 윗변은 한 줄로 맞는다(응태 2026-11-18 —
 * 삼각형 꼭짓점 곁에 판을 붙이던 때는 판 자리가 칸마다 달라 뒤죽박죽이었고 밑동이 비었다). 칸 줄은 확률
 * 버튼(`RATES_SPOT.screen`) 밑에서 시작해 왼쪽 열의 칩들과 맞붙지 않고, 그 위 빈자리에는 셋이 모일 가운데
 * 빛이 선다.
 */
export function runeSynthesisVertices(screenWidth: number): ReadonlyArray<{ x: number; y: number }> {
  const I = RUNE_SYNTHESIS_INFO;
  const plate = runeSynthesisPlateBounds(screenWidth);
  const middle = (plate.left + plate.right) / 2;
  const step = (plate.right - plate.left - I.inset * 2 - I.width) / 2;
  const y = plate.bottom - I.insetY - runeSynthesisInfoHeight(I.maxLines) - I.gap - RUNE_SYNTHESIS.slot / 2;
  return [-1, 0, 1].map((column) => ({ x: middle + column * step, y }));
}

/** 가운데 빛 — 칸 줄 위 빈자리의 한가운데. 셋이 여기로 모여 터진다. */
export function runeSynthesisCenter(screenWidth: number): { x: number; y: number } {
  const plate = runeSynthesisPlateBounds(screenWidth);
  const middle = runeSynthesisVertices(screenWidth)[1];
  return { x: middle.x, y: (plate.top + middle.y - RUNE_SYNTHESIS.slot / 2) / 2 };
}

/** 확률 판의 자리. */
export function runeSynthesisOddsBounds(screenWidth: number): { left: number; right: number; top: number; bottom: number } {
  const plate = runeSynthesisPlateBounds(screenWidth);
  const top = plate.bottom + RUNE_SYNTHESIS.oddsGap;
  return { left: plate.left, right: plate.right, top, bottom: top + RUNE_SYNTHESIS.oddsHeight };
}

/** 합성 버튼의 중심. */
export function runeSynthesisButtonCenter(screenWidth: number): { x: number; y: number } {
  const odds = runeSynthesisOddsBounds(screenWidth);
  return { x: (odds.left + odds.right) / 2, y: odds.bottom + RUNE_SYNTHESIS.buttonGap + RUNE_SYNTHESIS.buttonHeight / 2 };
}

/** 넣은 룬의 능력 판(주 옵션 → 보조 옵션 → 특성). 제 칸 바로 밑에 칸과 가운데를 맞춰 선다. */
export const RUNE_SYNTHESIS_INFO = {
  width: 264,
  /** 칸과 판 사이. */
  gap: 18,
  /** 합성대 판 좌우 가장자리에서 비우는 폭. */
  inset: 18,
  /** 합성대 판 밑변에서 비우는 폭. */
  insetY: 12,
  /** 가장 긴 판의 줄 수 — 주 옵션 둘 + 보조 셋 + 특성. 칸 줄의 높이가 이 값으로 정해진다. */
  maxLines: 6,
  pad: 12,
  lineHeight: 30,
  mainSize: 23,
  subSize: 21,
} as const;

/** 줄 수에서 판 높이를 구한다. */
export function runeSynthesisInfoHeight(lines: number): number {
  return RUNE_SYNTHESIS_INFO.pad * 2 + Math.max(1, lines) * RUNE_SYNTHESIS_INFO.lineHeight;
}

/** 칸 `index`의 능력 판 자리(화면 좌표). */
export function runeSynthesisInfoBounds(screenWidth: number, index: number, lines: number): { left: number; right: number; top: number; bottom: number } {
  const I = RUNE_SYNTHESIS_INFO;
  const vertex = runeSynthesisVertices(screenWidth)[index];
  const top = vertex.y + RUNE_SYNTHESIS.slot / 2 + I.gap;
  return { left: vertex.x - I.width / 2, right: vertex.x + I.width / 2, top, bottom: top + runeSynthesisInfoHeight(lines) };
}
