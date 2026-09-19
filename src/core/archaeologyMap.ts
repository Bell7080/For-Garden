import type { ArchaeologySiteDefinition } from "../data/archaeologySites";
import type { StrataLayerDefinition, StrataRewardKind, StrataZoneTone } from "../data/strataLayers";

/** 기대 확률을 별로 바꾸는 유일한 표다. UI별 임의 기준을 금지한다. */
export const ARCHAEOLOGY_STAR_THRESHOLDS = [0, 0.045, 0.09, 0.16, 0.24] as const;
export type ArchaeologyPreviewReward = Extract<StrataRewardKind, "rawStone" | "rune" | "gold">;

/** 구역 출현 가중치와 그 구역의 실제 보상 가중치를 합성한 한 칸의 실질 확률이다. */
export function strataRewardProbability(layer: StrataLayerDefinition, kind: ArchaeologyPreviewReward): number {
  const tones = Object.keys(layer.toneWeight) as StrataZoneTone[];
  const toneTotal = tones.reduce((sum, tone) => sum + Math.max(0, layer.toneWeight[tone]), 0);
  if (toneTotal <= 0) return 0;
  return tones.reduce((probability, tone) => {
    const rewardTotal = layer.rewards.reduce((sum, reward) => sum + Math.max(0, reward.weight[tone]), 0);
    const weight = layer.rewards.find((reward) => reward.kind === kind)?.weight[tone] ?? 0;
    return probability + (layer.toneWeight[tone] / toneTotal) * (rewardTotal > 0 ? weight / rewardTotal : 0);
  }, 0);
}

/** 실제 분포가 기준표의 어느 구간인지 1~5 별로 반환한다. */
export function rewardStarRating(layer: StrataLayerDefinition, kind: ArchaeologyPreviewReward): number {
  const probability = strataRewardProbability(layer, kind);
  return Math.max(1, ARCHAEOLOGY_STAR_THRESHOLDS.filter((threshold) => probability >= threshold).length);
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
