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
  it("서버만 아는 값(전투 시드·입장권, 안 판 고고학 칸)은 내려보내지 않는다", () => {
    const secret = {
      wallet: { gems: 1 },
      serverJournal: { receipts: {}, raidAdmissions: { r: { seed: "s" } }, combat: { tickets: { t: { kind: "duel" } }, records: { l: { seed: "s" } } }, guildWarAdmissions: { g: { seed: "s" } } },
      archaeology: { charges: 3, board: { layerId: "a", tiles: [
        { index: 0, zone: 1, kind: "amber", amount: 1, revealed: false },
        { index: 1, zone: 0, kind: "rune", amount: 1, revealed: false, runeRarity: "legendary", runePart: 2 },
        { index: 2, zone: 0, kind: "gold", amount: 900, revealed: true },
      ] } },
    };
    const out = clientResponseState({ ok: true, result: null, state: secret, revision: "1" }) as unknown as { state: typeof secret };
    expect(out.state.serverJournal).toEqual({ receipts: {}, raidAdmissions: {} });
    expect(out.state.archaeology.board.tiles[0]).toEqual({ index: 0, zone: 1, kind: "empty", amount: 0, revealed: false });
    expect(out.state.archaeology.board.tiles[1]).toEqual({ index: 1, zone: 0, kind: "empty", amount: 0, revealed: false });
    expect(out.state.archaeology.board.tiles[2]).toEqual({ index: 2, zone: 0, kind: "gold", amount: 900, revealed: true });
    expect(out.state.archaeology.charges).toBe(3);
    expect(JSON.stringify(out)).not.toMatch(/amber|legendary|"seed"/);
    // 원본은 그대로다 — 서버는 이 저장으로 다음 호출을 처리한다.
    expect(secret.archaeology.board.tiles[0].kind).toBe("amber");
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
