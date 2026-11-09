import { describe, expect, it } from "vitest";
import { PARTY_PRESET_COUNT, PARTY_PRESET_NAME_MAX, normalizePartyPresets, normalizePresetIndex, ownedPresetSlots, presetSwipeDirection, samePresets, stepPresetIndex, withPreset } from "../../src/core/partyPresets";
import { createDefaultSettings, normalizeSettings } from "../../src/core/settings";
import { accountGameSettings, accountPartOfPatch } from "../../src/core/settingsOwnership";

describe("편성 프리셋", () => {
  it("저장값을 다섯 벌 · 세 자리로 맞추고 한 벌 안의 중복을 비운다", () => {
    const presets = normalizePartyPresets([{ name: "  레이드\n용  ", slots: ["torika", "torika", 3] }, "broken"]);
    expect(presets).toHaveLength(PARTY_PRESET_COUNT);
    expect(presets[0]).toEqual({ name: "레이드 용", slots: ["torika", null, null] });
    expect(presets[1]).toEqual({ name: "", slots: [null, null, null] });
  });

  it("이름은 화면에 서는 글자로 세어 자른다", () => {
    const name = normalizePartyPresets([{ name: "👨‍👩‍👧".repeat(12), slots: [] }])[0].name;
    expect(Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(name))).toHaveLength(PARTY_PRESET_NAME_MAX);
  });

  it("넘기기는 끝에서 처음으로 돈다", () => {
    expect(stepPresetIndex(4, 1)).toBe(0);
    expect(stepPresetIndex(0, -1)).toBe(4);
    expect(normalizePresetIndex(7)).toBe(0);
    expect(normalizePresetIndex(3)).toBe(3);
  });

  it("잃은 렐릭만 비우고 자리는 당기지 않는다", () => {
    expect(ownedPresetSlots({ name: "", slots: ["a", "b", "c"] }, new Set(["a", "c"]))).toEqual(["a", null, "c"]);
  });

  it("한 벌만 바꾸고 바뀐 것이 없으면 같다고 본다", () => {
    const base = normalizePartyPresets([]);
    const next = withPreset(base, 2, { name: "보스", slots: ["a", "b", "c"] });
    expect(next[2]).toEqual({ name: "보스", slots: ["a", "b", "c"] });
    expect(next[0]).toEqual(base[0]);
    expect(samePresets(next, withPreset(next, 2, {}))).toBe(true);
    expect(samePresets(next, base)).toBe(false);
  });

  it("짧게 옆으로 민 손만 넘기기다", () => {
    expect(presetSwipeDirection({ elapsedMs: 200, dx: -160, dy: 20 })).toBe(1);
    expect(presetSwipeDirection({ elapsedMs: 200, dx: 160, dy: 20 })).toBe(-1);
    expect(presetSwipeDirection({ elapsedMs: 200, dx: 40, dy: 0 })).toBe(0);
    expect(presetSwipeDirection({ elapsedMs: 200, dx: 120, dy: 110 })).toBe(0);
    // 꾹 누른 뒤의 손은 끌어 옮기기다.
    expect(presetSwipeDirection({ elapsedMs: 500, dx: 200, dy: 0 })).toBe(0);
  });

  it("계정 설정으로 오가며 정규화를 지난다", () => {
    const settings = createDefaultSettings();
    settings.game.partyPresets = withPreset(settings.game.partyPresets, 1, { name: "현상수배", slots: ["a", null, "b"] });
    settings.game.partyPresetIndex = 1;
    const round = normalizeSettings(JSON.parse(JSON.stringify(settings)));
    expect(round.game.partyPresets[1]).toEqual({ name: "현상수배", slots: ["a", null, "b"] });
    expect(accountGameSettings(round.game).partyPresetIndex).toBe(1);
    expect(accountPartOfPatch({ game: { partyPresetIndex: 2 } })).toEqual({ partyPresetIndex: 2 });
  });
});

describe("편성 프리셋 — 빈 띠의 손짓", () => {
  it("SD 밖에서 민 손은 천천히 밀어도 넘긴다", () => {
    expect(presetSwipeDirection({ elapsedMs: 4000, dx: -200, dy: 10 }, false)).toBe(1);
  });
});
