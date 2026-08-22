import { describe, expect, it } from "vitest";
import { CURRENT_SAVE_VERSION, SAVE_STORAGE_KEY, SaveDataError, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type SaveData } from "../../src/state/session";

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

  it("저장에 현재 배너 ID가 빠졌거나 삭제된 배너 ID가 있어도 천장을 기본값으로 보정한다", () => {
    const storage = new MemoryStorage();
    const data = validData() as SaveData & { pullCountSinceHighestRarity: Record<string, number> };
    data.pullCountSinceHighestRarity = { fossil: 12, "retired-banner": 77 };
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(data));

    const loaded = new SaveManager(storage).load()!;
    expect(loaded.pullCountSinceHighestRarity).toEqual({ fossil: 12, amber: 0 });
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
});
