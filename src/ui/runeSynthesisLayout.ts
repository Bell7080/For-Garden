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
  /** 삼각형의 중심에서 꼭짓점까지. */
  radius: 280,
  /** 꼭짓점 칸 한 변. */
  slot: 210,
  /** 가운데 빛의 크기. 룬이 모여 터지는 자리다. */
  core: 120,
  /** 확률 판. 합성대 밑변에서 이만큼 아래에 선다. */
  oddsGap: 26,
  oddsHeight: 380,
  /**
   * 확률 판 안의 한 줄 — 이름표 → 게이지 → 칸마다 `■ 이름 N%` 범례.
   *
   * **수치는 막대 안에 넣지 않는다.** 밝은 등급색 위의 작은 글자는 뭉개지고, 2%처럼 좁은 칸은
   * 숫자가 들어갈 자리가 없어 통째로 사라졌다. 막대는 기운 쪽만 말하고 숫자는 그 아래 범례가 맡는다.
   * y는 판 윗변에서 잰다.
   */
  oddsRows: [{ label: 70, bar: 114, legend: 168 }, { label: 236, bar: 280, legend: 334 }],
  oddsBar: 40,
  /** 범례의 등급색 칸 한 변과 글자 크기. */
  oddsSwatch: 22,
  oddsLabelSize: 26,
  oddsNameSize: 24,
  oddsPercentSize: 36,
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

/** 삼각형의 중심 — 합성대 판의 가운데에서 위아래만 맞춘다. */
export function runeSynthesisCenter(screenWidth: number): { x: number; y: number } {
  const bounds = runeSynthesisPlateBounds(screenWidth);
  // 꼭짓점 칸이 판 안에 들도록, 위 꼭짓점과 아래 두 꼭짓점의 가운데가 판 가운데에 오게 내린다.
  const middle = (bounds.top + bounds.bottom) / 2;
  return { x: (bounds.left + bounds.right) / 2, y: middle + RUNE_SYNTHESIS.radius / 4 };
}

/** 꼭짓점 셋 — 위 → 오른쪽 아래 → 왼쪽 아래(시계 방향). 넣는 순서도 이 차례다. */
export function runeSynthesisVertices(screenWidth: number): ReadonlyArray<{ x: number; y: number }> {
  const center = runeSynthesisCenter(screenWidth);
  return [0, 1, 2].map((index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / 3;
    return { x: center.x + Math.cos(angle) * RUNE_SYNTHESIS.radius, y: center.y + Math.sin(angle) * RUNE_SYNTHESIS.radius };
  });
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
