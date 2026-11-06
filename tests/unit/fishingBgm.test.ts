import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FISHING_BGM_READY, FISHING_BGM_TRACKS, fishingBgmTrack } from "../../src/core/bgmPlan";

describe("리듬 낚시 곡", () => {
  it("파일이 다 있을 때만 켤 수 있다", () => {
    for (const track of Object.values(FISHING_BGM_TRACKS)) {
      if (FISHING_BGM_READY) expect(existsSync(`public/${track.path}`), track.path).toBe(true);
    }
    if (!FISHING_BGM_READY) expect(fishingBgmTrack("easy", false)).toBeUndefined();
  });

  it("보스 물고기는 난이도와 무관하게 보스곡이다", () => {
    if (!FISHING_BGM_READY) return;
    expect(fishingBgmTrack("easy", true)).toBe(FISHING_BGM_TRACKS.boss);
    expect(fishingBgmTrack("hard", false)).toBe(FISHING_BGM_TRACKS.hard);
  });
});
