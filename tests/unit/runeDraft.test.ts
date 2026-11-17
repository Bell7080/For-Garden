import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { changedRuneParts, clearRuneDraftSlot, recommendIntoDraft, runeCandidatePowerDelta, runeCompareLines, runeDraftMovedFrom, tapRuneDraft } from "../../src/core/runeDraft";
import { runeHolders, type RuneLoadoutRelic, type RuneLoadoutSlots } from "../../src/core/runeLoadout";
import { createRuneInstance, runeOptionValue, type RuneMainStatKey, type RunePart, type RuneRarity, type RuneStatKey } from "../../src/core/runes";
import type { RelicProgress } from "../../src/core/types";

const VALUES: Record<RuneStatKey, number> = {
  hp: 8, atk: 8, ap: 8, def: 8, res: 8,
  moveSpeed: 5, attackSpeed: 5, lifeSteal: 5, critChance: 5, critDamage: 5, ferocityGain: 1, energyGain: 2,
};

function rune(id: string, part: RunePart, mainKeys: readonly [RuneMainStatKey, RuneMainStatKey], rarity: RuneRarity = "uncommon") {
  return createRuneInstance({ instanceId: id, baseName: "정비 테스트 룬", rarity, part, statValues: VALUES, mainKeys, random: () => 0 });
}

function relic(slots: [string | null, string | null, string | null] = [null, null, null]): RuneLoadoutRelic {
  const def = getRelic("rex");
  const progress: RelicProgress = { level: 30, exp: 0, breakthrough: 1, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: slots };
  return { relicId: "rex", base: def.stats, rarity: def.rarity, progress };
}

describe("룬 정비 임시 구성", () => {
  const base: RuneLoadoutSlots = ["a0", null, "a2"];

  it("카드를 누르면 후보가 되고, 같은 카드를 다시 누르면 저장된 룬으로 돌아간다", () => {
    const picked = tapRuneDraft(base, base, 0, "b0");
    expect(picked).toEqual(["b0", null, "a2"]);
    expect(changedRuneParts(base, picked)).toEqual([0]);
    expect(tapRuneDraft(base, picked, 0, "b0")).toEqual(base);
    // 저장된 룬을 누르면 그대로다.
    expect(tapRuneDraft(base, base, 0, "a0")).toEqual(base);
    expect(changedRuneParts(base, clearRuneDraftSlot(picked, 2))).toEqual([0, 2]);
  });

  it("다른 렐릭이 낀 룬만 옮겨 끼는 렐릭으로 알린다", () => {
    const holders = runeHolders({ rex: { heartGemSlots: ["a0", null, "a2"] }, torika: { heartGemSlots: [null, "t1", null] } });
    expect(runeDraftMovedFrom(["a0", "t1", null], holders, "rex")).toEqual([null, "torika", null]);
  });

  it("옵션 비교는 주 옵션부터 세우고 빠지는 옵션은 0으로 읽는다", () => {
    const before = rune("a0", 0, ["hp", "def"]);
    const after = rune("b0", 0, ["atk", "def"], "legendary");
    const lines = runeCompareLines(before, after);
    expect(lines.filter(({ main }) => main).map(({ key }) => key)).toEqual(["atk", "def", "hp"]);
    const hp = lines.find(({ key }) => key === "hp")!;
    expect(hp.after).toBe(0);
    expect(hp.delta).toBeLessThan(0);
    expect(lines.find(({ key }) => key === "atk")!.after).toBe(runeOptionValue(after, "atk"));
    expect(lines.every(({ main }, i) => main || lines.slice(i).every((line) => !line.main))).toBe(true);
    expect(runeCompareLines(undefined, undefined)).toEqual([]);
  });

  it("자동·추천은 임시 구성 위에서 돌고 저장된 장착표를 바꾸지 않는다", () => {
    const runes = [rune("a0", 0, ["hp", "def"]), rune("b0", 0, ["atk", "ap"], "legendary"), rune("t1", 1, ["atk", "ap"], "legendary")];
    const holders = runeHolders({ rex: { heartGemSlots: ["a0", null, null] }, torika: { heartGemSlots: [null, "t1", null] } });
    const current = relic(["a0", null, null]);
    const auto = recommendIntoDraft(current, ["a0", null, null], runes, holders, "auto");
    expect(auto.slots).toEqual(["b0", null, null]);
    const recommend = recommendIntoDraft(current, ["a0", null, null], runes, holders, "recommend");
    expect(recommend.slots).toEqual(["b0", "t1", null]);
    // 임시로 비운 칸도 지금으로 본다 — 저장의 a0가 아니라 빈 칸에서 고른다.
    expect(recommendIntoDraft(current, [null, null, null], [runes[0]!], holders, "auto").slots).toEqual(["a0", null, null]);
    expect(holders.get("a0")).toBe("rex");
    expect(runeCandidatePowerDelta(current, ["a0", null, null], 0, "b0", runes)).toBeGreaterThan(0);
  });
});
