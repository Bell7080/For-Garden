import { t } from "../i18n";
import { MISSIONS } from "../core/missions";
import type { ProfileFrameDefinition } from "../data/profileFrames";
import type { ProfileModifierDefinition } from "../data/profileModifiers";

/** 테두리가 열리는 조건 — 연구원 레벨 하나다. */
export function frameUnlockText(frame: ProfileFrameDefinition): string {
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
    const [period, value] = rest;
    return t(period === "weekly" ? "profile.unlock.researchWeekly" : "profile.unlock.researchDaily", { value: Number(value).toLocaleString() });
  }
  if (kind === "achievement") return t("profile.unlock.achievement", { name: t(`achievement.series.${rest[0]}` as Parameters<typeof t>[0]) });
  return "";
}
