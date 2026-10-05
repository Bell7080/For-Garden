import { describe, expect, it } from "vitest";
import { nextStrataCrystalAt, siteCooldownMs, strataCrystalStage, strataRunModifiers } from "../../src/core/strataCrystal";
import { ARCHAEOLOGY_SITES, findArchaeologySite } from "../../src/data/archaeologySites";

const HOUR = 3_600_000;
const NOW = new Date("2026-03-10T00:00:00.000Z");
const ago = (hours: number): string => new Date(NOW.getTime() - hours * HOUR).toISOString();

describe("고고학 결정과 재탐사 대기", () => {
  it("높은 유적일수록 재탐사까지 길고 가장 깊은 곳은 72시간이다", () => {
    const hours = ARCHAEOLOGY_SITES.map((site) => site.cooldownHours);
    expect(Math.min(...hours)).toBe(6);
    expect(Math.max(...hours)).toBe(72);
    const ordered = [...ARCHAEOLOGY_SITES].sort((a, b) => a.minimumLevel - b.minimumLevel).map((site) => site.cooldownHours);
    expect(ordered).toEqual([...ordered].sort((a, b) => a - b));
    expect(siteCooldownMs(findArchaeologySite("first-seed")!)).toBe(72 * HOUR);
  });

  it("저레벨 유적은 방치한 시간에 따라 결정이 맺히고 굴착이 +1/+2 늘어난다", () => {
    const gate = findArchaeologySite("garden-gate")!;
    expect(strataCrystalStage(gate, ago(10), NOW)).toBe(0);
    expect(strataCrystalStage(gate, ago(24), NOW)).toBe(1);
    expect(strataCrystalStage(gate, ago(72), NOW)).toBe(2);
    expect(strataRunModifiers(gate, 1).digs).toBe(1);
    expect(strataRunModifiers(gate, 2).digs).toBe(2);
    expect(nextStrataCrystalAt(gate, ago(10), NOW)).toBe(new Date(NOW.getTime() + 14 * HOUR).toISOString());
    expect(nextStrataCrystalAt(gate, ago(80), NOW)).toBeNull();
  });

  it("방치 보너스는 원석에 크게, 골드에는 제곱근으로만 얹힌다", () => {
    const gate = findArchaeologySite("garden-gate")!;
    const ripe = strataRunModifiers(gate, 2);
    expect(ripe.stoneYield).toBeGreaterThan(ripe.goldYield);
    expect(ripe.goldYield).toBeCloseTo(Math.sqrt(ripe.stoneYield), 5);
  });

  it("결정이 없는 고레벨 유적은 가까운 보정 없이 유적 배율만 쓴다", () => {
    const seed = findArchaeologySite("first-seed")!;
    expect(strataCrystalStage(seed, ago(500), NOW)).toBe(0);
    expect(strataRunModifiers(seed, 0).digs).toBe(0);
  });
});
