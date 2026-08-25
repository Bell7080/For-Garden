import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import { InventoryManager, inventoryGridPosition, inventoryScrollMetrics } from "../../src/managers/InventoryManager";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

/** 신규 가방의 저장/API/표시/스크롤 불변식을 한 파일에서 회귀 검증한다. */
describe("inventory", () => {
  it("스택 아이템을 저장 왕복하며 복사한다", () => {
    const memory = new Map<string, string>();
    const manager = new SaveManager({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: (key) => { memory.delete(key); } });
    const state = createDefaultSession(); state.itemInventory = [{ itemId: "stamina-tonic", quantity: 7 }]; manager.save(state);
    const loaded = manager.load()!; expect(loaded.itemInventory).toEqual(state.itemInventory); expect(loaded.itemInventory).not.toBe(state.itemInventory);
  });

  it("빈 목록과 홀수·짝수 카드의 대칭 열 및 스크롤 범위를 유지한다", () => {
    // 열 중심은 팝업 원점의 좌우에 같은 거리로 있고 홀수 마지막 카드는 왼쪽 열 규칙을 따른다.
    expect(inventoryGridPosition(0)).toEqual({ x: -175, y: 0 });
    expect(inventoryGridPosition(1)).toEqual({ x: 175, y: 0 });
    expect(inventoryGridPosition(2)).toEqual({ x: -175, y: 210 });
    expect(inventoryScrollMetrics(0)).toEqual({ contentHeight: 0, minY: 0 });
    expect(inventoryScrollMetrics(5)).toEqual({ contentHeight: 630, minY: 0 });
    expect(inventoryScrollMetrics(12)).toEqual({ contentHeight: 1260, minY: -230 });
  });

  it("0·소수·초과 사용량을 거부하고 스테미나 상한까지만 회복한다", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 110; state.itemInventory = [{ itemId: "stamina-tonic", quantity: 2 }];
    const api = new FakeServer(state, { latencyMs: 0 });
    for (const quantity of [0, 1.5, 3]) await expect(api.useConsumable({ itemId: "stamina-tonic", quantity })).rejects.toBeInstanceOf(GameApiError);
    const result = await api.useConsumable({ itemId: "stamina-tonic", quantity: 1 });
    expect(result.appliedAmount).toBe(10); expect(result.wallet.stamina).toBe(120); expect(state.itemInventory[0].quantity).toBe(1);
    await expect(api.useConsumable({ itemId: "stamina-tonic", quantity: 1 })).rejects.toMatchObject({ code: "STAMINA_FULL" });
  });

  it("룬·지갑·스택을 카테고리별로 합성하고 많은 행의 하단 범위를 계산한다", () => {
    const state = createDefaultSession(); const inventory = new InventoryManager(state);
    expect(inventory.list("currency").find(({ id }) => id === "gold")?.quantity).toBe(state.wallet.gold);
    expect(inventory.list("consumable")).toHaveLength(1); expect(inventory.list("material")).toHaveLength(0);
    expect(inventoryScrollMetrics(4).minY).toBe(0); expect(inventoryScrollMetrics(20)).toEqual({ contentHeight: 2100, minY: -1070 });
  });
});
