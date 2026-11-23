import { describe, expect, it } from "vitest";
import { interactionPartyToRemember, normalizeInteractionParties, restoreInteractionParty } from "../../src/core/interactionPartyMemory";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";

describe("교류 파견대 기억", () => {
  it("보낸 자리 그대로 되살리고, 세울 수 없는 이만 그 칸을 비운다", () => {
    const remembered = ["torika", null, "dodi"];
    expect(restoreInteractionParty(remembered, new Set(["torika", "dodi", "parua"]))).toEqual(["torika", null, "dodi"]);
    expect(restoreInteractionParty(remembered, new Set(["dodi"]))).toEqual([null, null, "dodi"]);
    expect(restoreInteractionParty(remembered, new Set())).toEqual([null, null, null]);
    expect(restoreInteractionParty(undefined, new Set(["torika"]))).toEqual([null, null, null]);
  });

  it("도시 인원 상한을 넘겨 세우지 않는다", () => {
    expect(restoreInteractionParty(["a", "b", "c"], new Set(["a", "b", "c"]), 2)).toEqual(["a", "b", null]);
  });

  it("저장 값은 칸 수·중복·모양을 다듬고 빈 편성은 기억하지 않는다", () => {
    expect(normalizeInteractionParties({ city: ["a", "a", 3, "b"], empty: [null, null], bad: "x" })).toEqual({ city: ["a", null, null] });
    expect(normalizeInteractionParties(null)).toEqual({});
    expect(interactionPartyToRemember([null, null, null])).toBeUndefined();
    expect(interactionPartyToRemember(["a", null, "b"])).toEqual(["a", null, "b"]);
  });

  it("설정 저장을 왕복해도 남고, 필드가 없던 저장은 빈 기억이다", () => {
    const base = createDefaultSettings();
    expect(base.game.interactionParties).toEqual({});
    const round = normalizeSettings(JSON.parse(JSON.stringify({ ...base, game: { ...base.game, interactionParties: { citycafe: ["torika", null, "dodi"] } } })));
    expect(round.game.interactionParties).toEqual({ citycafe: ["torika", null, "dodi"] });
    const legacy = JSON.parse(JSON.stringify(base)); delete legacy.game.interactionParties;
    expect(normalizeSettings(legacy).game.interactionParties).toEqual({});
  });
});
