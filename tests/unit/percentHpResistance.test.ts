import { describe, expect, it } from "vitest";
import { ENCOUNTER_ROLE } from "../../src/core/levelDesign";
import { percentHpDamage } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

/**
 * 최대 체력 비례 피해(출혈·뇌진탕·빙결 해제)의 한계 — 압도적인 체력으로 서는 자리(보스·불사)는 그 비율
 * 피해만 덜 받는다(`EncounterRoleSpec.percentHpResistance`). 받는 피해 전체를 깎는 경감이 아니다.
 */
describe("최대 체력 비례 피해 저항", () => {
  const base = getRelic("toby");
  const body = { maxHp: 100_000, def: base };

  it("자리가 없는 개체와 잡졸·정예는 비율 그대로 받는다", () => {
    expect(percentHpDamage(body, 2)).toBe(2_000);
    for (const role of ["normal", "swarm", "elite"] as const) {
      expect(percentHpDamage({ ...body, def: { ...base, encounterRole: role } }, 2)).toBe(2_000);
    }
  });

  it("보스·불사는 제 자리의 저항만큼 덜 받는다", () => {
    for (const role of ["boss", "endless"] as const) {
      const resistance = ENCOUNTER_ROLE[role].percentHpResistance ?? 0;
      expect(resistance).toBeGreaterThan(0);
      expect(resistance).toBeLessThan(100);
      expect(percentHpDamage({ ...body, def: { ...base, encounterRole: role } }, 2)).toBe(Math.round(2_000 * (1 - resistance / 100)));
    }
  });

  it("공유 체력 보스는 성장 체력(percentHpBasis)에서 재고 그 위에 저항을 얹는다", () => {
    const boss = { maxHp: 10_000_000, percentHpBasis: 5_000, def: { ...base, encounterRole: "boss" as const } };
    expect(percentHpDamage(boss, 2)).toBe(Math.round(100 * (1 - (ENCOUNTER_ROLE.boss.percentHpResistance ?? 0) / 100)));
  });
});
