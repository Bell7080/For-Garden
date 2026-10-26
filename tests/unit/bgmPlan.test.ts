import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allBgmTracks, BGM_TRACKS, bgmTrackForScene, bgmTracksToEvict } from "../../src/core/bgmPlan";
import { BATTLE_SOUND_ASSETS, UI_SOUND_ASSETS } from "../../src/managers/AudioManager";

describe("배경음 표", () => {
  it("모든 트랙 파일이 실제로 있고 키가 겹치지 않는다", () => {
    const tracks = Object.values(BGM_TRACKS);
    for (const track of tracks) expect(existsSync(`public/${track.path}`), track.path).toBe(true);
    expect(new Set(tracks.map((t) => t.key)).size).toBe(tracks.length);
  });

  it("효과음 에셋 파일이 모두 있다", () => {
    for (const [, path] of [...UI_SOUND_ASSETS, ...BATTLE_SOUND_ASSETS]) expect(existsSync(`public/${path}`), path).toBe(true);
  });

  it("타이틀·로비는 기본 곡, 연구소·고고학은 연구탑 곡, 전투는 전투 곡이다", () => {
    expect(bgmTrackForScene("TitleScene")).toBe(BGM_TRACKS.title);
    expect(bgmTrackForScene("LobbyScene")).toBe(BGM_TRACKS.title);
    expect(bgmTrackForScene("LabScene")).toBe(BGM_TRACKS.researchSpire);
    expect(bgmTrackForScene("ArchaeologyScene")).toBe(BGM_TRACKS.researchSpire);
    expect(bgmTrackForScene("BattleScene")).toBe(BGM_TRACKS.battle);
  });

  it("부트·타이틀·오프닝·로비는 타이틀 곡이고 갈라진 메뉴 화면은 기존 시안 곡이다", () => {
    for (const key of ["BootScene", "TitleScene", "OpeningScene", "LobbyScene"]) {
      expect(bgmTrackForScene(key), key).toBe(BGM_TRACKS.title);
    }
    for (const key of ["StageMapScene", "PartyScene", "RelicsScene", "RaidScene"]) expect(bgmTrackForScene(key), key).toBe(BGM_TRACKS.glassCity);
    expect(bgmTrackForScene("ArenaMatchScene")).toBe(BGM_TRACKS.battle);
  });

  it("미리 받아 두는 목록이 모든 곡을 담는다", () => {
    expect(new Set(allBgmTracks().map((t) => t.key))).toEqual(new Set(Object.values(BGM_TRACKS).map((t) => t.key)));
  });

  it("지금 곡을 뺀 모든 곡이 디코드 해제 대상이다", () => {
    const evict = bgmTracksToEvict(BGM_TRACKS.battle.key).map((t) => t.key);
    expect(evict).not.toContain(BGM_TRACKS.battle.key);
    expect(evict).toHaveLength(allBgmTracks().length - 1);
  });

  it("겹침 층(설정·효과)은 표에 없어 곡을 건드리지 않는다", () => {
    expect(bgmTrackForScene("SettingsScene")).toBeUndefined();
    expect(bgmTrackForScene("EffectOverlayScene")).toBeUndefined();
  });
});
