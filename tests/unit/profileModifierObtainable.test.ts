import { describe, expect, it } from "vitest";
import { MISSIONS, RESEARCH_REWARD_STAGES } from "../../src/core/missions";
import { PROFILE_MODIFIERS } from "../../src/data/profileModifiers";

describe("수식어 획득 조건", () => {
  it("임무·연구도 조건은 실제로 존재하는 임무와 단계를 가리킨다", () => {
    for (const modifier of PROFILE_MODIFIERS) {
      const [kind, ...rest] = modifier.acquisitionConditionId.split(":");
      if (kind === "mission") expect(MISSIONS.some(({ id }) => id === rest[0]), modifier.id).toBe(true);
      if (kind === "research") {
        const period = rest[0] as "daily" | "weekly";
        expect(RESEARCH_REWARD_STAGES[period]?.some(({ id }) => id === rest[1]), modifier.id).toBe(true);
      }
    }
  });
});
