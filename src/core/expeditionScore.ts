import { EXPEDITION_NODE_SCORE_MULTIPLIERS } from "../data/expedition";
import type { ExpeditionNodeType } from "./expeditionMap";

/** 서버가 검증 가능한 일반 노드 종료 스냅샷만 담으며 재화 RNG는 의도적으로 제외한다. */
export interface ExpeditionNodeScoreInput {
  floor: number;
  nodeType: ExpeditionNodeType;
  remainingHpPercent: number;
  cleared: boolean;
}

/**
 * 일반 노드 하나의 확정 점수를 계산하는 단일 공식이다.
 * 층당 1,000점에 원정대 평균 잔여 HP 1%당 30점을 더해 기존 3인 HP 합산 가치와 맞춘 뒤
 * 노드 종류 배율을 적용한다. 미클리어·비전투·보스와 검증 불가능한 입력은 0점이다.
 */
export function calculateExpeditionNodeScore(input: ExpeditionNodeScoreInput): number {
  if (!input.cleared || !Number.isInteger(input.floor) || input.floor < 1
    || !Number.isFinite(input.remainingHpPercent) || input.remainingHpPercent < 0 || input.remainingHpPercent > 100) return 0;
  const multiplier = EXPEDITION_NODE_SCORE_MULTIPLIERS[input.nodeType];
  if (multiplier === 0) return 0;
  return Math.round((input.floor * 1_000 + input.remainingHpPercent * 30) * multiplier);
}
