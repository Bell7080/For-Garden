/**
 * 캔 보상이 판 위에 떠올랐다가 전리품으로 들어가는 연출의 결이다. Phaser를 읽지 않는다.
 *
 * 값은 전부 이 표 하나에 있고 연출(`StrataRewardPop`)은 읽기만 한다.
 */

import type { StrataRewardKind } from "../data/strataLayers";
import type { RuneRarity } from "../core/runes";

/** 얼마나 화려하게 떠오르는가. */
export type StrataRewardTier = "common" | "shine" | "legend";

/**
 * 보상의 화려함.
 *
 * **영웅 룬은 화석, 전설 룬은 호박석과 같은 무대**를 쓴다 — 룬의 귀한 등급이 나오는 확률을 이미
 * 그 두 재화의 확률에 묶었으므로 연출도 같은 자리에 선다. 다이아는 이 콘텐츠의 잭팟이라 화석
 * 급으로 반짝이게 한다.
 */
export function strataRewardTier(reward: { kind: StrataRewardKind; runeRarity?: RuneRarity; itemId?: string }): StrataRewardTier {
  if (reward.kind === "amber") return "legend";
  if (reward.kind === "fossil" || reward.kind === "gems") return "shine";
  if (reward.kind === "rune") {
    if (reward.runeRarity === "legendary") return "legend";
    if (reward.runeRarity === "epic") return "shine";
  }
  return "common";
}

export const STRATA_REWARD_POP = {
  /** 칸에 박힌 보상이 그 자리에 머무는 시간(ms). 전리품으로 들어가기 전에 눈으로 확인하는 시간이다(길면 판이 가려진다). */
  holdMs: 1000,
  /** 움직임 줄이기에서의 머무는 시간. */
  holdReducedMs: 600,
  /** 나타나는 데 걸리는 시간. */
  appearMs: 260,
  /** 전리품 칸으로 날아가는 시간. */
  flyMs: 400,
  /** 칸 한 변 대비 보상 액자의 크기. 1보다 작아야 칸 안쪽에 박혀 이웃 칸을 덮지 않는다. */
  sizeRatio: 0.88,
  /** 화려함별 반짝이는 조각 수와 섬광 세기. 섬광은 옅게 둔다(상한 0.6). */
  tier: {
    common: { sparks: 0, flash: 0, rays: 0, twinkles: 0 },
    shine: { sparks: 12, flash: 0.5, rays: 8, twinkles: 6 },
    legend: { sparks: 22, flash: 0.6, rays: 12, twinkles: 9 },
  },
} as const;

/** 보상 등급별 빛깔이다. 흰 바탕에 등급색을 살짝 섞어 밝은 판 위에서도 읽히게 한다. */
export const STRATA_REWARD_GLOW: Readonly<Record<StrataRewardTier, number>> = {
  common: 0xffffff,
  shine: 0xffe28a,
  legend: 0xff9ad8,
};
