import { describe, expect, it } from "vitest";
import { ULTIMATE_ENERGY_MAX, ultimateEnergyCap } from "../../src/core/ultimate";
import { getRelic } from "../../src/data/relics";
import { PLAYABLE_RELICS } from "../../src/data/relics";

describe("궁극기 게이지 상한", () => {
  it("은 전역 상한이 아니라 그 개체의 궁극기 비용까지다", () => {
    for (const def of PLAYABLE_RELICS) {
      const cap = ultimateEnergyCap({ def } as never);
      expect(cap, def.id).toBe(Math.min(ULTIMATE_ENERGY_MAX, def.ultimate.cost));
    }
    expect(ultimateEnergyCap({ def: getRelic("maki") } as never)).toBeLessThan(ULTIMATE_ENERGY_MAX);
  });
});
