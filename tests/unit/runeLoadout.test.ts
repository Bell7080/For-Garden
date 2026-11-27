import { describe, expect, it } from "vitest";
import { getRelic } from "../../src/data/relics";
import { recommendRuneLoadout, runeHolders, type RuneLoadoutRelic } from "../../src/core/runeLoadout";
import { createRuneInstance, type RuneMainStatKey, type RunePart, type RuneRarity, type RuneStatKey } from "../../src/core/runes";
import type { RelicProgress } from "../../src/core/types";

const VALUES: Record<RuneStatKey, number> = {
  hp: 8, atk: 8, ap: 8, def: 8, res: 8,
  moveSpeed: 5, attackSpeed: 5, lifeSteal: 5, critChance: 5, critDamage: 5, ferocityGain: 1, energyGain: 2,
};

function rune(id: string, part: RunePart, mainKeys: readonly [RuneMainStatKey, RuneMainStatKey], rarity: RuneRarity = "uncommon") {
  return createRuneInstance({ instanceId: id, baseName: "추천 테스트 룬", rarity, part, statValues: VALUES, mainKeys, random: () => 0 });
}

function relic(id: string, slots: [string | null, string | null, string | null] = [null, null, null]): RuneLoadoutRelic {
  const def = getRelic(id);
  const progress: RelicProgress = { level: 30, exp: 0, breakthrough: 1, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: slots };
  return { relicId: id, base: def.stats, rarity: def.rarity, progress };
}

describe("룬 장착 추천", () => {
  it("칸마다 제 자리의 룬 중 전투력을 가장 올리는 것을 고른다", () => {
    const runes = [rune("a0", 0, ["hp", "def"]), rune("b0", 0, ["atk", "ap"], "legendary"), rune("a1", 1, ["atk", "res"]), rune("a2", 2, ["hp", "res"])];
    const plan = recommendRuneLoadout(relic("rexia"), runes, new Map());
    // 전설은 보조 옵션이 셋이라 같은 주 옵션 값이어도 더 올린다.
    expect(plan.slots).toEqual(["b0", "a1", "a2"]);
    expect(plan.powerAfter).toBeGreaterThan(plan.powerBefore);
    expect(plan.changed).toBe(true);
  });

  it("다른 렐릭이 낀 룬은 허락할 때만 후보이고, 빼 오는 렐릭을 알린다", () => {
    const runes = [rune("a0", 0, ["atk", "ap"], "legendary")];
    const holders = runeHolders({ torika: { heartGemSlots: ["a0", null, null] } });
    expect(recommendRuneLoadout(relic("rexia"), runes, holders).slots).toEqual([null, null, null]);
    const moved = recommendRuneLoadout(relic("rexia"), runes, holders, { includeOthers: true });
    expect(moved.slots[0]).toBe("a0");
    expect(moved.movedFrom).toEqual(["torika", null, null]);
  });

  it("빈 칸만 채우기는 이미 낀 칸을 건드리지 않고, 더 나은 것이 없으면 바꾸지 않는다", () => {
    const runes = [rune("weak", 0, ["hp", "def"]), rune("strong", 0, ["atk", "ap"], "legendary"), rune("a1", 1, ["atk", "res"])];
    const current = relic("rexia", ["weak", null, null]);
    const holders = runeHolders({ rexia: current.progress });
    expect(recommendRuneLoadout(current, runes, holders, { emptyOnly: true }).slots).toEqual(["weak", "a1", null]);
    const settled = relic("rexia", ["strong", "a1", null]);
    const again = recommendRuneLoadout(settled, runes, runeHolders({ rexia: settled.progress }));
    expect(again.changed).toBe(false);
    expect(again.powerAfter).toBe(again.powerBefore);
  });
});
