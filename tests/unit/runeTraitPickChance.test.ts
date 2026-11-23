import { describe, expect, it } from "vitest";
import { pickRuneTraitId, RUNE_TRAIT_GRADES, runeTraitPickChance } from "../../src/core/runeTraits";
import { LEGENDARY_EXCLUSIVE_SHARE, RUNE_TRAIT_POOL } from "../../src/data/runeTraits";

describe("특성 확률표의 특성별 확률", () => {
  it("등급마다 나올 수 있는 특성의 확률 합이 1이다", () => {
    for (const grade of RUNE_TRAIT_GRADES) {
      const total = RUNE_TRAIT_POOL.reduce((sum, entry) => sum + runeTraitPickChance(RUNE_TRAIT_POOL, grade, entry.id, LEGENDARY_EXCLUSIVE_SHARE), 0);
      expect(total).toBeCloseTo(1, 10);
    }
  });

  it("실제 추첨과 같은 몫을 말한다", () => {
    for (const grade of RUNE_TRAIT_GRADES) {
      const counts = new Map<string, number>();
      const steps = 20_000;
      for (let index = 0; index < steps; index += 1) {
        let calls = 0;
        const values = [(index + 0.5) / steps, ((index * 7919) % steps + 0.5) / steps];
        const id = pickRuneTraitId(RUNE_TRAIT_POOL, grade, () => values[calls++ % 2], LEGENDARY_EXCLUSIVE_SHARE);
        counts.set(id, (counts.get(id) ?? 0) + 1);
      }
      for (const entry of RUNE_TRAIT_POOL) {
        expect((counts.get(entry.id) ?? 0) / steps).toBeCloseTo(runeTraitPickChance(RUNE_TRAIT_POOL, grade, entry.id, LEGENDARY_EXCLUSIVE_SHARE), 2);
      }
    }
  });
});
