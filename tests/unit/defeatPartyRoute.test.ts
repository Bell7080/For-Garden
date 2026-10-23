import { describe, expect, it } from "vitest";
import { defeatPartyRoute } from "../../src/data/partyContent";

describe("진 판의 「편성 바꾸기」 행선지", () => {
  it("스토리는 스토리 편성으로 간다", () => {
    expect(defeatPartyRoute({ mode: "stage" })).toEqual({ scene: "party", data: { content: "stage" } });
  });
  it("대작전·현상수배는 들어온 그 단계의 편성으로 간다", () => {
    expect(defeatPartyRoute({ mode: "cake", tierId: "cake-1" })).toEqual({ scene: "party", data: { content: "cake", tierId: "cake-1" } });
    expect(defeatPartyRoute({ mode: "bounty", tierId: "bounty-1" })).toEqual({ scene: "party", data: { content: "bounty", tierId: "bounty-1" } });
  });
  it("결투는 결투장에서 상대 고르기 창을 연다", () => {
    expect(defeatPartyRoute({ mode: "duel" })).toEqual({ scene: "duel", data: { openOpponents: true } });
  });
});
