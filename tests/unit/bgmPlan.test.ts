import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { allBgmTracks, BGM_TRACKS, bgmTrackForScene, bgmTracksToEvict } from "../../src/core/bgmPlan";
import { BATTLE_SOUND_ASSETS, RESEARCH_SOUND_ASSETS, SCENE_SOUND_ASSETS, UI_SOUND_ASSETS } from "../../src/managers/AudioManager";

/** 소스에 실제로 선언된 씬 키(`super("key")`·`super({ key })`·`static KEY`). */
function sceneKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of readdirSync("src/scenes").filter((f) => f.endsWith(".ts"))) {
    const source = readFileSync(`src/scenes/${file}`, "utf8");
    for (const m of source.matchAll(/super\(\s*(?:\{\s*key:\s*)?["']([\w-]+)["']/g)) keys.add(m[1]);
    for (const m of source.matchAll(/static readonly KEY = ["']([\w-]+)["']/g)) keys.add(m[1]);
  }
  return keys;
}

describe("배경음 표", () => {
  it("모든 트랙 파일이 실제로 있고 키가 겹치지 않는다", () => {
    const tracks = Object.values(BGM_TRACKS);
    for (const track of tracks) expect(existsSync(`public/${track.path}`), track.path).toBe(true);
    expect(new Set(tracks.map((t) => t.key)).size).toBe(tracks.length);
  });

  it("효과음 에셋 파일이 모두 있다", () => {
    for (const [, path] of [...UI_SOUND_ASSETS, ...BATTLE_SOUND_ASSETS, ...RESEARCH_SOUND_ASSETS, ...SCENE_SOUND_ASSETS]) expect(existsSync(`public/${path}`), path).toBe(true);
  });

  it("표의 열쇠는 실제 씬 키다 — 클래스 이름으로 적으면 어느 씬도 맞지 않는다", () => {
    const keys = sceneKeys();
    expect(keys.has("battle")).toBe(true);
    for (const key of ["boot", "title", "opening", "lobby", "lab", "archaeology", "shop", "premium", "battle", "arenaMatch", "stageMap", "party", "raid"]) {
      expect(keys.has(key), key).toBe(true);
      expect(bgmTrackForScene(key), key).toBeDefined();
    }
    expect(bgmTrackForScene("BattleScene")).toBeUndefined();
  });

  it("타이틀은 기본 곡, 로비는 로비 곡, 연구소·고고학은 연구탑 곡, 상점은 상점 곡, 전투는 전투 곡이다", () => {
    for (const key of ["boot", "title", "opening"]) expect(bgmTrackForScene(key), key).toBe(BGM_TRACKS.title);
    expect(bgmTrackForScene("lobby")).toBe(BGM_TRACKS.lobby);
    expect(BGM_TRACKS.lobby.key).not.toBe(BGM_TRACKS.title.key);
    expect(bgmTrackForScene("lab")).toBe(BGM_TRACKS.researchSpire);
    expect(bgmTrackForScene("archaeology")).toBe(BGM_TRACKS.researchSpire);
    expect(bgmTrackForScene("shop")).toBe(BGM_TRACKS.shop);
    expect(bgmTrackForScene("premium")).toBe(BGM_TRACKS.shop);
    for (const key of ["stageMap", "party", "relics", "raid"]) expect(bgmTrackForScene(key), key).toBe(BGM_TRACKS.glassCity);
    expect(bgmTrackForScene("battle")).toBe(BGM_TRACKS.battle);
    expect(bgmTrackForScene("arenaMatch")).toBe(BGM_TRACKS.battle);
  });

  it("레이드·원정 보스 판은 보스 곡이고 나머지 전투는 전투 곡이다", () => {
    expect(bgmTrackForScene("battle", { mode: "raid" })).toBe(BGM_TRACKS.boss);
    expect(bgmTrackForScene("battle", { mode: "expeditionBoss" })).toBe(BGM_TRACKS.boss);
    for (const mode of ["stage", "expedition", "cake", "bounty", "duel"]) expect(bgmTrackForScene("battle", { mode }), mode).toBe(BGM_TRACKS.battle);
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
    expect(bgmTrackForScene("settings")).toBeUndefined();
    expect(bgmTrackForScene("effect-overlay")).toBeUndefined();
    expect(bgmTrackForScene("arenaNotice")).toBeUndefined();
  });
});
