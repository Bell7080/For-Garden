import { describe, expect, it } from "vitest";
// 이 파일의 첫 import는 설정 매니저다 — FakeServer와 순환해도 읽는 순서가 어떻든 모듈이 터지지 않아야 한다.
import { SettingsManager } from "../../src/managers/SettingsManager";
import { FakeServer } from "../../src/api/FakeServer";
import { ACCOUNT_GAME_SETTING_KEYS, accountPartOfPatch, mergeServerSettings } from "../../src/core/settingsOwnership";
import { createDefaultSettings } from "../../src/core/settings";
import { createDefaultSession } from "../../src/state/session";

function setup() {
  const state = createDefaultSession();
  const saved: unknown[] = [];
  const server = new FakeServer(state, { latencyMs: 0, persistSession: (next) => { saved.push(structuredClone(next.settings)); } });
  const manager = new SettingsManager(state, { save: () => undefined }, undefined, server);
  return { state, server, manager, saved };
}

describe("환경설정의 주인", () => {
  it("계정의 값만 서버로 가고 기기의 값은 가지 않는다", async () => {
    const { state } = setup();
    const serverSide = createDefaultSession();
    const server = new FakeServer(serverSide, { latencyMs: 0, persistSession: () => undefined });
    const m = new SettingsManager(state, { save: () => undefined }, undefined, server);
    m.update({ game: { battleSpeed: 2, autoUltimate: true, textSpeed: 2 }, sound: { masterVolume: 0.2 }, accessibility: { textScale: 1.3 } });
    await m.settled();
    expect(serverSide.settings.game).toMatchObject({ battleSpeed: 2, autoUltimate: true, textSpeed: 2 });
    // 소리와 글자 크기는 이 기기에만 남는다.
    expect(serverSide.settings.sound.masterVolume).toBe(createDefaultSettings().sound.masterVolume);
    expect(serverSide.settings.accessibility.textScale).toBe(1);
  });

  it("기기의 값만 바꾸면 서버를 부르지 않는다", async () => {
    const { manager, saved } = setup();
    manager.update({ sound: { masterVolume: 0.1 }, game: { language: "en" } });
    await manager.settled();
    expect(saved).toHaveLength(0);
  });

  it("던전 단계와 초기화도 계정의 값으로 서버에 닿는다", async () => {
    const serverSide = createDefaultSession();
    const state = createDefaultSession();
    const m = new SettingsManager(state, { save: () => undefined }, undefined, new FakeServer(serverSide, { latencyMs: 0, persistSession: () => undefined }));
    m.rememberDungeonTier("bounty", "tier-3");
    await m.settled();
    expect(serverSide.settings.game.dungeonTiers.bounty).toBe("tier-3");
    m.reset();
    await m.settled();
    expect(serverSide.settings.game.dungeonTiers.bounty).toBe("");
  });

  it("허용 목록 밖의 키는 버리고 서버 정규화가 잘못된 값을 기본값으로 돌린다", async () => {
    expect(accountPartOfPatch({ game: { language: "en" } })).toBeNull();
    expect(accountPartOfPatch({ game: { battleSpeed: 2, language: "en" } })).toEqual({ battleSpeed: 2 });
    const { server, state } = setup();
    const response = await server.updateAccountSettings({ game: { battleSpeed: 99 as never, autoUltimate: true } });
    expect(response.game).toMatchObject({ battleSpeed: 1, autoUltimate: true });
    expect(state.settings.game.autoUltimate).toBe(true);
  });

  it("서버 상태를 받아도 기기의 값은 지키고 계정의 값만 서버 것이 된다", () => {
    const local = createDefaultSettings();
    local.sound.masterVolume = 0.3; local.accessibility.textScale = 1.15; local.game.language = "ja"; local.game.battleSpeed = 1;
    const server = createDefaultSettings();
    server.game.battleSpeed = 2; server.sound.masterVolume = 1; server.game.language = "ko";
    const merged = mergeServerSettings(local, server);
    expect(merged.game.battleSpeed).toBe(2);
    expect(merged.sound.masterVolume).toBe(0.3);
    expect(merged.accessibility.textScale).toBe(1.15);
    expect(merged.game.language).toBe("ja");
  });

  it("계정의 값 목록은 설정 모델의 키와 어긋나지 않는다", () => {
    const keys = Object.keys(createDefaultSettings().game);
    for (const key of ACCOUNT_GAME_SETTING_KEYS) expect(keys).toContain(key);
    // 언어는 기기의 값이다.
    expect(ACCOUNT_GAME_SETTING_KEYS as readonly string[]).not.toContain("language");
  });
});
