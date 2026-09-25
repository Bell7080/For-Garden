import { describe, expect, it } from "vitest";
import { interactionDurationMs, interactionRewardRange, interactionSpecialtyMatches, interactionYieldFactor, isInteractionCityUnlocked, isInteractionDispatchComplete, rollInteractionRewards, validateInteractionFormation } from "../../src/core/interactionDispatch";
import { autoAssignInteractionParty } from "../../src/ui/interactionLayerModel";
import { INTERACTION_CITIES } from "../../src/data/interactionCities";

// 도시 목록은 운영 중 늘어난다 — 순서가 아니라 id로 집어야 표가 커져도 같은 것을 검사한다.
const city = INTERACTION_CITIES.find((entry) => entry.id === "night-ward")!;
/** 조건이 걸린 도시. 앞의 세 곳은 처음부터 열려 있으므로 잠금 규칙은 뒤의 도시로 본다. */
const gatedCity = INTERACTION_CITIES.find((entry) => entry.unlock.stageId !== undefined)!;
/** 교류의 데이터 기반 개방·편성·시간·보상·완료 경계를 회귀 고정한다. */
describe("interaction dispatch rules", () => {
  it("선행 관문과 1~3명 고유 소유 편성을 검증한다", () => { expect(isInteractionCityUnlocked(gatedCity, new Set())).toBe(false); expect(isInteractionCityUnlocked(gatedCity, new Set([gatedCity.unlock.stageId!]))).toBe(true); expect(isInteractionCityUnlocked(city, new Set())).toBe(true); const owned = new Set(["a", "b", "c"]); expect(validateInteractionFormation([], owned)).toBe("party_size"); expect(validateInteractionFormation(["a", "a"], owned)).toBe("duplicate"); expect(validateInteractionFormation(["x"], owned)).toBe("not_owned"); expect(validateInteractionFormation(["a", "b", "c"], owned)).toBeNull(); });
  it("인원이 적으면 덜 가져오고, 특화에 맞는 칸마다 더 가져온다", () => {
    // 나이트 시티 교류부 — 바람 · 암살자 · 나이트 기어.
    const plain = { element: "earth" as const, role: "tank" as const, squad: "fang" as const };
    const specialist = { element: "wind" as const, role: "assassin" as const, squad: "gear" as const };
    expect(interactionSpecialtyMatches(city, specialist)).toBe(3);
    expect(interactionSpecialtyMatches(city, plain)).toBe(0);
    expect(interactionYieldFactor(city, [plain])).toBe(0.5);
    expect(interactionYieldFactor(city, [plain, plain])).toBe(0.75);
    expect(interactionYieldFactor(city, [plain, plain, plain])).toBe(1);
    expect(interactionYieldFactor(city, [specialist, specialist, specialist])).toBeCloseTo(1.9);
    // 셋 중 한 명만 맞아도 셋이 특화 없이 간 것보다 많이 가져온다.
    expect(interactionYieldFactor(city, [specialist, plain, plain])).toBeGreaterThan(1);
  });

  it("예상 범위와 실제로 굴린 값이 같은 경계를 쓴다", () => {
    const gold = city.rewards.find(({ currency }) => currency === "gold")!;
    expect(interactionRewardRange(gold, 1)).toEqual({ currency: "gold", min: gold.min, max: gold.max });
    const members = [{ element: "wind" as const, role: "assassin" as const, squad: "gear" as const }];
    const factor = interactionYieldFactor(city, members);
    for (const value of [0, 0.25, 0.5, 0.999]) {
      for (const reward of rollInteractionRewards(city, members, () => value)) {
        const range = interactionRewardRange(city.rewards.find(({ currency }) => currency === reward.currency)!, factor);
        expect(reward.amount).toBeGreaterThanOrEqual(range.min);
        expect(reward.amount).toBeLessThanOrEqual(range.max);
      }
    }
    // 시간은 편성이 바꾸지 않는다 — 화면에 적힌 소요 시간이 그대로 맞아야 한다.
    expect(interactionDurationMs(city)).toBe(city.durationMinutes * 60_000);
  });

  it("자동 배치는 특화에 맞는 이를 먼저 세우고, 같은 수끼리만 전투력으로 가른다", () => {
    expect(autoAssignInteractionParty([
      { id: "strong", power: 9000, specialty: 0 },
      { id: "fit", power: 1000, specialty: 2 },
      { id: "half", power: 5000, specialty: 1 },
      { id: "fit-strong", power: 3000, specialty: 2 },
    ], 3)).toEqual(["fit-strong", "fit", "half"]);
  });
  it("서버 종료 시각 경계에서만 완료된다", () => { expect(isInteractionDispatchComplete("2026-09-04T00:00:00.000Z", Date.parse("2026-09-03T23:59:59.999Z"))).toBe(false); expect(isInteractionDispatchComplete("2026-09-04T00:00:00.000Z", Date.parse("2026-09-04T00:00:00.000Z"))).toBe(true); });
});

describe("교류 층 원화 채우기", () => {
  it("원본이 넉넉하면 기울어진 판 전체를 채우고, 모자라면 안쪽에 두고 좌우를 장식이 메운다", async () => {
    const { interactionArtFit } = await import("../../src/ui/interactionLayerModel");
    // 1882×3344 같은 큰 원화는 넓혀도 확대되지 않는다.
    expect(interactionArtFit(1882, 3344, 900, 250, 60)).toEqual({ mode: "fill", width: 960 });
    // 판보다 작은 원화를 넓히면 확대되어 흐려진다 — 그때는 안쪽 네모에 둔다.
    expect(interactionArtFit(800, 200, 900, 250, 60)).toEqual({ mode: "frame", width: 840 });
  });
});
