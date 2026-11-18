/**
 * 룬 합성대의 순수 배치표다. 모든 y는 화면 좌표다.
 *
 * **위가 합성대(삼각형), 가운데가 확률, 아래가 합성 버튼**이다. 특성 연구대와 같은 판·같은
 * 기둥(좌우 여백)을 써서 두 탭이 한 장비의 두 자리로 읽힌다.
 */
import { RESEARCH_BENCH, RESEARCH_SHIFT_X } from "./researchBenchLayout";

export const RUNE_SYNTHESIS = {
  /** 합성대 판의 위·아래. */
  top: 320,
  bottom: 1030,
  /** 꼭짓점 칸 한 변. 능력 판이 곁에 서도록 조금 작게 둔다. */
  slot: 160,
  /** 가운데 빛의 크기. 룬이 모여 터지는 자리다. */
  core: 100,
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
 * 꼭짓점 셋 — 위 왼쪽(1) → 위 오른쪽(2) → 아래 가운데(3). 넣는 순서도 이 차례다.
 *
 * **정보창의 룬 하트와 같은 짜임이다**(위 두 칸 · 아래 한 칸). 위 두 칸은 바깥쪽에 능력 판이 서도록
 * 판 끝에서 능력 판 폭만큼 안쪽에 서고, 아래 칸은 제 능력 판이 밑에 들 만큼 올라선다
 * (응태 2026-11-18 — 정삼각형 꼭짓점 곁에 판을 제각각 붙이던 때는 자리가 뒤죽박죽이었다).
 */
export function runeSynthesisVertices(screenWidth: number): ReadonlyArray<{ x: number; y: number }> {
  const I = RUNE_SYNTHESIS_INFO;
  const plate = runeSynthesisPlateBounds(screenWidth);
  const half = RUNE_SYNTHESIS.slot / 2;
  const topY = plate.top + I.insetY + half;
  const sideX = plate.left + I.inset + I.width + I.gap + half;
  const bottomY = plate.bottom - I.insetY - runeSynthesisInfoHeight(I.maxLines) - I.gap - half;
  const middle = (plate.left + plate.right) / 2;
  return [{ x: sideX, y: topY }, { x: plate.left + plate.right - sideX, y: topY }, { x: middle, y: bottomY }];
}

/** 가운데 빛 — 위 줄과 아래 칸의 한가운데. 무게중심으로 두면 위 두 칸에 붙는다. */
export function runeSynthesisCenter(screenWidth: number): { x: number; y: number } {
  const [left, , bottom] = runeSynthesisVertices(screenWidth);
  return { x: bottom.x, y: (left.y + bottom.y) / 2 };
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

/**
 * 넣은 룬의 능력 판(주 옵션 → 보조 옵션 → 특성). 칸마다 **바깥쪽 한 자리**에 선다 —
 * 위 왼쪽 칸은 왼쪽, 위 오른쪽 칸은 오른쪽(둘 다 칸 윗변에 맞춘다), 아래 칸은 바로 밑.
 *
 * 액자만으로는 등급과 두 주 옵션의 색만 읽혀, 무엇을 녹이는지 알려면 칸을 하나씩 눌러 봐야 했다
 * (응태 2026-11-18). 줄 수가 달라도 칸과 붙은 변은 움직이지 않는다.
 */
export const RUNE_SYNTHESIS_INFO = {
  width: 214,
  /** 칸과 판 사이. */
  gap: 18,
  /** 합성대 판 좌우 가장자리에서 비우는 폭. */
  inset: 18,
  /**
   * 합성대 판 위·아래 가장자리에서 비우는 폭. 왼쪽 판의 밑변이 확률 버튼(`RATES_SPOT.screen` — y 552,
   * 높이 68)의 윗변 위에서 끝나야 한다 — 긴 언어에서는 그 버튼이 320까지 넓어져 판 안으로 들어온다.
   */
  insetY: 10,
  /** 가장 긴 판의 줄 수 — 주 옵션 둘 + 보조 셋 + 특성. 아래 칸의 높이가 이 값으로 정해진다. */
  maxLines: 6,
  pad: 10,
  lineHeight: 28,
  mainSize: 22,
  subSize: 20,
} as const;

/** 줄 수에서 판 높이를 구한다. */
export function runeSynthesisInfoHeight(lines: number): number {
  return RUNE_SYNTHESIS_INFO.pad * 2 + Math.max(1, lines) * RUNE_SYNTHESIS_INFO.lineHeight;
}

/** 꼭짓점 `index`의 능력 판 자리(화면 좌표). */
export function runeSynthesisInfoBounds(screenWidth: number, index: number, lines: number): { left: number; right: number; top: number; bottom: number } {
  const I = RUNE_SYNTHESIS_INFO;
  const vertex = runeSynthesisVertices(screenWidth)[index];
  const height = runeSynthesisInfoHeight(lines);
  const half = RUNE_SYNTHESIS.slot / 2;
  if (index === 2) {
    const top = vertex.y + half + I.gap;
    return { left: vertex.x - I.width / 2, right: vertex.x + I.width / 2, top, bottom: top + height };
  }
  const top = vertex.y - half;
  const left = index === 0 ? vertex.x - half - I.gap - I.width : vertex.x + half + I.gap;
  return { left, right: left + I.width, top, bottom: top + height };
}
