import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { handleGameCall, StateConflictError, type StateStore, type StoredState } from "../../src/server/gameHandler";
import { WALLET_CAPS } from "../../src/data/economy";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { createDefaultSession } from "../../src/state/session";
import { breakthroughForLevel } from "../../src/core/debugCommand";

const server = (developmentTools = true) => {
  const state = createDefaultSession();
  return { state, api: new FakeServer(state, { latencyMs: 0, persistSession: () => undefined, developmentTools }) };
};

describe("QA 디버그 명령", () => {
  it("다음 10연 승급 찬스는 서버 장부에 걸려 10연 한 번에만 마지막 칸을 SSR로 올린다", async () => {
    const { state, api } = server();
    state.wallet.fossil = 100;
    for (const id of ["1-1", "1-2", "1-3", "1-4", "1-5"]) state.cleared.add(id);
    await api.applyDebugCommand({ kind: "tenUpgrade" });
    expect(state.serverJournal?.qaTenUpgrade).toBe(true);
    const first = await api.pullRelics({ bannerId: "fossil", count: 10 });
    expect(first.rarityUpgradeSlot).toBe(9);
    expect(state.serverJournal?.qaTenUpgrade).toBeUndefined();
    const second = await api.pullRelics({ bannerId: "fossil", count: 10 });
    expect(second.rarityUpgradeSlot).toBeUndefined();
  });

  it("개발 도구가 꺼진 서버는 승급 찬스 표식을 거절한다", async () => {
    const { api } = server(false);
    await expect(api.applyDebugCommand({ kind: "tenUpgrade" })).rejects.toMatchObject({ code: "DEBUG_TOOLS_DISABLED" });
  });

  it("재화를 더하고 상한에서 멈추며 0으로 비운다", async () => {
    const { state, api } = server();
    const before = state.wallet.fossil;
    await api.applyDebugCommand({ kind: "currency", key: "fossil", mode: "add", amount: 100 });
    expect(state.wallet.fossil).toBe(before + 100);
    await api.applyDebugCommand({ kind: "currency", key: "fossil", mode: "set", amount: Number.MAX_SAFE_INTEGER });
    expect(state.wallet.fossil).toBe(WALLET_CAPS.fossil);
    await api.applyDebugCommand({ kind: "currency", key: "fossil", mode: "set", amount: 0 });
    expect(state.wallet.fossil).toBe(0);
  });

  it("플레이어 레벨과 캐릭터 획득·레벨·돌파·유대를 원하는 값으로 맞춘다", async () => {
    const { state, api } = server();
    const target = PLAYABLE_RELICS.find((relic) => !state.owned.has(relic.id))!;
    expect((await api.applyDebugCommand({ kind: "playerLevel", level: 25 })).changed).toBe(1);
    expect(state.playerResearch.level).toBe(25);
    await api.applyDebugCommand({ kind: "grantRelics", relicIds: [target.id] });
    expect(state.owned.has(target.id)).toBe(true);
    await api.applyDebugCommand({ kind: "relicLevel", relicId: target.id, level: 35 });
    expect(state.relicProgress[target.id].level).toBe(35);
    expect(state.relicProgress[target.id].breakthrough).toBe(breakthroughForLevel(35));
    await api.applyDebugCommand({ kind: "relicBreakthrough", relicId: target.id, breakthrough: 4 });
    expect(state.relicProgress[target.id]).toMatchObject({ breakthrough: 4, level: 50 });
    await api.applyDebugCommand({ kind: "relicBond", relicId: target.id, level: 3 });
    expect(state.relicProgress[target.id].bondLevel).toBe(3);
  });

  it("한 캐릭터만 건드리고 보유하지 않은 캐릭터는 거절한다", async () => {
    const { state, api } = server();
    const owned = [...state.owned];
    const before = JSON.stringify(state.relicProgress[owned[1]]);
    await api.applyDebugCommand({ kind: "relicBond", relicId: owned[0], level: 10 });
    expect(JSON.stringify(state.relicProgress[owned[1]])).toBe(before);
    const stranger = PLAYABLE_RELICS.find((relic) => !state.owned.has(relic.id))!.id;
    await expect(api.applyDebugCommand({ kind: "relicLevel", relicId: stranger, level: 5 })).rejects.toThrow();
  });

  it("만능 파편을 R·SR·SSR 모두 가방에 넣는다", async () => {
    const { state, api } = server();
    const count = (id: string) => state.itemInventory.find((stack) => stack.itemId === id)?.quantity ?? 0;
    const before = ["r", "sr", "ssr"].map((rarity) => count(`universal-fragment-${rarity}`));
    expect((await api.applyDebugCommand({ kind: "universalFragments", amount: 5 })).changed).toBe(1);
    expect(["r", "sr", "ssr"].map((rarity) => count(`universal-fragment-${rarity}`))).toEqual(before.map((value) => value + 5));
  });

  it("개발 도구가 꺼진 서버는 아무것도 바꾸지 않고 거절한다", async () => {
    const { state, api } = server(false);
    const gems = state.wallet.gems;
    await expect(api.applyDebugCommand({ kind: "currency", key: "gems", mode: "add", amount: 1000 })).rejects.toMatchObject({ code: "DEBUG_TOOLS_DISABLED" });
    expect(state.wallet.gems).toBe(gems);
  });

  it("서버 처리기는 환경 스위치가 있을 때만 실행하고, 실행하면 다음 호출에서도 값이 남는다", async () => {
    const saves = new Map<string, StoredState>();
    const store: StateStore = {
      async load(id) { return saves.get(id) ?? null; },
      async findReceipt() { return undefined; },
      async commit(i) {
        const cur = saves.get(i.playerId);
        if ((cur?.revision ?? null) !== i.expectedRevision) throw new StateConflictError();
        const revision = String(Number(cur?.revision ?? 0) + 1);
        saves.set(i.playerId, { revision, data: i.data });
        return { revision };
      },
    };
    const P = "00000000-0000-0000-0000-000000000009";
    const call = { method: "applyDebugCommand", args: [{ kind: "playerLevel", level: 40 }], requestId: "debug-level-0001" };
    await expect(handleGameCall(P, call, { store })).rejects.toMatchObject({ code: "rejected" });
    await handleGameCall(P, call, { store, developmentTools: true });
    const next = await handleGameCall(P, { method: "getPlayerState" }, { store });
    expect((next.state as { playerResearch: { level: number } }).playerResearch.level).toBe(40);
  });
});
