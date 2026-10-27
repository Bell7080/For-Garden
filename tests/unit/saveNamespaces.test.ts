import { describe, expect, it } from "vitest";
import { LEGACY_SHARED_SAVE_STORAGE_KEY, LOCAL_SAVE_STORAGE_KEYS } from "../../src/core/saveStorage";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

class MemoryStorage {
  readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

describe("빌드별 로컬 저장", () => {
  it("같은 origin의 QA·자동화 저장과 일반 진행을 섞지 않는다", () => {
    const storage = new MemoryStorage();
    const production = new SaveManager(storage, "production");
    const qa = new SaveManager(storage, "qa");
    const test = new SaveManager(storage, "test");
    const qaState = createDefaultSession(); qaState.wallet.fossil = 900; qaState.wallet.amber = 450;
    qa.save(qaState);
    expect(production.load()).toBeNull(); expect(test.load()).toBeNull();
    const liveState = createDefaultSession(); liveState.wallet.fossil = 7;
    production.save(liveState);
    const testState = createDefaultSession(); testState.wallet.fossil = 1200;
    test.save(testState);
    expect(qa.load()?.wallet).toMatchObject({ fossil: 900, amber: 450 });
    expect(production.load()?.wallet.fossil).toBe(7);
    expect(test.load()?.wallet.fossil).toBe(1200);
  });

  it("출처 없는 구형 공용 기록을 자동 수입하거나 삭제하지 않는다", () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage, "qa"); saves.save(createDefaultSession());
    const legacy = storage.getItem(LOCAL_SAVE_STORAGE_KEYS.qa)!;
    storage.removeItem(LOCAL_SAVE_STORAGE_KEYS.qa);
    storage.setItem(LEGACY_SHARED_SAVE_STORAGE_KEY, legacy);
    for (const flavor of ["production", "qa", "test"] as const) {
      const manager = new SaveManager(storage, flavor);
      expect(manager.load()).toBeNull();
      manager.save(createDefaultSession()); manager.reset();
      expect(storage.getItem(LEGACY_SHARED_SAVE_STORAGE_KEY)).toBe(legacy);
    }
  });

  it("손상된 QA 저장 복구와 초기화는 다른 모드 기록을 건드리지 않는다", () => {
    const storage = new MemoryStorage();
    const live = new SaveManager(storage, "production"); live.save(createDefaultSession());
    const original = storage.getItem(LOCAL_SAVE_STORAGE_KEYS.production);
    storage.setItem(LOCAL_SAVE_STORAGE_KEYS.qa, "broken-json");
    const qa = new SaveManager(storage, "qa");
    expect(() => qa.load()).toThrow(); qa.reset();
    expect(storage.getItem(LOCAL_SAVE_STORAGE_KEYS.qa)).toBeNull();
    expect(storage.getItem(LOCAL_SAVE_STORAGE_KEYS.production)).toBe(original);
  });

  it("분리는 로컬 키에만 적용하며 원격 SaveData 계약을 변경하지 않는다", () => {
    const storage = new MemoryStorage();
    const source = new SaveManager(undefined, "production");
    const exported = source.exportData(createDefaultSession());
    expect(exported).not.toHaveProperty("localSaveFlavor");
    expect(exported).not.toHaveProperty("storageKey");
    const production = new SaveManager(storage, "production");
    production.importRemote(exported);
    expect(storage.getItem(LOCAL_SAVE_STORAGE_KEYS.production)).not.toBeNull();
    expect(storage.getItem(LOCAL_SAVE_STORAGE_KEYS.qa)).toBeNull();
  });
});
