import { describe, expect, it } from "vitest";
import { PLAYER_LEVEL_CAP } from "../../src/core/playerLevel";
import { isContentUnlocked, ALL_GATED_CONTENT } from "../../src/core/contentUnlock";
import { PlayerLevelManager } from "../../src/managers/PlayerLevelManager";
import { createDefaultSession } from "../../src/state/session";

describe("플레이어 레벨 만렙 (개발용)", () => {
  it("만렙으로 올리면 모든 콘텐츠가 열리고 다시 누르면 변화가 없다", () => {
    const state = createDefaultSession();
    expect(ALL_GATED_CONTENT.some((id) => isContentUnlocked(id, state.playerResearch.level, undefined, state.cleared))).toBe(false);
    const manager = new PlayerLevelManager(state);
    expect(manager.maxOutForDebug()).toBe(true);
    expect(state.playerResearch.level).toBe(PLAYER_LEVEL_CAP);
    expect(ALL_GATED_CONTENT.every((id) => isContentUnlocked(id, state.playerResearch.level, undefined, state.cleared))).toBe(true);
    expect(manager.maxOutForDebug()).toBe(false);
  });
});
