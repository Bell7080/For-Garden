import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_VERSION, SAVE_STORAGE_KEY, SaveDataError, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type SaveData } from "../../src/state/session";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";

/** 저장 왕복과 손상 검증에 쓰는 결정적 신규 룬이다. */
function testRune(instanceId = "rune-save-1") {
  const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 1])) as Record<RuneStatKey, number>;
  return createRuneInstance({ instanceId, baseName: "저장 테스트 룬", rarity: "uncommon", statValues: values, random: () => 0 });
}

/** 브라우저 전역을 건드리지 않고 직렬화 경계를 검증하는 최소 Storage 대역이다. */
class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

function validData(): SaveData {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);
  manager.save(createDefaultSession());
  return JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
}

describe("SaveManager", () => {
  it("v14 진행을 유지하면서 누락 설정만 기본값으로 마이그레이션한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>; legacy.saveVersion = 14; delete legacy.settings;
    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.wallet.gold).toBe((legacy.wallet as { gold: number }).gold); expect(migrated.settings.game.battleSpeed).toBe(1);
  });
  it("Set을 배열로 저장하고 로드할 때 독립 Set으로 복원한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.cleared.add("1-1");
    manager.save(source);

    const json = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    const loaded = manager.load()!;
    expect(json.ownedRelicIds).toEqual([...source.owned]);
    expect(json.clearedStageIds).toEqual(["1-1"]);
    expect(loaded.owned).toBeInstanceOf(Set);
    expect(loaded.cleared).toEqual(new Set(["1-1"]));
    expect(loaded.completedStoryIds).toEqual(new Set());
  });

  it("완료 스토리 ID를 저장하고 v3 저장은 빈 완료 목록으로 마이그레이션한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.completedStoryIds.add("opening-train");
    manager.save(source);
    expect(manager.load()?.completedStoryIds).toEqual(new Set(["opening-train"]));

    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 3;
    delete legacy.completedStoryIds;
    expect(manager.migrate(legacy).completedStoryIds).toEqual([]);
  });

  it("즐겨찾기를 저장하고 v4 저장은 빈 즐겨찾기로 마이그레이션한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.bookmarked.add("rex");
    manager.save(source);
    expect(manager.load()?.bookmarked).toEqual(new Set(["rex"]));

    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 4;
    delete legacy.bookmarkedRelicIds;
    // 애착 렐릭은 즐겨찾기와 다른 값이라 옮겨 담지 않는다.
    expect(manager.migrate(legacy).bookmarkedRelicIds).toEqual([]);
  });

  it("v5 저장의 DNA 숙련도를 각성 단계로 옮기고 경험치를 0으로 채운다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 5;
    const progress = legacy.relicProgress as Record<string, Record<string, unknown>>;
    for (const value of Object.values(progress)) {
      delete value.awakening; delete value.exp;
      value.dnaMastery = 3;
    }

    const migrated = manager.migrate(legacy);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.relicProgress.anky).toMatchObject({ awakening: 3, exp: 0 });
  });

  it("신규 획득 성장 정보와 DNA 조각을 저장 후 그대로 복구한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const source = createDefaultSession();
    source.owned.add("dodo");
    source.relicProgress.dodo = { level: 1, exp: 0, awakening: 5, breakthrough: 0, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] };
    source.wallet.dnaFragments = 3;

    manager.save(source);
    const loaded = manager.load()!;
    expect(loaded.owned.has("dodo")).toBe(true);
    expect(loaded.relicProgress.dodo).toMatchObject({ level: 1, awakening: 5 });
    expect(loaded.wallet.dnaFragments).toBe(3);
  });

  it("saveVersion 없는 저장을 현재 규격으로 마이그레이션한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy: Record<string, unknown> = { ...validData() };
    delete legacy.saveVersion;
    delete legacy.dailyContent;

    expect(manager.migrate(legacy)).toMatchObject({ saveVersion: CURRENT_SAVE_VERSION, dailyContent: { completedIds: [] } });
  });

  it("v11 wallet.weeds를 cheesecake로 손실 없이 옮기고 새 키가 함께 있으면 우선한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 11;
    legacy.wallet = { ...(legacy.wallet as object), weeds: 345 };
    delete (legacy.wallet as Record<string, unknown>).cheesecake;

    const migratedLegacyOnly = manager.migrate(legacy);
    expect(migratedLegacyOnly.wallet.cheesecake).toBe(345);
    expect(migratedLegacyOnly.wallet).not.toHaveProperty("weeds");

    // 부분 배포 저장처럼 두 키가 공존해도 합산하지 않고 새 계약의 값을 보존한다.
    legacy.wallet = { ...(legacy.wallet as object), weeds: 345, cheesecake: 27 };
    expect(manager.migrate(legacy).wallet.cheesecake).toBe(27);
  });

  it("v1 저장은 스탯 이름 변경과 함께 플레이어별 유대를 0으로 마이그레이션한다", () => {
    const manager = new SaveManager(new MemoryStorage());
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 1;
    const progress = legacy.relicProgress as Record<string, Record<string, unknown>>;
    for (const value of Object.values(progress)) {
      delete value.bondLevel; delete value.bondXp; delete value.lastLobbyInteractionDate;
    }

    const migrated = manager.migrate(legacy);
    expect(migrated.saveVersion).toBe(CURRENT_SAVE_VERSION);
    expect(migrated.relicProgress.anky.bondLevel).toBe(0);
    expect(migrated.relicProgress.anky.bondXp).toBe(0);
    expect(migrated.relicProgress.anky.lastLobbyInteractionDate).toBe("");
  });

  it("v7 배너별 천장을 이월 그룹으로 옮기고 픽업 확정은 안전하게 끈다", () => {
    const storage = new MemoryStorage();
    const data = validData() as unknown as Record<string, unknown> & { pullCountSinceHighestRarity: Record<string, number> };
    data.saveVersion = 7;
    delete data.gachaPityByGroup;
    data.pullCountSinceHighestRarity = { fossil: 12, "retired-banner": 77 };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));

    const loaded = new SaveManager(storage).load()!;
    expect(loaded.gachaPityByGroup).toEqual({
      "standard-fossil": { pullsSinceSsr: 12, pickupGuaranteed: false },
      "limited-pickup": { pullsSinceSsr: 0, pickupGuaranteed: false },
    });
  });

  it("같은 그룹의 교체 배너는 저장된 천장과 픽업 확정을 함께 이어받는다", () => {
    const source = createDefaultSession();
    source.gachaPityByGroup["limited-pickup"] = { pullsSinceSsr: 41, pickupGuaranteed: true };
    const storage = new MemoryStorage();
    new SaveManager(storage).save(source);
    expect(new SaveManager(storage).load()?.gachaPityByGroup["limited-pickup"]).toEqual({ pullsSinceSsr: 41, pickupGuaranteed: true });
  });

  it("손상 JSON을 복구 가능한 저장 오류로 보고한다", () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_STORAGE_KEY, "{broken");
    expect(() => new SaveManager(storage).load()).toThrow(SaveDataError);
  });

  it("존재하지 않는 렐릭 ID를 거부한다", () => {
    const data = validData();
    data.ownedRelicIds.push("missing-relic");
    expect(() => new SaveManager(new MemoryStorage()).validate(data)).toThrow("존재하지 않는 렐릭");
  });

  it("중복 파티원을 거부한다", () => {
    const data = validData();
    data.party = ["anky", "anky", "rex"];
    expect(() => new SaveManager(new MemoryStorage()).validate(data)).toThrow("서로 다른 보유 렐릭");
  });

  it("범위를 벗어난 DNA 숙련도를 거부한다", () => {
    const data = validData();
    data.relicProgress.anky.awakening = 6;
    expect(() => new SaveManager(new MemoryStorage()).validate(data)).toThrow("성장 정보");
  });

  it("v12 정적 젬을 안정적인 룬 인스턴스로 바꾸고 장착 참조도 함께 보존한다", () => {
    const legacy = validData() as unknown as Record<string, unknown>;
    legacy.saveVersion = 12;
    legacy.ownedHeartGemIds = ["vital-seed", "fang-core", "ancient-pulse"];
    delete legacy.runeInventory;
    const progress = legacy.relicProgress as Record<string, { heartGemSlots: [string | null, string | null, string | null] }>;
    progress.anky.heartGemSlots = ["vital-seed", null, "ancient-pulse"];

    const migrated = new SaveManager(new MemoryStorage()).migrate(legacy);
    expect(migrated.runeInventory.map(({ instanceId }) => instanceId)).toEqual(["legacy-v12-vital-seed", "legacy-v12-fang-core", "legacy-v12-ancient-pulse"]);
    expect(migrated.relicProgress.anky.heartGemSlots).toEqual(["legacy-v12-vital-seed", null, "legacy-v12-ancient-pulse"]);
  });

  it("신규 룬 인벤토리와 인스턴스 장착 참조를 저장 후 독립 객체로 왕복한다", () => {
    const storage = new MemoryStorage();
    const source = createDefaultSession();
    source.runeInventory = [testRune()];
    source.relicProgress.anky.heartGemSlots = ["rune-save-1", null, null];
    new SaveManager(storage).save(source);
    const loaded = new SaveManager(storage).load()!;
    expect(loaded.runeInventory).toEqual(source.runeInventory);
    expect(loaded.runeInventory).not.toBe(source.runeInventory);
    expect(loaded.relicProgress.anky.heartGemSlots).toEqual(["rune-save-1", null, null]);
  });

  it("손상된 강화 이력과 존재하지 않는 장착 인스턴스 참조를 거부한다", () => {
    const historyData = validData();
    const rune = testRune();
    historyData.runeInventory = [rune];
    const key = rune.mainStats[0].key;
    historyData.runeInventory[0] = { ...rune, enhancementHistory: { [key]: [{ attempt: 1, successChance: 2, succeeded: true, valueAdded: 1 }] } };
    expect(() => new SaveManager(new MemoryStorage()).validate(historyData)).toThrow("손상된 인스턴스");

    const slotData = validData();
    slotData.relicProgress.anky.heartGemSlots = ["missing-instance", null, null];
    expect(() => new SaveManager(new MemoryStorage()).validate(slotData)).toThrow("장착 소유권");
  });
});

// 광고 일일 상태는 토큰 없이 직렬화되고 v15 저장은 빈 상태로 이관되어야 한다.
describe("SaveManager 광고 상태 마이그레이션", () => {
  it("수령 상태를 왕복하고 v15 누락 필드를 기본값으로 채운다", () => {
    const storage = new MemoryStorage(); const source = createDefaultSession();
    source.dailyAdRewards = { date: "2026-08-22", claimsBySlot: { "daily-stamina": 2 }, requestIds: ["request-1"] };
    new SaveManager(storage).save(source);
    expect(new SaveManager(storage).load()?.dailyAdRewards).toEqual(source.dailyAdRewards);
    const legacy = validData() as unknown as Record<string, unknown>; legacy.saveVersion = 15; delete legacy.dailyAdRewards;
    expect(new SaveManager(new MemoryStorage()).migrate(legacy).dailyAdRewards).toEqual({ date: "", claimsBySlot: {}, requestIds: [] });
  });
});
