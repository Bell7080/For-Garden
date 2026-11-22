import { describe, expect, it } from "vitest";
import { clientResponseState } from "../../src/server/clientState";
import { feverOutlineDirections } from "../../src/ui/feverInk";

describe("응답 상태 다듬기", () => {
  const state = { wallet: { gems: 1 }, serverJournal: { receipts: { a: { identity: "x", result: {} } }, raidAdmissions: {} } };
  it("처리 영수증은 클라이언트로 보내지 않고 나머지 장부는 남긴다", () => {
    const out = clientResponseState({ ok: true, result: null, state, revision: "7" }) as { state: typeof state };
    expect(out.state.serverJournal.receipts).toEqual({});
    expect(out.state.serverJournal.raidAdmissions).toEqual({});
    expect(out.state.wallet.gems).toBe(1);
    // 원본 저장은 건드리지 않는다.
    expect(Object.keys(state.serverJournal.receipts)).toHaveLength(1);
  });
  it("조회가 이미 가진 revision이면 상태를 싣지 않는다", () => {
    expect("state" in clientResponseState({ ok: true, result: 1, state, revision: "7" }, "7")).toBe(false);
    expect("state" in clientResponseState({ ok: true, result: 1, state, revision: "8" }, "7")).toBe(true);
  });
});

describe("폭주 테두리 겹 수", () => {
  it("그래픽 품질이 낮을수록 줄고 테두리를 두른 몸이 늘면 한 프레임 예산을 나눠 갖는다", () => {
    expect(feverOutlineDirections(1)).toBe(12);
    expect(feverOutlineDirections(1, "balanced")).toBe(8);
    expect(feverOutlineDirections(1, "low")).toBe(6);
    expect(feverOutlineDirections(18, "high")).toBe(4);
  });
});
