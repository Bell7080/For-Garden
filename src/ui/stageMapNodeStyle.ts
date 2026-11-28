/**
 * 스토리 지도 노드의 상태와 생김새 — Phaser 없이 읽히는 순수 표.
 *
 * 노드는 네 상태로만 갈린다(응태 2026-11-28 — 「뭘 깼는지 · 안 깼는지 · 지금 어디가 최신인지 구별이 안 간다」).
 * - **깬 곳**(`cleared`): 난이도 색으로 채운 칩 + 오른쪽 위 모서리의 체크 딱지. 지나온 길(세로축)도 같은 색으로 차 있다.
 * - **지금 차례**(`current`): 아직 깨지 않은 본편 중 가장 앞 관문 하나. 한 뼘 크고, 둘레에 난이도 색 빛이 숨 쉬며,
 *   머리 위 꺾쇠가 통통 떠서 "여기"를 짚는다. 지도 하나에 하나뿐이다.
 * - **열렸지만 아직**(`open`): 어두운 칩에 난이도 색 테두리 — 서브(SUB)처럼 본편 밖에서 열린 곳이다. 서브면 「NEW」가 붙는다.
 * - **잠김**(`locked`): 거의 비친 칩, 흐린 번호, 모서리에 자물쇠 — 노드 전체가 한 번 더 비친다.
 *
 * 글자를 적지 않는다 — 색·채움·모서리 표식·움직임만으로 갈라 어느 언어에서나 같게 읽힌다.
 * 모든 난이도 지도가 같은 표를 읽고 색만 그 난이도의 것(`STORY_DIFFICULTY`)을 쓴다.
 */
export type StageNodeState = "cleared" | "current" | "open" | "locked";

export function stageNodeState(input: { unlocked: boolean; completed: boolean; current: boolean }): StageNodeState {
  if (input.completed) return "cleared";
  if (!input.unlocked) return "locked";
  return input.current ? "current" : "open";
}

export const STAGE_MAP_NODE = {
  /** 본편 칩 한 변. */
  size: 96,
  /** 서브 칩은 한 뼘 작다 — 곁가지로 읽히게. */
  subSize: 84,
  /** 칩 깎임 — 한 변에 대한 비율(왼쪽 위·오른쪽 아래). */
  bevelRatio: 0.31,
  /** 지금 차례 칩의 배율. */
  currentScale: 1.14,
  /**
   * 서브가 본편 세로축에서 떨어진 거리(px). 360이던 때는 본편과 따로 떠 있어 서브가 있는 줄 모르는 사람이 있었다 —
   * 좁혀서 갈라져 나온 본편 관문과 한 덩어리로 읽히게 한다. 이름줄(글자 28)이 화면 밖·본편 이름과 겹치지 않는 선이다.
   */
  subOffset: 260,
  /** 본편이 세로축 양옆으로 엇갈리는 거리. */
  mainOffset: 110,
  /** 칩 상태별 판. alpha는 판, edgeAlpha는 윗변 강조선. */
  plate: {
    cleared: { alpha: 0.96, edgeAlpha: 0.9 },
    current: { alpha: 0.96, edgeAlpha: 1 },
    open: { alpha: 0.92, edgeAlpha: 0.8 },
    locked: { alpha: 0.4, edgeAlpha: 0.14 },
  },
  /**
   * 잠긴 노드는 칩·번호·자물쇠·가지·이름을 통째로 한 번 더 비친다(고대 지층의 잠긴 층과 같은 결 —
   * 판만 옅게 하면 번호와 자물쇠가 그대로 떠 열린 칸과 무게가 비슷하게 읽혔다).
   */
  locked: { nodeAlpha: 0.6, nameAlpha: 0.38, branchAlpha: 0.45 },
  /** 모서리 딱지(체크·자물쇠) — 칩 오른쪽 위(깎이지 않은 모서리)에 걸터앉는다. */
  corner: { size: 34, offsetRatio: 0.42, glyphRatio: 0.62 },
  /** 지금 차례 둘레의 숨 쉬는 빛 — 같은 실루엣을 키워 겹친다. */
  glow: { grow: 1.32, alphaFrom: 0.16, alphaTo: 0.5, scaleTo: 1.1, ms: 900 },
  /** 머리 위 꺾쇠 — 칩 윗변 위로 `gap`만큼 떠서 `bob`만큼 오르내린다. */
  marker: { size: 34, gap: 30, bob: 10, ms: 620 },
  /** 세로축 — 지나온 길만 난이도 색으로 덧긋는다. */
  axis: { width: 6, progressWidth: 7, progressAlpha: 0.9 },
  /** 가지선 두께 — 본편 / 서브. 열린 서브의 가지는 난이도 색으로 옅게 물들어 「갈 수 있다」를 말한다. */
  branch: { main: 4, sub: 3, subOpenAlpha: 0.7 },
  /** 서브의 「NEW」 — 칩 왼쪽 위에 걸터앉는다(오른쪽 위는 상태 딱지 자리). */
  subNew: { scale: 0.72, dx: -0.46, dy: -0.62 },
} as const;

/** 서브 노드의 가로 자리 — 갈라져 나온 본편 관문의 **반대편**으로 뻗는다(같은 쪽이면 가지선이 본편 노드를 지나간다). */
export function subNodeOffset(anchorRow: number): number {
  const anchorOnLeft = anchorRow % 2 === 0;
  return anchorOnLeft ? STAGE_MAP_NODE.subOffset : -STAGE_MAP_NODE.subOffset;
}
