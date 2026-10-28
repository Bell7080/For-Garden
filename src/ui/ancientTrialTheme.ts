/**
 * 고대 지층 시련마다의 결 — 미리보기 판이 그 층의 시련을 색과 문양으로 한 번 더 말한다.
 *
 * Phaser를 읽지 않는다. 문양은 가운데가 (0,0)이고 반지름이 1인 상자 안의 다각형들이라 그리는 쪽이 크기만 곱한다.
 * 판 위에서는 아주 옅게만 깔린다(`ANCIENT_TRIAL_BACKDROP`) — 적 SD와 글줄보다 먼저 읽히면 안 된다.
 */
import type { AncientTrialId } from "../data/ancientStrataEncounters";

export interface TrialBackdrop {
  /** 판을 물들이는 색 — 윗변 강조선과 옅은 물듦, 문양이 같은 색을 쓴다. */
  readonly tone: number;
  readonly motif: readonly (readonly { x: number; y: number }[])[];
}

const p = (...xy: number[]) => Array.from({ length: xy.length / 2 }, (_, i) => ({ x: xy[i * 2], y: xy[i * 2 + 1] }));

export const ANCIENT_TRIAL_THEME: Readonly<Record<AncientTrialId, TrialBackdrop>> = {
  // 강인 — 버티는 몸: 굵은 십자
  endurance: { tone: 0x6fe08a, motif: [p(-0.28, -0.95, 0.28, -0.95, 0.28, -0.28, 0.95, -0.28, 0.95, 0.28, 0.28, 0.28, 0.28, 0.95, -0.28, 0.95, -0.28, 0.28, -0.95, 0.28, -0.95, -0.28, -0.28, -0.28)] },
  // 방벽 — 방패
  armor: { tone: 0x8fb4ff, motif: [p(-0.8, -0.92, 0.8, -0.92, 0.8, 0.12, 0, 1, -0.8, 0.12)] },
  // 맹공 — 엇갈린 두 칼날
  assault: { tone: 0xff6a4d, motif: [p(-0.95, -0.78, -0.78, -0.95, 0.95, 0.78, 0.78, 0.95), p(0.95, -0.78, 0.78, -0.95, -0.95, 0.78, -0.78, 0.95)] },
  // 초읽기 — 모래시계
  deadline: { tone: 0xffc24d, motif: [p(-0.72, -0.95, 0.72, -0.95, 0.06, 0, -0.06, 0), p(-0.06, 0, 0.06, 0, 0.72, 0.95, -0.72, 0.95)] },
  // 결계 — 육각
  shield: { tone: 0x5fe0ff, motif: [p(0, -1, 0.87, -0.5, 0.87, 0.5, 0, 1, -0.87, 0.5, -0.87, -0.5)] },
  // 과충전 — 번개
  charge: { tone: 0xc58bff, motif: [p(0.2, -1, -0.62, 0.14, -0.06, 0.14, -0.26, 1, 0.62, -0.22, 0.06, -0.22)] },
  // 속공 — 앞으로 겹쳐 달리는 두 꺾쇠
  frenzy: { tone: 0x4dffc3, motif: [p(-0.95, -0.85, -0.5, -0.85, 0.05, 0, -0.5, 0.85, -0.95, 0.85, -0.4, 0), p(-0.1, -0.85, 0.35, -0.85, 0.95, 0, 0.35, 0.85, -0.1, 0.85, 0.45, 0)] },
  // 급소 — 가운데를 겨누는 네 갈래 조준
  precision: { tone: 0xff4d9a, motif: [p(-0.12, -1, 0.12, -1, 0.12, -0.35, -0.12, -0.35), p(0.35, -0.12, 1, -0.12, 1, 0.12, 0.35, 0.12), p(-0.12, 0.35, 0.12, 0.35, 0.12, 1, -0.12, 1), p(-1, -0.12, -0.35, -0.12, -0.35, 0.12, -1, 0.12), p(0, -0.18, 0.18, 0, 0, 0.18, -0.18, 0)] },
};

/** 판 위 자리 — 오른쪽 위 모서리(깎이지 않은 쪽)에 크게, 옅게. */
export const ANCIENT_TRIAL_BACKDROP = {
  washAlpha: 0.1,
  edgeAlpha: 0.75,
  motifAlpha: 0.09,
  motifRadius: 120,
  /** 판 오른쪽 변·윗변에서 문양 가운데까지 */
  motifInset: { right: 170, top: 150 },
} as const;
