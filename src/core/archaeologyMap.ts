import type { ArchaeologySiteDefinition } from "../data/archaeologySites";
import { STRATA_LAYERS, STRATA_REWARD_DISPLAY, type StrataLayerDefinition, type StrataRewardDisplayGroup, type StrataZoneTone } from "../data/strataLayers";

/**
 * 같은 보상 그룹의 최고 유적 대비 기대 수량 비율을 **다섯 칸 중 몇 칸**으로 나누는 유일한 표다.
 *
 * 예전에는 이 수가 별의 개수였다. 별 다섯 개는 세어야 알 수 있고 세 줄이 나란히 서면 열다섯
 * 개가 반짝여 어느 보상이 센지보다 별이 먼저 읽혔다 — 지금은 같은 수가 다섯 칸짜리 게이지의
 * 채움이라, 세지 않고 길이로 견준다.
 */
export const ARCHAEOLOGY_RATING_RATIO_THRESHOLDS = [0, 0.2, 0.4, 0.6, 0.8] as const;
/** 한 판에서 한 번이라도 나올 확률이 이 값보다 낮으면 칸 대신 희귀 상태로 말한다. */
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

/** 다섯 칸 게이지의 채움이다. `filled`는 `state`가 `rated`일 때만 뜻이 있다. */
export type ArchaeologyRewardRating = { readonly state: "unavailable" | "veryRare" | "rated"; readonly filled: 0 | 1 | 2 | 3 | 4 | 5 };

/** 같은 보상끼리 유적 전체 기대량을 비교하며, 0과 1% 미만은 억지로 한 칸을 주지 않는다. */
export function rewardExpectationRating(layer: StrataLayerDefinition, group: ArchaeologyPreviewReward, referenceLayers: readonly StrataLayerDefinition[] = STRATA_LAYERS): ArchaeologyRewardRating {
  const expected = strataRewardExpectedAmount(layer, group);
  if (expected <= 0) return { state: "unavailable", filled: 0 };
  const perRunChance = 1 - ((1 - strataRewardProbability(layer, group)) ** Math.max(0, layer.digs));
  if (perRunChance < ARCHAEOLOGY_VERY_RARE_CHANCE) return { state: "veryRare", filled: 0 };
  const maximum = Math.max(...referenceLayers.map((candidate) => strataRewardExpectedAmount(candidate, group)), 0);
  const ratio = maximum > 0 ? expected / maximum : 0;
  const filled = ARCHAEOLOGY_RATING_RATIO_THRESHOLDS.filter((threshold) => ratio > threshold).length as 1 | 2 | 3 | 4 | 5;
  return { state: "rated", filled };
}

/** 레벨과 선행 완료를 모두 서버와 UI가 같은 방식으로 판정한다. */
export function archaeologySiteAvailability(site: ArchaeologySiteDefinition, level: number, completedSiteIds: readonly string[]): { available: boolean; missingLevel: number; missingPrerequisiteIds: string[] } {
  const missingPrerequisiteIds = site.prerequisiteSiteIds.filter((id) => !completedSiteIds.includes(id));
  return { available: level >= site.minimumLevel && missingPrerequisiteIds.length === 0, missingLevel: Math.max(0, site.minimumLevel - level), missingPrerequisiteIds };
}

export interface ArchaeologyCamera { x: number; y: number }

export interface ArchaeologyMapSiteState { siteId: string; unlocked: boolean }

/** 진행 판 → 유효한 마지막 선택 → 가장 높은 해금 유적 → 첫 해금 유적 순으로 복원 대상을 고른다. */
export function resolveArchaeologyFocusSite(
  sites: readonly ArchaeologySiteDefinition[],
  states: readonly ArchaeologyMapSiteState[],
  activeSiteId: string | undefined,
  lastSelectedSiteId: string | null,
): ArchaeologySiteDefinition | undefined {
  const unlockedIds = new Set(states.filter(({ unlocked }) => unlocked).map(({ siteId }) => siteId));
  // 진행 판은 이미 입장 비용을 치른 서버 상태이므로 잠금 정책이 바뀌어도 가장 먼저 보여 준다.
  const active = activeSiteId === undefined ? undefined : sites.find(({ id }) => id === activeSiteId);
  if (active) return active;
  const selected = lastSelectedSiteId === null ? undefined : sites.find(({ id }) => id === lastSelectedSiteId && unlockedIds.has(id));
  if (selected) return selected;
  // 카탈로그 순서는 난이도 순서라는 암묵 규칙 대신 명시적인 해금 레벨로 최고 유적을 판정한다.
  return sites.filter(({ id }) => unlockedIds.has(id)).reduce<ArchaeologySiteDefinition | undefined>(
    (best, site) => best === undefined || site.minimumLevel > best.minimumLevel ? site : best,
    undefined,
  ) ?? sites[0];
}
/** 양축 카메라가 지도 바깥을 노출하지 않도록 닫힌 범위로 제한한다. */
export function clampArchaeologyCamera(camera: ArchaeologyCamera, viewport: { width: number; height: number }, world: { width: number; height: number }): ArchaeologyCamera {
  return { x: Math.min(0, Math.max(Math.min(0, viewport.width - world.width), camera.x)), y: Math.min(0, Math.max(Math.min(0, viewport.height - world.height), camera.y)) };
}

/** 버튼과 동일한 누적 거리 기준으로 탭과 팬을 가른다. */
export function isArchaeologyMapDrag(start: ArchaeologyCamera, end: ArchaeologyCamera, threshold: number): boolean {
  return Math.hypot(end.x - start.x, end.y - start.y) > threshold;
}

/**
 * 지도 노드 한 자리의 상태.
 *
 * **다섯 가지를 한 낱말로 뭉치지 않는다** — 「못 들어간다」는 이유가 잠김·선행 미완·횟수
 * 부족·재사용 대기로 저마다 다르고, 플레이어가 지금 할 일도 그만큼 다르다(레벨을 올린다 ·
 * 옆 유적을 판다 · 기다린다). 한 상태로 뭉쳐 두면 화면이 「탐사 불가」 한 마디만 말하게 된다.
 */
export type ArchaeologyNodeState = "active" | "available" | "cooling" | "completed" | "locked";

/**
 * 지금 그 노드가 어떤 자리인지 고른다.
 *
 * **진행 중인 판이 무엇보다 먼저다** — 그 자리는 이미 횟수를 치른 자리라 다른 어떤 표시도
 * 그보다 앞설 수 없다. 대기는 완료보다 앞선다: 완료는 지난 일이고 대기는 지금 막는 것이다.
 */
export function archaeologyNodeState(input: {
  unlocked: boolean;
  completed: boolean;
  /** 지금 재사용 대기 중인가. 남은 시간을 재는 일은 부른 쪽이 맡고 여기서는 켜짐/꺼짐만 읽는다. */
  cooling: boolean;
  activeSiteId?: string;
  siteId: string;
}): ArchaeologyNodeState {
  if (input.activeSiteId === input.siteId) return "active";
  if (!input.unlocked) return "locked";
  if (input.cooling) return "cooling";
  if (input.completed) return "completed";
  return "available";
}
