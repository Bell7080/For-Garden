import { describe, expect, it, vi } from "vitest";

// resolver 테스트는 렌더러를 만들지 않으므로 Phaser 기반 Puppet 구현을 평가하지 않는다.
vi.mock("../../src/puppets/IndexedPuppetCreature", () => ({
  IndexedPuppetCreature: class {},
  ensureTexture: vi.fn(),
}));
import { createDefaultSession } from "../../src/state/session";
import { RelicAppearanceManager } from "../../src/managers/RelicAppearanceManager";
import { TORIKA_ASSET, TORIKA_SD_ASSET, TORIKA_SKIN_001_ASSET, TORIKA_SKIN_001_SD_ASSET } from "../../src/puppets/assets";

/** 전신과 SD가 manager가 전달한 동일 장착 ID를 소비하는지 고정하는 회귀 테스트다. */
describe("장착 외형 resolver 일관성", () => {
  it("장착 스킨 하나를 전신과 SD 양쪽에서 선택한다", () => {
    const state = createDefaultSession();
    state.equippedRelicSkinIds.anky = "torika-skin-001";
    const manager = new RelicAppearanceManager({ equippedFor: (id) => state.equippedRelicSkinIds[id] });
    expect(manager.portraitAssetFor("anky")).toBe(TORIKA_SKIN_001_ASSET);
    expect(manager.sdAssetFor("anky")).toBe(TORIKA_SKIN_001_SD_ASSET);
  });

  it("장착 값이 없으면 같은 렐릭의 기본 전신과 SD를 선택한다", () => {
    const state = createDefaultSession();
    delete state.equippedRelicSkinIds.anky;
    const manager = new RelicAppearanceManager({ equippedFor: (id) => state.equippedRelicSkinIds[id] });
    expect(manager.portraitAssetFor("anky")).toBe(TORIKA_ASSET);
    expect(manager.sdAssetFor("anky")).toBe(TORIKA_SD_ASSET);
  });
});
