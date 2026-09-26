import { CONTENT_LEVEL_GATES_ENABLED, CONTENT_UNLOCKS, type ContentId } from "../core/contentUnlock";
import { PLAYER_LEVEL_CAP } from "../core/playerLevel";
import { staminaMaxForResearchLevel } from "../core/stamina";
import { PROFILE_FRAMES } from "../data/profileFrames";

/**
 * 연구원 레벨이 여는 것들을 **가지나무**로 세우기 위한 마디 목록 — Phaser를 모르는 순수 모델이다.
 *
 * 무엇이 몇 레벨에 열리는지는 새로 적지 않고 저마다의 표에서 읽는다 — 테두리는 `PROFILE_FRAMES`,
 * 콘텐츠는 `CONTENT_UNLOCKS`, 스테미나 상한은 `staminaMaxForResearchLevel`. 여기 한 번 더 적으면
 * 표를 고친 날 나무만 옛 레벨을 말한다.
 *
 * **콘텐츠 개방은 잠금이 켜져 있을 때만 가지에 단다**(`CONTENT_LEVEL_GATES_ENABLED`). 시험 기간에는
 * 이미 모두 열려 있어, "LV.20 레이드"라고 적으면 이미 하고 있는 것을 아직 못 한다고 말하게 된다.
 *
 * 마디는 무언가 열리는 레벨과 **열 단위 레벨**이다 — 열 단위는 스테미나 상한이 얼마나 넓어졌는지를
 * 규칙적인 간격으로 보여 주는 이정표다. 1레벨(시작)과 만렙은 늘 선다.
 */
export type PlayerLevelUnlock =
  | { kind: "frame"; frameId: string }
  | { kind: "content"; contentId: ContentId };

export interface PlayerLevelMilestone {
  level: number;
  unlocks: PlayerLevelUnlock[];
  /** 그 레벨의 스테미나 상한. 모든 마디가 함께 적는다. */
  staminaMax: number;
}

/** 열 단위 이정표의 간격. */
export const PLAYER_LEVEL_TREE_STEP = 10;

export function playerLevelMilestones(gates = CONTENT_LEVEL_GATES_ENABLED): PlayerLevelMilestone[] {
  const levels = new Set<number>([1, PLAYER_LEVEL_CAP]);
  for (let level = PLAYER_LEVEL_TREE_STEP; level < PLAYER_LEVEL_CAP; level += PLAYER_LEVEL_TREE_STEP) levels.add(level);
  for (const frame of PROFILE_FRAMES) levels.add(frame.unlockLevel);
  if (gates) for (const entry of CONTENT_UNLOCKS) levels.add(entry.level);
  return [...levels]
    .filter((level) => level >= 1 && level <= PLAYER_LEVEL_CAP)
    .sort((a, b) => a - b)
    .map((level) => ({
      level,
      unlocks: [
        ...PROFILE_FRAMES.filter((frame) => frame.unlockLevel === level).map((frame) => ({ kind: "frame" as const, frameId: frame.id })),
        ...(gates ? CONTENT_UNLOCKS.filter((entry) => entry.level === level).map((entry) => ({ kind: "content" as const, contentId: entry.id })) : []),
      ],
      staminaMax: staminaMaxForResearchLevel(level),
    }));
}
