import { describe, expect, it, vi } from "vitest";
import { RelicSkinManager } from "../../src/managers/RelicSkinManager";
import { createDefaultSession } from "../../src/state/session";

/** 외형 변경의 소유권 검증과 영속화 경계를 작은 독립 세션으로 고정한다. */
describe("RelicSkinManager", () => {
  it("미보유 렐릭, 미보유 스킨, 다른 렐릭용 스킨은 장착하지도 저장하지도 않는다", () => {
    const state = createDefaultSession();
    const saves = { save: vi.fn() };
    const manager = new RelicSkinManager(state, saves);

    expect(manager.equip("tia", "torika-skin-001")).toBe(false);
    state.ownedRelicSkinIds.clear();
    expect(manager.equip("anky", "torika-skin-001")).toBe(false);
    state.ownedRelicSkinIds.add("torika-skin-001");
    expect(manager.equip("rex", "torika-skin-001")).toBe(false);
    expect(state.equippedRelicSkinIds).toEqual({});
    expect(saves.save).not.toHaveBeenCalled();
  });

  it("유효한 외형을 장착하고 해제할 때마다 변경된 세션을 저장한다", () => {
    const state = createDefaultSession();
    const saves = { save: vi.fn() };
    const manager = new RelicSkinManager(state, saves);

    expect(manager.owns("torika-skin-001")).toBe(true);
    expect(manager.equippedFor("anky")).toBeUndefined();
    expect(manager.equip("anky", "torika-skin-001")).toBe(true);
    expect(manager.equippedFor("anky")).toBe("torika-skin-001");
    expect(manager.unequip("anky")).toBe(true);
    expect(manager.equippedFor("anky")).toBeUndefined();
    expect(saves.save).toHaveBeenCalledTimes(2);
    expect(saves.save).toHaveBeenNthCalledWith(1, state);
  });
});
