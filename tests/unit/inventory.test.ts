import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import { INVENTORY_LAYOUT, InventoryManager, inventoryGridPosition, inventoryScrollMetrics } from "../../src/managers/InventoryManager";
import { managerEvents } from "../../src/managers/ManagerEvents";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";
import { INVENTORY_TAB_LAYOUT, inventoryCategoryTabPosition } from "../../src/ui/inventoryTabs";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { ITEMS, type WalletItemKey } from "../../src/data/items";
import { CURRENCY_GUIDE } from "../../src/data/currencyGuide";
import { ITEM_ICON_ASSETS } from "../../src/ui/itemIcons";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

/** 신규 가방의 저장/API/표시/스크롤 불변식을 한 파일에서 회귀 검증한다. */
describe("inventory", () => {
  it("모든 WalletItemKey가 획득처와 사용처를 갖는 안내 카탈로그에 등록된다", () => {
    // 지갑 정의를 추가하면서 안내만 빠뜨리는 회귀를 정적 아이템 목록과 직접 대조한다.
    const walletKeys = ITEMS.flatMap(({ icon }) => icon.kind === "currency" ? [icon.key] : []) as WalletItemKey[];
    expect(Object.keys(CURRENCY_GUIDE).sort()).toEqual([...walletKeys].sort());
    for (const key of walletKeys) expect(CURRENCY_GUIDE[key]).toMatchObject({ key, sources: expect.any(Array), uses: expect.any(Array) });
    expect(walletKeys.every((key) => CURRENCY_GUIDE[key].sources.length > 0 && CURRENCY_GUIDE[key].uses.length > 0)).toBe(true);
    // 구형 로비 무역 팝업 계약이 돌아오지 않도록 모든 교환 안내를 교류 씬 하나로 고정한다.
    const exchangeActions = Object.values(CURRENCY_GUIDE).flatMap((entry) => "action" in entry && entry.action.target === "interaction" ? [entry.action] : []);
    expect(exchangeActions).toHaveLength(3);
    expect(exchangeActions.every((action) => action.kind === "scene" && action.label === "교류 교환소로 이동")).toBe(true);
  });
  it("모든 정적 item asset이 공용 로딩 표와 실제 임시 SVG에 일대일 대응한다", () => {
    // 정적 정의가 늘 때 로더 등록이나 배포 파일 한쪽만 빠지는 회귀를 빌드 전에 잡는다.
    const definedKeys = ITEMS.flatMap(({ icon }) => icon.kind === "asset" ? [icon.key] : []);
    const loadedKeys = ITEM_ICON_ASSETS.map(([key]) => key);
    expect(loadedKeys).toEqual(definedKeys);
    for (const [, path] of ITEM_ICON_ASSETS) expect(existsSync(resolve("public", path))).toBe(true);
  });
  it("스택 아이템을 저장 왕복하며 복사한다", () => {
    const memory = new Map<string, string>();
    const manager = new SaveManager({ getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => { memory.set(key, value); }, removeItem: (key) => { memory.delete(key); } });
    const state = createDefaultSession(); state.itemInventory = [{ itemId: "stamina-tonic", quantity: 7 }]; manager.save(state);
    const loaded = manager.load()!; expect(loaded.itemInventory).toEqual(state.itemInventory); expect(loaded.itemInventory).not.toBe(state.itemInventory);
  });

  it.each([
    { label: "빈 카테고리", count: 0, rows: 0 },
    { label: "한 개", count: 1, rows: 1 },
    { label: "홀수 개", count: 5, rows: 2 },
    { label: "여러 행", count: 12, rows: 3 },
  ])("$label 카드가 공용 두 열 계약과 viewport bounds를 지킨다", ({ count, rows }) => {
    const metrics = inventoryScrollMetrics(count, INVENTORY_LAYOUT);
    expect(metrics.contentHeight).toBe(rows * INVENTORY_LAYOUT.cellHeight);
    expect(metrics.minY).toBe(Math.min(0, INVENTORY_LAYOUT.viewportHeight - metrics.contentHeight));
    // 모든 열의 카드 좌우 끝이 안전 여백으로 확장한 viewport를 넘지 않는지 직접 검증한다.
    for (let index = 0; index < count; index += 1) {
      const position = inventoryGridPosition(index, INVENTORY_LAYOUT);
      expect(position.x - INVENTORY_LAYOUT.cardWidth / 2).toBeGreaterThanOrEqual(-INVENTORY_LAYOUT.viewportWidth / 2);
      expect(position.x + INVENTORY_LAYOUT.cardWidth / 2).toBeLessThanOrEqual(INVENTORY_LAYOUT.viewportWidth / 2);
      const visibleY = position.y + metrics.minY;
      expect(visibleY + INVENTORY_LAYOUT.cardHeight / 2).toBeLessThanOrEqual(INVENTORY_LAYOUT.viewportHeight - INVENTORY_LAYOUT.cellHeight / 2 + INVENTORY_LAYOUT.cardHeight / 2);
    }
  });

  it("룬 액자 네 열이 본문 폭에 대칭으로 들어간다", () => {
    const positions = Array.from({ length: 4 }, (_, index) => inventoryGridPosition(index));
    expect(positions.map(({ x }) => x)).toEqual([-312, -104, 104, 312]);
    expect(positions[1].x - positions[0].x - INVENTORY_LAYOUT.cardWidth).toBe(INVENTORY_LAYOUT.columnGap);
    expect(INVENTORY_LAYOUT.cardWidth * 4 + INVENTORY_LAYOUT.columnGap * 3).toBe(INVENTORY_LAYOUT.viewportWidth);
  });

  it("네 카테고리 탭의 폭과 간격을 대칭 배치표로 고정한다", () => {
    // 인접 중심 차는 면 너비와 간격의 합이며 양끝은 팝업 원점에서 같은 거리여야 한다.
    const positions = Array.from({ length: INVENTORY_TAB_LAYOUT.count }, (_, index) => inventoryCategoryTabPosition(index));
    expect(positions.map(({ x }) => x)).toEqual([-276, -92, 92, 276]);
    expect(positions.every(({ y }) => y === INVENTORY_TAB_LAYOUT.centerY)).toBe(true);
    expect(positions[1].x - positions[0].x).toBe(INVENTORY_TAB_LAYOUT.width + INVENTORY_TAB_LAYOUT.gap);
    expect(positions[0].x).toBe(-positions[positions.length - 1].x);
  });

  it("0·소수·초과 사용량을 거부하고 스테미나 상한까지만 회복한다", async () => {
    const state = createDefaultSession(); state.wallet.stamina = 110; state.itemInventory = [{ itemId: "stamina-tonic", quantity: 2 }];
    const api = new FakeServer(state, { latencyMs: 0 });
    for (const quantity of [0, 1.5, 3]) await expect(api.useConsumable({ itemId: "stamina-tonic", quantity })).rejects.toBeInstanceOf(GameApiError);
    const result = await api.useConsumable({ itemId: "stamina-tonic", quantity: 1 });
    expect(result.appliedAmount).toBe(12); expect(result.wallet.stamina).toBe(122); expect(state.itemInventory[0].quantity).toBe(1);
    await expect(api.useConsumable({ itemId: "stamina-tonic", quantity: 1 })).rejects.toMatchObject({ code: "STAMINA_FULL" });
  });

  it("룬·지갑·스택을 카테고리별로 합성하고 많은 행의 하단 범위를 계산한다", () => {
    const state = createDefaultSession(); const inventory = new InventoryManager(state);
    expect(inventory.list("currency").find(({ id }) => id === "gold")?.quantity).toBe(state.wallet.gold);
    expect(inventory.list("consumable")).toHaveLength(1); expect(inventory.list("material")).toHaveLength(0);
    expect(inventoryScrollMetrics(4).minY).toBe(0); expect(inventoryScrollMetrics(20)).toEqual({ contentHeight: 1040, minY: 0 });
  });

  it("룬 표시 모델이 인스턴스의 등급·부위·이름을 그대로 보존한다", () => {
    const state = createDefaultSession();
    // 실제 생성기를 통과한 인스턴스로 표시 모델이 정적 정의값을 덮어쓰지 않는지 확인한다.
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 10])) as Record<RuneStatKey, number>;
    const rune = { ...createRuneInstance({ instanceId: "inventory-epic-part-2", baseName: "황혼의 파편", rarity: "epic", part: 2, statValues: values, random: () => 0 }), customName: "저녁별" };
    state.runeInventory = [rune];
    const displayed = new InventoryManager(state).list("rune")[0];
    expect(displayed.kind).toBe("rune");
    if (displayed.kind === "rune") expect(displayed.rune).toMatchObject({ rarity: "epic", part: 2, baseName: "황혼의 파편", customName: "저녁별" });
  });

  it("서버 조회 한 번으로 룬·지갑·스택을 함께 반영한 뒤 list만 표시 기준으로 사용한다", async () => {
    const serverState = createDefaultSession(); serverState.wallet.gold = 4321; serverState.itemInventory = [{ itemId: "rune-dust", quantity: 17 }];
    const clientState = createDefaultSession(); clientState.wallet.gold = 1; clientState.itemInventory = [{ itemId: "stamina-tonic", quantity: 9 }];
    const manager = new InventoryManager(clientState);
    // 실제 API DTO 경계를 통과시켜 세 저장 영역이 같은 응답 스냅샷으로 교체되는지 고정한다.
    await manager.refresh(new FakeServer(serverState, { latencyMs: 0 }));
    expect(manager.list("currency").find(({ id }) => id === "gold")?.quantity).toBe(4321);
    expect(manager.list("consumable")).toEqual([]);
    expect(manager.list("material")[0]).toMatchObject({ id: "rune-dust", quantity: 17 });
  });

  it("세공·각인·이름 변경도 목록 갱신 신호를 함께 낸다", async () => {
    // 세공 화면이 API를 직접 부르면 룬은 바뀌는데 가방이 그 사실을 몰라, 각인 뒤에도 금색
    // 테두리가 다시 열 때까지 붙지 않았다. 그 회귀를 신호 수로 고정한다.
    const state = createDefaultSession();
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 8])) as Record<RuneStatKey, number>;
    let rune = createRuneInstance({ instanceId: "craft-1", baseName: "세공 테스트", rarity: "uncommon", part: 0, statValues: values, random: () => 0 });
    state.runeInventory = [rune];
    state.wallet.gold = 100_000;
    const api = new FakeServer(state, { latencyMs: 0, random: () => 0 });
    const manager = new InventoryManager(state);
    let signals = 0;
    const unsubscribe = managerEvents.subscribe("inventory", () => { signals += 1; });
    try {
      await manager.renameRune(api, rune.instanceId, "이름표");
      for (const { key } of rune.mainStats) for (let count = 0; count < 3; count += 1) await manager.enhanceRune(api, rune.instanceId, key);
      const engraved = await manager.engraveRune(api, rune.instanceId, rune.mainStats[0].key);
      rune = engraved.rune;
    } finally { unsubscribe(); }
    // 이름 1 + 세공 6 + 각인 1
    expect(signals).toBe(8);
    // 세션의 룬도 서버 확정 결과와 같은 값이라 가방이 다시 그리면 곧바로 각인이 보인다.
    expect(state.runeInventory[0].engravings).toHaveLength(1);
    expect(state.runeInventory[0].customName).toBe("이름표");
  });

  it("손상된 전체 스냅샷은 일부 Session 영역도 먼저 바꾸지 않는다", async () => {
    const state = createDefaultSession(); const before = structuredClone(state); const manager = new InventoryManager(state);
    // 필수 지갑 행이 빠진 DTO는 원자 적용 전에 거부되어 기존 룬·지갑·스택을 모두 보존해야 한다.
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0 });
    api.getInventory = async () => ({ items: (await new FakeServer(createDefaultSession(), { latencyMs: 0 }).getInventory()).items.filter(({ id }) => id !== "gold") });
    await expect(manager.refresh(api)).rejects.toThrow("INVALID_INVENTORY_RESPONSE");
    expect(state).toEqual(before);
  });

  it("동률 정렬은 원본을 바꾸지 않고 instanceId로 안정 결정한다", () => {
    const state = createDefaultSession(); const first = createRuneInstance({ instanceId: "b", baseName: "B", rarity: "rare", part: 0, statValues: Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 10])) as Record<RuneStatKey, number>, random: () => 0 });
    state.runeInventory = [{ ...first, instanceId: "b", sequence: 1 }, { ...first, instanceId: "a", sequence: 1 }];
    expect(new InventoryManager(state).list("rune", { key: "rarity", direction: "asc" }).map(({ id }) => id)).toEqual(["a", "b"]);
    expect(state.runeInventory.map(({ instanceId }) => instanceId)).toEqual(["b", "a"]);
  });

});
