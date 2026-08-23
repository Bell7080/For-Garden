import { describe, expect, it, vi } from "vitest";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { createDefaultSession } from "../../src/state/session";

/** 설정의 순수 보정과 manager 저장 경계를 Phaser 없이 고정한다. */
describe("settings", () => {
  it("독립된 기본값을 만들고 음량 범위와 허용 목록 밖 값을 복구한다", () => {
    const first = createDefaultSettings(); const second = createDefaultSettings(); first.sound.masterVolume = 0;
    expect(second.sound.masterVolume).toBe(1);
    expect(normalizeSettings({ sound: { masterVolume: 8, musicVolume: -2 }, game: { battleSpeed: 99, textSpeed: "fast", language: "xx" }, account: { provider: "token", token: "secret" } })).toMatchObject({ sound: { masterVolume: 1, musicVolume: 0 }, game: { battleSpeed: 1, textSpeed: 1, language: "ko" }, account: { provider: "guest" } });
  });

  it("부분 변경을 보정해 저장하고 초기화하되 진행은 보존한다", () => {
    const state = createDefaultSession(); state.wallet.gold = 77; const save = vi.fn(); const manager = new SettingsManager(state, { save });
    manager.update({ sound: { musicVolume: 0.25 }, game: { autoUltimate: true } });
    expect(manager.get()).toMatchObject({ sound: { musicVolume: 0.25 }, game: { autoUltimate: true } }); expect(save).toHaveBeenCalledTimes(1);
    manager.reset(); expect(manager.get()).toEqual(createDefaultSettings()); expect(state.wallet.gold).toBe(77); expect(save).toHaveBeenCalledTimes(2);
  });
});
