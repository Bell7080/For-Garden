import { describe, expect, it } from "vitest";
import { interactionDurationMs, interactionRewardWeights, isInteractionCityUnlocked, isInteractionDispatchComplete, validateInteractionFormation } from "../../src/core/interactionDispatch";
import { INTERACTION_CITIES } from "../../src/data/interactionCities";

const city = INTERACTION_CITIES[1];
/** 교류의 데이터 기반 개방·편성·시간·보상·완료 경계를 회귀 고정한다. */
describe("interaction dispatch rules", () => {
  it("연구 레벨과 1~3명 고유 소유 편성을 검증한다", () => { expect(isInteractionCityUnlocked(city, 2)).toBe(false); expect(isInteractionCityUnlocked(city, 3)).toBe(true); const owned = new Set(["a", "b", "c"]); expect(validateInteractionFormation([], owned)).toBe("party_size"); expect(validateInteractionFormation(["a", "a"], owned)).toBe("duplicate"); expect(validateInteractionFormation(["x"], owned)).toBe("not_owned"); expect(validateInteractionFormation(["a", "b", "c"], owned)).toBeNull(); });
  it("나이트 기어와 wind 태그가 이름 없이 시간과 보상에 반영된다", () => { const members = [{ id: "any-id", element: "wind" as const, squad: "gear" as const, tags: ["night-gear"] }]; expect(interactionDurationMs(city, members)).toBeLessThan(city.baseDurationHours * 3_600_000); expect(interactionRewardWeights(city.rewards, members)).toEqual([6.25, 1.25]); });
  it("서버 종료 시각 경계에서만 완료된다", () => { expect(isInteractionDispatchComplete("2026-09-04T00:00:00.000Z", Date.parse("2026-09-03T23:59:59.999Z"))).toBe(false); expect(isInteractionDispatchComplete("2026-09-04T00:00:00.000Z", Date.parse("2026-09-04T00:00:00.000Z"))).toBe(true); });
});
