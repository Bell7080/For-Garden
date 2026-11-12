import { describe, expect, it } from "vitest";
import { activeBreakthrough, activeBreakthroughOf, BREAKTHROUGH_CAP, BREAKTHROUGH_STEPS, calculateFinalStats } from "../../src/core/relicProgression";
import type { RelicProgress, Stats } from "../../src/core/types";

const BASE = { hp: 1000, def: 100, res: 100, atk: 100, magic: 100, atkSpd: 1, moveSpd: 100, crit: 5, critDmg: 150, lifesteal: 0, ferocityGain: 100, ultimateGain: 100 } as unknown as Stats;
const progress = (level: number, breakthrough: number, resonance = 0): RelicProgress => ({ level, exp: 0, breakthrough, resonance, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] } as RelicProgress);

// 레벨 초기화로 내려간 렐릭의 한계 돌파는 지워지지 않고 꺼진다 — 요구 레벨에 다시 닿으면 저절로 켜진다.
describe("레벨에 맞춰 꺼지는 한계 돌파", () => {
  it("요구 레벨을 채운 단계까지만 켜진다", () => {
    expect(activeBreakthrough(1, BREAKTHROUGH_CAP)).toBe(0);
    BREAKTHROUGH_STEPS.forEach((step, index) => {
      expect(activeBreakthrough(step.requiredLevel, BREAKTHROUGH_CAP)).toBe(index + 1);
      expect(activeBreakthrough(step.requiredLevel - 1, BREAKTHROUGH_CAP)).toBe(index);
    });
    expect(activeBreakthrough(100, 2)).toBe(2);
    expect(activeBreakthroughOf(undefined)).toBe(0);
  });

  it("꺼진 돌파는 능력치에도 공명에도 들지 않고, 레벨이 돌아오면 다시 든다", () => {
    const fresh = calculateFinalStats(BASE, progress(1, 0), [], "SR");
    const reset = calculateFinalStats(BASE, progress(1, BREAKTHROUGH_CAP, 5), [], "SR");
    expect(reset).toEqual(fresh);
    const top = BREAKTHROUGH_STEPS[BREAKTHROUGH_STEPS.length - 1].requiredLevel;
    const regrown = calculateFinalStats(BASE, progress(top, BREAKTHROUGH_CAP, 5), [], "SR");
    const unbroken = calculateFinalStats(BASE, progress(top, 0), [], "SR");
    expect(regrown.hp).toBeGreaterThan(unbroken.hp);
    const noResonance = calculateFinalStats(BASE, progress(top, BREAKTHROUGH_CAP, 5), [], "SR", { resonance: false });
    expect(regrown.hp).toBeGreaterThan(noResonance.hp);
  });
});
