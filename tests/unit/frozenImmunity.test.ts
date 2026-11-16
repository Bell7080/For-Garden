import { describe, expect, it } from "vitest";
import { createSkirmish, FROZEN, stepSkirmish } from "../../src/core/skirmish";
import { battleArena } from "../../src/core/battleArena";
import { createDifficultyRng } from "../../src/core/stageDifficulty";
import { getRelic } from "../../src/data/relics";
import type { RelicDef } from "../../src/core/types";

/** 빙결이 풀린 뒤 `FROZEN.immunitySeconds` 동안은 다시 얼지 않는다 — 매디의 둔화 → 빙결 반복이 한 적을 묶어 두지 못하게 한다. */
describe("빙결 면역", () => {
  it("풀린 적은 면역 시간이 지나기 전에 다시 얼지 않고, 얼어 있는 시간은 절반을 넘지 않는다", () => {
    const maddy = getRelic("maddy");
    const ally: RelicDef = { ...maddy, stats: { ...maddy.stats, energyGain: 200, attackSpeed: 300 } };
    const toby = getRelic("toby");
    const foe: RelicDef = { ...toby, stats: { ...toby.stats, hp: 5_000_000, atk: 1, ap: 1 } };
    const state = createSkirmish([ally], [foe], battleArena("duel"), {}, {}, { automaticUltimates: true });
    const rng = createDifficultyRng(3);
    const target = state.fighters.find((fighter) => fighter.side === "enemy")!;
    const dt = 1 / 30;
    let frozenTime = 0, freezes = 0, thawedAt: number | null = null, wasFrozen = false;
    for (let k = 0; k < 60 * 30; k++) {
      // 둔화를 늘 최대로 쥐여 줘, 면역이 없으면 다음 한 대에 곧바로 다시 얼게 만든다.
      if (target.frozen === null) target.chill = { stacks: 3, speedPercentPerStack: 5, maxStacks: 3 };
      stepSkirmish(state, dt, rng);
      const frozen = target.frozen !== null;
      if (frozen) frozenTime += dt;
      if (frozen && !wasFrozen) {
        freezes++;
        if (thawedAt !== null) expect(state.elapsed - thawedAt).toBeGreaterThanOrEqual(FROZEN.immunitySeconds - dt * 2);
      }
      if (!frozen && wasFrozen) thawedAt = state.elapsed;
      wasFrozen = frozen;
    }
    expect(freezes).toBeGreaterThan(1);
    expect(frozenTime / 60).toBeLessThanOrEqual(0.52);
  });
});
