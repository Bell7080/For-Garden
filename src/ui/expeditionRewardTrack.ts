/**
 * 기록 보상 길.
 *
 * 보상 단계는 게이지 하나에 얹지 않는다. 게이지는 "지금 얼마나 찼나"만 말하지 "다음에 무엇이
 * 오나"는 못 말하기 때문이다. 그래서 아래에서 위로 뻗는 길 한 줄에 단계를 마디로 끊고, 보상은
 * 우·좌를 번갈아 가지처럼 내밀어 한 마디씩 눈으로 세게 한다.
 *
 * 좌표는 Phaser를 모르는 순수 값이다. `y`는 **길 바닥에서 잰 높이**이며, 그리는 쪽이 위로
 * 자라도록 부호만 뒤집어 쓴다.
 */

/** 길 한 줄의 고정 규격이다. 마디 간격이 곧 스크롤 길이를 정한다. */
export const REWARD_TRACK = {
  /** 마디와 마디 사이 */
  nodeGap: 250,
  /** 첫 마디 아래와 마지막 마디 위에 남기는 여백 */
  bottomPad: 150,
  topPad: 170,
  /** 길에서 보상 액자까지의 가로 거리 */
  branch: 250,
  railWidth: 16,
} as const;

export interface RewardTrackNode {
  index: number;
  /** 길 바닥에서 잰 높이 */
  y: number;
  /** 보상이 뻗어 나가는 쪽. 첫 마디가 오른쪽이고 그다음부터 번갈아 간다. */
  side: "left" | "right";
}

/** 아래에서 위로 쌓이는 마디 자리다. 보상은 우 → 좌 → 우 순서로 번갈아 뻗는다. */
export function expeditionRewardTrackNodes(count: number): RewardTrackNode[] {
  return Array.from({ length: Math.max(0, count) }, (_, index) => ({
    index,
    y: REWARD_TRACK.bottomPad + index * REWARD_TRACK.nodeGap,
    side: index % 2 === 0 ? "right" : "left",
  }));
}

/** 길 전체 길이. 마디가 없으면 길도 없다. */
export function expeditionRewardTrackHeight(count: number): number {
  if (count <= 0) return 0;
  return REWARD_TRACK.bottomPad + (count - 1) * REWARD_TRACK.nodeGap + REWARD_TRACK.topPad;
}

/**
 * 지금 누적 점수가 길의 어느 높이까지 왔는지.
 *
 * 마디 사이는 선형으로 채운다 — 다음 마디까지 얼마나 남았는지가 길이로 보여야 "조금만 더"가
 * 읽힌다. 첫 마디 아래에서는 바닥부터 첫 마디까지의 비율로만 차오른다.
 */
export function expeditionRewardTrackFillY(cumulative: number, thresholds: readonly number[]): number {
  const nodes = expeditionRewardTrackNodes(thresholds.length);
  if (nodes.length === 0) return 0;
  const score = Math.max(0, cumulative);
  const last = nodes[nodes.length - 1];
  if (score >= thresholds[thresholds.length - 1]) return last.y;
  for (let index = 0; index < thresholds.length; index += 1) {
    if (score >= thresholds[index]) continue;
    const previousThreshold = index === 0 ? 0 : thresholds[index - 1];
    const previousY = index === 0 ? 0 : nodes[index - 1].y;
    const span = Math.max(1, thresholds[index] - previousThreshold);
    const ratio = Math.min(1, Math.max(0, (score - previousThreshold) / span));
    return previousY + (nodes[index].y - previousY) * ratio;
  }
  return last.y;
}
