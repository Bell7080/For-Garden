import { describe, expect, it } from "vitest";
import { interactionDurationMs, interactionRewardWeights, isInteractionCityUnlocked, isInteractionDispatchComplete, validateInteractionFormation } from "../../src/core/interactionDispatch";
import { INTERACTION_CITIES } from "../../src/data/interactionCities";

// 도시 목록은 운영 중 늘어난다 — 순서가 아니라 id로 집어야 표가 커져도 같은 것을 검사한다.
const city = INTERACTION_CITIES.find((entry) => entry.id === "night-ward")!;
/** 조건이 걸린 도시. 앞의 세 곳은 처음부터 열려 있으므로 잠금 규칙은 뒤의 도시로 본다. */
const gatedCity = INTERACTION_CITIES.find((entry) => entry.unlock.stageId !== undefined)!;
/** 교류의 데이터 기반 개방·편성·시간·보상·완료 경계를 회귀 고정한다. */
describe("interaction dispatch rules", () => {
  it("선행 관문과 1~3명 고유 소유 편성을 검증한다", () => { expect(isInteractionCityUnlocked(gatedCity, new Set())).toBe(false); expect(isInteractionCityUnlocked(gatedCity, new Set([gatedCity.unlock.stageId!]))).toBe(true); expect(isInteractionCityUnlocked(city, new Set())).toBe(true); const owned = new Set(["a", "b", "c"]); expect(validateInteractionFormation([], owned)).toBe("party_size"); expect(validateInteractionFormation(["a", "a"], owned)).toBe("duplicate"); expect(validateInteractionFormation(["x"], owned)).toBe("not_owned"); expect(validateInteractionFormation(["a", "b", "c"], owned)).toBeNull(); });
  it("나이트 기어와 wind 태그가 이름 없이 시간과 보상에 반영된다", () => { const members = [{ id: "any-id", element: "wind" as const, squad: "gear" as const, tags: ["night-gear"] }]; expect(interactionDurationMs(city, members)).toBeLessThan(city.durationMinutes * 60_000); // 원석 줄은 태그가 없어 편성으로 가중치가 오르지 않는다 — 어느 편성으로 가든 같은 빈도로 섞인다.
    expect(interactionRewardWeights(city.rewards, members)).toEqual([6.25, 2, 1]); });
  it("서버 종료 시각 경계에서만 완료된다", () => { expect(isInteractionDispatchComplete("2026-09-04T00:00:00.000Z", Date.parse("2026-09-03T23:59:59.999Z"))).toBe(false); expect(isInteractionDispatchComplete("2026-09-04T00:00:00.000Z", Date.parse("2026-09-04T00:00:00.000Z"))).toBe(true); });
});
