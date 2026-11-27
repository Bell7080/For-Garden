import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { changedRuneParts, clearRuneDraftSlot, leaveRuneDraftSlot, rebaseRuneDraftAfterApply, recommendIntoDraft, runeCandidatePowerDelta, runeCompareLines, runeDraftMovedFrom, tapRuneDraft } from "../../src/core/runeDraft";
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
  const def = getRelic("rexia");
  const progress: RelicProgress = { level: 30, exp: 0, breakthrough: 1, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: slots };
  return { relicId: "rexia", base: def.stats, rarity: def.rarity, progress };
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

  it("적용하지 않고 칸을 옮기면 손으로 올린 후보만 빠진다", () => {
    const base = ["a0", "a1", null] as const;
    const picked = tapRuneDraft([...base], [...base], 0, "b0");
    // 손으로 고른 1번 칸 후보는 칸을 떠나면 저장된 룬으로 돌아간다.
    expect(leaveRuneDraftSlot([...base], picked, 0, new Set())).toEqual([...base]);
    // 추천처럼 한꺼번에 올린 칸은 남는다.
    expect(leaveRuneDraftSlot([...base], ["b0", "b1", "b2"], 0, new Set([0, 1, 2]))).toEqual(["b0", "b1", "b2"]);
    // 떠나는 칸만 되돌리고 다른 칸은 건드리지 않는다.
    expect(leaveRuneDraftSlot([...base], ["b0", "b1", null], 1, new Set([0]))).toEqual(["b0", "a1", null]);
  });

  it("1번을 적용하고 저장이 도는 사이 2번에 올린 후보는 저장이 끝나도 남는다", () => {
    const saved0: RuneLoadoutSlots = ["a0", "a1", "a2"];
    // 1번 칸에 b0을 올려 적용 — 저장이 도는 동안은 보낸 구성이 「저장된 룬」이다.
    const sent = tapRuneDraft(saved0, saved0, 0, "b0");
    // 그 사이 2번 칸으로 옮긴다 — 보낸 1번 후보는 되돌아가지 않는다.
    let draft = leaveRuneDraftSlot(sent, sent, 0, new Set());
    expect(draft).toEqual(["b0", "a1", "a2"]);
    draft = tapRuneDraft(sent, draft, 1, "b1");
    // 저장이 끝났다 — 1번은 저장값으로 맞춰지고 2번 후보는 그대로 남는다.
    const saved1: RuneLoadoutSlots = ["b0", "a1", "a2"];
    const next = rebaseRuneDraftAfterApply(sent, saved1, draft, () => true);
    expect(next).toEqual(["b0", "b1", "a2"]);
    expect(changedRuneParts(saved1, next)).toEqual([1]);
    // 이어 2번을 적용해도 1번은 빠지지 않는다.
    const sent2 = next;
    const saved2: RuneLoadoutSlots = ["b0", "b1", "a2"];
    expect(rebaseRuneDraftAfterApply(sent2, saved2, sent2, () => true)).toEqual(saved2);
  });

  it("저장이 끝났을 때 사라진 룬의 후보는 저장값으로 돌아간다", () => {
    const sent: RuneLoadoutSlots = ["b0", "a1", null];
    const draft: RuneLoadoutSlots = ["b0", "gone", null];
    expect(rebaseRuneDraftAfterApply(sent, sent, draft, (id) => id !== "gone")).toEqual(sent);
  });

  it("다른 렐릭이 낀 룬만 옮겨 끼는 렐릭으로 알린다", () => {
    const holders = runeHolders({ rexia: { heartGemSlots: ["a0", null, "a2"] }, torika: { heartGemSlots: [null, "t1", null] } });
    expect(runeDraftMovedFrom(["a0", "t1", null], holders, "rexia")).toEqual([null, "torika", null]);
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
    const holders = runeHolders({ rexia: { heartGemSlots: ["a0", null, null] }, torika: { heartGemSlots: [null, "t1", null] } });
    const current = relic(["a0", null, null]);
    const auto = recommendIntoDraft(current, ["a0", null, null], runes, holders, "auto");
    expect(auto.slots).toEqual(["b0", null, null]);
    const recommend = recommendIntoDraft(current, ["a0", null, null], runes, holders, "recommend");
    expect(recommend.slots).toEqual(["b0", "t1", null]);
    // 임시로 비운 칸도 지금으로 본다 — 저장의 a0가 아니라 빈 칸에서 고른다.
    expect(recommendIntoDraft(current, [null, null, null], [runes[0]!], holders, "auto").slots).toEqual(["a0", null, null]);
    expect(holders.get("a0")).toBe("rexia");
    expect(runeCandidatePowerDelta(current, ["a0", null, null], 0, "b0", runes)).toBeGreaterThan(0);
  });
});
