import { t } from "../i18n";
import { MISSIONS, RESEARCH_REWARD_STAGES } from "../core/missions";
import type { ProfileFrameDefinition } from "../data/profileFrames";
import type { ProfileModifierDefinition } from "../data/profileModifiers";

/** 레벨 또는 특정 업적 단계의 보상 수령 조건. */
export function frameUnlockText(frame: ProfileFrameDefinition): string {
  if (frame.unlockAchievement) return t("profile.unlock.achievementTier", { name: t(`achievement.series.${frame.unlockAchievement.id}` as Parameters<typeof t>[0]), tier: frame.unlockAchievement.tiers });
  return t("profile.unlock.frameLevel", { level: frame.unlockLevel });
}

/**
 * 수식어를 얻는 조건. 저장은 불변 ID(`mission:`·`research:`·`achievement:`)만 들고 있으므로 문장은 여기서
 * 이름표로 푼다 — 임무 이름은 임무 정의가, 업적 이름은 업적 문구 표가 갖는다. 풀 수 없으면 빈 문장이다.
 */
export function modifierUnlockText(modifier: ProfileModifierDefinition): string {
  const [kind, ...rest] = modifier.acquisitionConditionId.split(":");
  if (kind === "mission") {
    const mission = MISSIONS.find(({ id }) => id === rest[0]);
    return mission ? t("profile.unlock.mission", { name: mission.title }) : "";
  }
  if (kind === "research") {
    const [period, stageId] = rest;
    const stage = RESEARCH_REWARD_STAGES[period === "weekly" ? "weekly" : "daily"].find(({ id }) => id === stageId);
    return stage ? t(period === "weekly" ? "profile.unlock.researchWeekly" : "profile.unlock.researchDaily", { value: stage.threshold.toLocaleString() }) : "";
  }
  if (kind === "achievement") return t("profile.unlock.achievement", { name: t(`achievement.series.${rest[0]}` as Parameters<typeof t>[0]) });
  return "";
}
