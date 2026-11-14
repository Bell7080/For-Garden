import { describe, expect, it } from "vitest";
import { activeBreakthroughOf, BREAKTHROUGH_CAP, BREAKTHROUGH_STEPS, calculateFinalStats } from "../../src/core/relicProgression";
import type { RelicProgress, Stats } from "../../src/core/types";

const BASE = { hp: 1000, def: 100, res: 100, atk: 100, magic: 100, atkSpd: 1, moveSpd: 100, crit: 5, critDmg: 150, lifesteal: 0, ferocityGain: 100, ultimateGain: 100 } as unknown as Stats;
const progress = (level: number, breakthrough: number, resonance = 0): RelicProgress => ({ level, exp: 0, breakthrough, resonance, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] } as RelicProgress);

// 한계 돌파는 파편만 든다(응태 결정 2026-11-15) — 레벨과 무관하게 늘 켜져 있어 레벨 초기화가 돌파를 끄지 않는다.
describe("레벨과 무관한 한계 돌파", () => {
  it("돌파 단계는 레벨을 묻지 않고 저장 값 그대로 켜진다", () => {
    for (let breakthrough = 0; breakthrough <= BREAKTHROUGH_CAP; breakthrough += 1) {
      expect(activeBreakthroughOf(progress(1, breakthrough))).toBe(breakthrough);
    }
    expect(activeBreakthroughOf(undefined)).toBe(0);
    expect(activeBreakthroughOf(progress(1, 99))).toBe(BREAKTHROUGH_CAP);
    expect(BREAKTHROUGH_STEPS.every((step) => Object.keys(step).join() === "slot")).toBe(true);
  });

  it("레벨 1로 초기화해도 돌파·공명 몫은 능력치에 그대로 든다", () => {
    const fresh = calculateFinalStats(BASE, progress(1, 0), [], "SR");
    const reset = calculateFinalStats(BASE, progress(1, BREAKTHROUGH_CAP, 5), [], "SR");
    expect(reset.hp).toBeGreaterThan(fresh.hp);
    const noResonance = calculateFinalStats(BASE, progress(1, BREAKTHROUGH_CAP, 5), [], "SR", { resonance: false });
    expect(reset.hp).toBeGreaterThan(noResonance.hp);
  });
});
