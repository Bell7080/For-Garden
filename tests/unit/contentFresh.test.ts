import { describe, expect, it } from "vitest";
import { anyContentFresh, markContentVisited, normalizeContentSeen, observeOpenContent, SORTIE_CONTENT } from "../../src/core/contentFresh";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";
import { readFileSync } from "node:fs";

describe("새로 열린 콘텐츠의 기록", () => {
  it("기록이 없던 계정은 지금 열린 것을 이미 본 것으로 시작한다 — NEW가 한꺼번에 서지 않는다", () => {
    const { state, newly } = observeOpenContent(null, "uid-1", ["excavation", "shop"]);
    expect(newly).toEqual([]);
    expect(state.fresh).toEqual([]);
    expect(state.known).toEqual(["excavation", "shop"]);
  });

  it("그 사이 새로 열린 것만 고르고, 들어가 볼 때까지 NEW로 남긴다", () => {
    const first = observeOpenContent(null, "uid-1", ["excavation"]).state;
    const { state, newly } = observeOpenContent(first, "uid-1", ["excavation", "shop", "trade", "cakeOperation"]);
    expect(newly).toEqual(["shop", "trade", "cakeOperation"]);
    expect(anyContentFresh(state, ["shop"])).toBe(true);
    expect(anyContentFresh(state, SORTIE_CONTENT)).toBe(true);
    // 다시 보아도 이미 센 것은 또 새것이 되지 않는다(앱을 껐다 켜도 같다).
    const again = observeOpenContent(state, "uid-1", ["excavation", "shop", "trade", "cakeOperation"]);
    expect(again.newly).toEqual([]);
    expect(again.state.fresh).toEqual(state.fresh);
    const visited = markContentVisited(again.state, "cakeOperation");
    expect(anyContentFresh(visited, SORTIE_CONTENT)).toBe(false);
    expect(anyContentFresh(visited, ["shop"])).toBe(true);
  });

  it("계정이 바뀌면 처음부터 다시 잰다", () => {
    const mine = observeOpenContent(observeOpenContent(null, "a", []).state, "a", ["shop"]).state;
    const other = observeOpenContent(mine, "b", ["shop", "duel"]);
    expect(other.newly).toEqual([]);
    expect(other.state.owner).toBe("b");
  });

  it("다시 닫힌 것은 기록에서 빠져, 다시 열리면 또 새것으로 센다", () => {
    const opened = observeOpenContent(observeOpenContent(null, "a", []).state, "a", ["duel"]).state;
    const closed = observeOpenContent(opened, "a", []).state;
    expect(closed.fresh).toEqual([]);
    expect(observeOpenContent(closed, "a", ["duel"]).newly).toEqual(["duel"]);
  });

  it("설정 저장을 지나도 모양이 유지되고, 모르는 값은 버린다", () => {
    expect(createDefaultSettings().game.contentSeen).toBeNull();
    expect(normalizeSettings({}).game.contentSeen).toBeNull();
    const saved = normalizeSettings({ game: { contentSeen: { owner: "a", known: ["shop", "nope", "shop"], fresh: ["shop", "duel"] } } });
    expect(saved.game.contentSeen).toEqual({ owner: "a", known: ["shop"], fresh: ["shop"] });
    expect(normalizeContentSeen({ owner: 3 })).toBeNull();
  });

  it("입구는 열린 콘텐츠를 실제로 열 때 NEW를 지운다", () => {
    const lobby = readFileSync("src/scenes/LobbyScene.ts", "utf8").replace(/\r\n/g, "\n");
    expect(lobby).toMatch(/if \(contentOpen\(id\)\) \{ markContentEntered\(id\); action\(\); \}/);
    const nav = readFileSync("src/ui/BottomNav.ts", "utf8").replace(/\r\n/g, "\n");
    expect(nav).toContain("markContentEntered(contentId);\n          startNavScene");
  });
});
