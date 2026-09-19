import type { ArchaeologySiteDefinition } from "../data/archaeologySites";
import { STRATA_LAYERS, STRATA_REWARD_DISPLAY, type StrataLayerDefinition, type StrataRewardDisplayGroup, type StrataZoneTone } from "../data/strataLayers";

/** 같은 보상 그룹의 최고 유적 대비 기대 수량 비율을 1~5별로 나누는 유일한 표다. */
export const ARCHAEOLOGY_STAR_RATIO_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8] as const;
/** 한 판에서 한 번이라도 나올 확률이 이 값보다 낮으면 별 대신 희귀 상태로 말한다. */
export const ARCHAEOLOGY_VERY_RARE_CHANCE = 0.01;
export type ArchaeologyPreviewReward = Extract<StrataRewardDisplayGroup, "rawStone" | "rune" | "gold">;

/** 구역 출현 가중치와 그 구역의 실제 보상 가중치를 합성한 한 칸의 실질 확률이다. */
export function strataRewardProbability(layer: StrataLayerDefinition, group: ArchaeologyPreviewReward): number {
  const tones = Object.keys(layer.toneWeight) as StrataZoneTone[];
  const toneTotal = tones.reduce((sum, tone) => sum + Math.max(0, layer.toneWeight[tone]), 0);
  if (toneTotal <= 0) return 0;
  return tones.reduce((probability, tone) => {
    const rewardTotal = layer.rewards.reduce((sum, reward) => sum + Math.max(0, reward.weight[tone]), 0);
    const weight = layer.rewards.reduce((sum, reward) => STRATA_REWARD_DISPLAY[reward.kind].group === group ? sum + Math.max(0, reward.weight[tone]) : sum, 0);
    return probability + (layer.toneWeight[tone] / toneTotal) * (rewardTotal > 0 ? weight / rewardTotal : 0);
  }, 0);
}

/**
 * 구역 확률 × 해당 구역의 보상 확률 × 수량 중간값 × 굴착 횟수로 한 유적의 기대 획득량을 구한다.
 * 따라서 별은 특정 타일의 위치나 정확한 드롭률이 아니라, 판 전체를 다 팠을 때의 상대적 기대다.
 */
export function strataRewardExpectedAmount(layer: StrataLayerDefinition, group: ArchaeologyPreviewReward): number {
  const tones = Object.keys(layer.toneWeight) as StrataZoneTone[];
  const toneTotal = tones.reduce((sum, tone) => sum + Math.max(0, layer.toneWeight[tone]), 0);
  if (toneTotal <= 0) return 0;
  const perDig = tones.reduce((total, tone) => {
    const rewardTotal = layer.rewards.reduce((sum, reward) => sum + Math.max(0, reward.weight[tone]), 0);
    if (rewardTotal <= 0) return total;
    const expectedInTone = layer.rewards.reduce((sum, reward) => {
      if (STRATA_REWARD_DISPLAY[reward.kind].group !== group) return sum;
      const averageAmount = (Math.max(0, reward.min) + Math.max(0, reward.max)) / 2;
      return sum + (Math.max(0, reward.weight[tone]) / rewardTotal) * averageAmount;
    }, 0);
    return total + (Math.max(0, layer.toneWeight[tone]) / toneTotal) * expectedInTone;
  }, 0);
  return perDig * Math.max(0, layer.digs);
}

export type ArchaeologyRewardRating = { readonly state: "unavailable" | "veryRare" | "stars"; readonly stars: 0 | 1 | 2 | 3 | 4 | 5 };

/** 같은 보상끼리 유적 전체 기대량을 비교하며, 0과 1% 미만은 억지로 별 하나를 주지 않는다. */
export function rewardExpectationRating(layer: StrataLayerDefinition, group: ArchaeologyPreviewReward, referenceLayers: readonly StrataLayerDefinition[] = STRATA_LAYERS): ArchaeologyRewardRating {
  const expected = strataRewardExpectedAmount(layer, group);
  if (expected <= 0) return { state: "unavailable", stars: 0 };
  const perRunChance = 1 - ((1 - strataRewardProbability(layer, group)) ** Math.max(0, layer.digs));
  if (perRunChance < ARCHAEOLOGY_VERY_RARE_CHANCE) return { state: "veryRare", stars: 0 };
  const maximum = Math.max(...referenceLayers.map((candidate) => strataRewardExpectedAmount(candidate, group)), 0);
  const ratio = maximum > 0 ? expected / maximum : 0;
  const stars = ARCHAEOLOGY_STAR_RATIO_THRESHOLDS.filter((threshold) => ratio > threshold).length as 1 | 2 | 3 | 4 | 5;
  return { state: "stars", stars };
}

/** 레벨과 선행 완료를 모두 서버와 UI가 같은 방식으로 판정한다. */
export function archaeologySiteAvailability(site: ArchaeologySiteDefinition, level: number, completedSiteIds: readonly string[]): { available: boolean; missingLevel: number; missingPrerequisiteIds: string[] } {
  const missingPrerequisiteIds = site.prerequisiteSiteIds.filter((id) => !completedSiteIds.includes(id));
  return { available: level >= site.minimumLevel && missingPrerequisiteIds.length === 0, missingLevel: Math.max(0, site.minimumLevel - level), missingPrerequisiteIds };
}

export interface ArchaeologyCamera { x: number; y: number }
/** 양축 카메라가 지도 바깥을 노출하지 않도록 닫힌 범위로 제한한다. */
export function clampArchaeologyCamera(camera: ArchaeologyCamera, viewport: { width: number; height: number }, world: { width: number; height: number }): ArchaeologyCamera {
  return { x: Math.min(0, Math.max(Math.min(0, viewport.width - world.width), camera.x)), y: Math.min(0, Math.max(Math.min(0, viewport.height - world.height), camera.y)) };
}

/** 버튼과 동일한 누적 거리 기준으로 탭과 팬을 가른다. */
export function isArchaeologyMapDrag(start: ArchaeologyCamera, end: ArchaeologyCamera, threshold: number): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > threshold;
}
