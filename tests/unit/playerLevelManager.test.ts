import { describe, expect, it } from "vitest";
import { PLAYER_LEVEL_CAP } from "../../src/core/playerLevel";
import { isContentUnlocked, CONTENT_UNLOCKS } from "../../src/core/contentUnlock";
import { PlayerLevelManager } from "../../src/managers/PlayerLevelManager";
import { createDefaultSession } from "../../src/state/session";

describe("플레이어 레벨 만렙 (개발용)", () => {
  it("만렙으로 올리면 모든 콘텐츠가 열리고 다시 누르면 변화가 없다", () => {
    const state = createDefaultSession();
    expect(CONTENT_UNLOCKS.some(({ id }) => isContentUnlocked(id, state.playerResearch.level))).toBe(false);
    const manager = new PlayerLevelManager(state);
    expect(manager.maxOutForDebug()).toBe(true);
    expect(state.playerResearch.level).toBe(PLAYER_LEVEL_CAP);
    expect(CONTENT_UNLOCKS.every(({ id }) => isContentUnlocked(id, state.playerResearch.level))).toBe(true);
    expect(manager.maxOutForDebug()).toBe(false);
  });
});
