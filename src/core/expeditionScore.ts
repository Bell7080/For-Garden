import { EXPEDITION_NODE_SCORE_MULTIPLIERS, EXPEDITION_SCORE_BALANCE } from "../data/expedition";
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
 *
 * 층 기본값에 원정대 평균 잔여 HP 1%당 가산을 더한 뒤 노드 종류 배율을 적용한다. 두 계수는
 * `EXPEDITION_SCORE_BALANCE`가 소유한다 — 노드는 총점의 주인이 아니라 참가 점수이므로, 무게를
 * 바꿀 때 폰토스 피해 환산과 **한 표에서 함께** 본다. 미클리어·비전투·보스와 검증 불가능한
 * 입력은 0점이다.
 */
export function calculateExpeditionNodeScore(input: ExpeditionNodeScoreInput): number {
  if (!input.cleared || !Number.isInteger(input.floor) || input.floor < 1
    || !Number.isFinite(input.remainingHpPercent) || input.remainingHpPercent < 0 || input.remainingHpPercent > 100) return 0;
  const multiplier = EXPEDITION_NODE_SCORE_MULTIPLIERS[input.nodeType];
  if (multiplier === 0) return 0;
  const { perFloor, perRemainingHpPercent } = EXPEDITION_SCORE_BALANCE;
  return Math.round((input.floor * perFloor + input.remainingHpPercent * perRemainingHpPercent) * multiplier);
}

/**
 * 폰토스에게 넣은 피해를 점수판의 수로 바꾼다.
 *
 * 보스는 방어가 매우 높아 원 피해가 세 자릿수에 머문다. 그 값을 그대로 순위표에 세우면 노드
 * 참가 점수에 묻히므로 여기서 한 번만 환산한다 — **전투 계산에는 절대 들어가지 않는다.**
 */
export function expeditionBossDamageScore(totalDamage: number): number {
  if (!Number.isFinite(totalDamage) || totalDamage <= 0) return 0;
  return Math.round(totalDamage * EXPEDITION_SCORE_BALANCE.bossDamagePerPoint);
}
