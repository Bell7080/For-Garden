import type { SkillIconAssetId } from "../core/types";

/** 부트 씬과 정보창이 공유하는 단일 아이콘 레지스트리다. */
export const SKILL_ICON_ASSETS: ReadonlyArray<readonly [SkillIconAssetId, string]> = [
  ["skill-icon-physical", "/sprites/skills/physical.svg"],
  ["skill-icon-magical", "/sprites/skills/magical.svg"],
  ["skill-icon-fixed", "/sprites/skills/fixed.svg"],
  ["skill-icon-healing", "/sprites/skills/healing.svg"],
  ["skill-icon-buff", "/sprites/skills/buff.svg"],
  ["skill-icon-fallback", "/sprites/skills/fallback.svg"],
];

/** 누락되거나 로딩에 실패한 모든 스킬 아트가 모이는 의도적인 공용 키다. */
export const FALLBACK_SKILL_ICON: SkillIconAssetId = "skill-icon-fallback";
