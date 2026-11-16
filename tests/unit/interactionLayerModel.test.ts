import { describe, expect, it } from "vitest";
import { interactionLayerViews, interactionRemainingLabel, relicsAwayOnInteraction } from "../../src/ui/interactionLayerModel";
import { INTERACTION_CITIES } from "../../src/data/interactionCities";
import { contentUnlockLevel } from "../../src/core/contentUnlock";
import { PLAYER_LEVEL_CAP } from "../../src/core/playerLevel";
import type { InteractionDispatchSnapshot } from "../../src/state/session";

const NOW = Date.parse("2026-09-04T00:00:00.000Z");
function dispatch(cityId: string, over: Partial<InteractionDispatchSnapshot> = {}): InteractionDispatchSnapshot {
  return {
    dispatchId: `d-${cityId}`, cityId, startedAt: new Date(NOW - 60_000).toISOString(),
    completesAt: new Date(NOW + 60_000).toISOString(), party: ["torika"], rewardSeed: "s",
    rewards: [{ currency: "gold", amount: 10 }], claimed: false, ...over,
  };
}

describe("교류 층 모델", () => {
  it("레벨이 모자란 층은 잠기고 목록에서 사라지지 않는다", () => {
    const views = interactionLayerViews(5, [], NOW);
    expect(views).toHaveLength(INTERACTION_CITIES.length);
    expect(views.some((view) => view.state === "locked")).toBe(true);
  });

  it("교류가 열리는 레벨에 첫 도시가 함께 열리고, 나머지는 레벨 간격을 두고 열린다", () => {
    // 교류에 처음 들어온 손이 빈 목록을 보면 콘텐츠가 없는 것으로 읽힌다.
    expect(interactionLayerViews(contentUnlockLevel("interaction"), [], NOW)[0].state).toBe("idle");
    expect(interactionLayerViews(contentUnlockLevel("interaction") - 1, [], NOW).every((view) => view.state === "locked")).toBe(true);
    const levels = INTERACTION_CITIES.map((city) => city.unlock.level);
    expect(levels[0]).toBe(contentUnlockLevel("interaction"));
    for (let i = 1; i < levels.length; i += 1) expect(levels[i] - levels[i - 1], INTERACTION_CITIES[i].id).toBeGreaterThanOrEqual(2);
  });

  it("나가 있는 층과 다녀온 층을 남은 시간으로 가른다", () => {
    const away = interactionLayerViews(PLAYER_LEVEL_CAP, [dispatch("doppel-parlor")], NOW);
    expect(away[0].state).toBe("away");
    expect(away[0].remainingMs).toBe(60_000);
    const done = interactionLayerViews(PLAYER_LEVEL_CAP, [dispatch("doppel-parlor", { completesAt: new Date(NOW).toISOString() })], NOW);
    expect(done[0].state).toBe("done");
  });

  it("수령을 마친 파견은 층을 다시 비운다", () => {
    const views = interactionLayerViews(PLAYER_LEVEL_CAP, [dispatch("doppel-parlor", { claimed: true })], NOW);
    expect(views[0].state).toBe("idle");
  });

  it("나가 있는 렐릭은 다시 보낼 수 없다 — 수령한 파견은 풀려난다", () => {
    const away = relicsAwayOnInteraction([dispatch("doppel-parlor"), dispatch("doppel-lab", { party: ["rex", "spino"], claimed: true })]);
    expect([...away]).toEqual(["torika"]);
  });

  it("남은 시간은 초까지 도는 시계 한 모양으로 선다", () => {
    expect(interactionRemainingLabel(0)).toBe("완료");
    expect(interactionRemainingLabel(30_000)).toBe("00:00:30");
    expect(interactionRemainingLabel(90_000)).toBe("00:01:30");
    expect(interactionRemainingLabel(3_600_000)).toBe("01:00:00");
    expect(interactionRemainingLabel(3_600_000 + 600_000)).toBe("01:10:00");
    // 하루를 넘는 파견도 시간 자리를 그대로 이어 적는다.
    expect(interactionRemainingLabel(24 * 3_600_000)).toBe("24:00:00");
  });
});
