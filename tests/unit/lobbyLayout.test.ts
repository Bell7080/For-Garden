import { describe, expect, it } from "vitest";
import { LOBBY_ACTION_BOUNDS, LOBBY_MISSION_ENTRY, lobbyBoundsGap, lobbyBoundsIntersect } from "../../src/ui/lobbyLayout";

describe("lobby input layout", () => {
  it("keeps the mission, expedition, sortie, and navigation bounds separated", () => {
    // 위치가 조금 바뀌어도 확대 입력 피드백이 이웃 행동을 덮지 않도록 최소 한 버튼 폭을 남긴다.
    const neighbors = [LOBBY_ACTION_BOUNDS.expedition, LOBBY_ACTION_BOUNDS.sortie, LOBBY_ACTION_BOUNDS.bottomNav];
    expect(neighbors.every((bounds) => !lobbyBoundsIntersect(LOBBY_MISSION_ENTRY, bounds))).toBe(true);
    expect(neighbors.every((bounds) => lobbyBoundsGap(LOBBY_MISSION_ENTRY, bounds) >= LOBBY_MISSION_ENTRY.width)).toBe(true);
  });
});
