import { describe, expect, it } from "vitest";
import { DEFAULT_RUNE_BULK_SELL_CRITERIA, planRuneBulkSell, runeCraftState, toggleBulkSellValue, RUNE_CRAFT_STATES, type RuneBulkSellCriteria } from "../../src/core/runeBulkSell";
import { generateRune, type RuneInstance, type RunePart, type RuneRarity } from "../../src/core/runes";
import { runeSellValue } from "../../src/data/runes";

let seq = 0;
function rune(rarity: RuneRarity, part: RunePart = 0, extra: Partial<RuneInstance> = {}): RuneInstance {
  seq += 1;
  return { ...generateRune({ instanceId: `r-${seq}`, baseName: "rune", rarity, part, random: () => 0.3 }), ...extra };
}

const crafted = (base: RuneInstance): RuneInstance => ({ ...base, enhancementHistory: { [base.mainStats[0].key]: [{ succeeded: true, increase: 2 }] } as RuneInstance["enhancementHistory"] });
const engraved = (base: RuneInstance): RuneInstance => ({ ...crafted(base), engravings: [{ statKey: base.mainStats[0].key, increase: 2 }] as unknown as RuneInstance["engravings"] });

const context = (equipped: readonly string[] = []) => ({ isEquipped: (id: string) => equipped.includes(id), sellValue: runeSellValue });

describe("룬 일괄 판매", () => {
  it("기본 조건은 손대지 않은 고급·희귀만 고른다", () => {
    const pool = [rune("uncommon"), rune("rare", 1), rune("epic"), rune("legendary"), crafted(rune("uncommon")), rune("rare", 2, { trait: { id: "x" } as unknown as RuneInstance["trait"] })];
    const plan = planRuneBulkSell(pool, DEFAULT_RUNE_BULK_SELL_CRITERIA, context());
    expect(plan.runes.map(({ instanceId }) => instanceId)).toEqual([pool[0].instanceId, pool[1].instanceId]);
    expect(plan.rawStone).toBe(runeSellValue(pool[0]) + runeSellValue(pool[1]));
  });

  it("잠금·장착·즐겨찾기는 조건에 맞아도 빠지고 보호된 수로 센다", () => {
    const free = rune("uncommon");
    const pool = [free, rune("uncommon", 0, { locked: true }), rune("uncommon", 0, { bookmarked: true }), rune("uncommon")];
    const plan = planRuneBulkSell(pool, DEFAULT_RUNE_BULK_SELL_CRITERIA, context([pool[3].instanceId]));
    expect(plan.runes).toEqual([free]);
    expect(plan.protectedCount).toBe(3);
  });

  it("빈 축은 전부가 아니라 아무것도 아니다", () => {
    const pool = [rune("uncommon"), rune("rare")];
    const none: RuneBulkSellCriteria = { ...DEFAULT_RUNE_BULK_SELL_CRITERIA, rarities: [] };
    expect(planRuneBulkSell(pool, none, context()).runes).toHaveLength(0);
    expect(planRuneBulkSell(pool, { ...DEFAULT_RUNE_BULK_SELL_CRITERIA, parts: [] }, context()).runes).toHaveLength(0);
  });

  it("세공 상태를 셋으로 가른다", () => {
    const base = rune("rare");
    expect(runeCraftState(base)).toBe("fresh");
    expect(runeCraftState(crafted(base))).toBe("crafting");
    expect(runeCraftState(engraved(base))).toBe("engraved");
    const pool = [base, crafted(rune("rare")), engraved(rune("rare"))];
    const all: RuneBulkSellCriteria = { ...DEFAULT_RUNE_BULK_SELL_CRITERIA, craft: RUNE_CRAFT_STATES };
    expect(planRuneBulkSell(pool, all, context()).runes).toHaveLength(3);
  });

  it("칩을 뒤집어도 표의 순서를 지킨다", () => {
    expect(toggleBulkSellValue(["engraved"], "fresh", RUNE_CRAFT_STATES)).toEqual(["fresh", "engraved"]);
    expect(toggleBulkSellValue(["fresh", "engraved"], "fresh", RUNE_CRAFT_STATES)).toEqual(["engraved"]);
  });
});
