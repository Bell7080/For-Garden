import { describe, expect, it } from "vitest";
import { deriveSummonStats, summonInstanceId } from "../../src/core/summonStats";
import type { Stats } from "../../src/core/types";
import { getRelic } from "../../src/data/relics";

/** 계수 테스트가 디안의 현재 밸런스 값에 우연히 의존하지 않도록 만든 완전한 최종 능력치다. */
const FINAL_STATS: Stats = {
  hp: 1800, def: 90, res: 92, atk: 200, ap: 150, attackSpeed: 140, moveSpeed: 144,
  critChance: 10, critDamage: 150, energyGain: 26, lifeSteal: 0, ferocityGain: 0,
};

/** 정적 정의에서 누락된 소환수를 즉시 드러내는 테스트 전용 조회 도우미다. */
function dianSummon(id: "kuro" | "shiro") {
  const summon = getRelic("dian").summons?.find((entry) => entry.def.id === id);
  if (!summon) throw new Error(`디안 소환수 ${id} 정의가 없습니다.`);
  return summon;
}

describe("디안 귀속 소환수 능력치", () => {
  it("은 쿠로의 공격력·체력·방어·저항이 디안 공격력만 따르고 주문력은 건드리지 않는다", () => {
    const kuro = dianSummon("kuro");
    const base = deriveSummonStats(FINAL_STATS, kuro);
    const moreAtk = deriveSummonStats({ ...FINAL_STATS, atk: 260 }, kuro);
    for (const key of ["atk", "hp", "def", "res"] as const) expect(moreAtk[key], key).toBeGreaterThan(base[key]);
    // 주문력 변화는 쿠로의 어떤 능력치에도 닿지 않는다.
    expect(deriveSummonStats({ ...FINAL_STATS, ap: 9999 }, kuro)).toEqual(base);
    expect(base.ap).toBe(0);
  });

  it("은 시로의 주문력·체력·방어·저항이 디안 주문력만 따르고 공격력은 건드리지 않는다", () => {
    const shiro = dianSummon("shiro");
    const base = deriveSummonStats(FINAL_STATS, shiro);
    const moreAp = deriveSummonStats({ ...FINAL_STATS, ap: 210 }, shiro);
    for (const key of ["ap", "hp", "def", "res"] as const) expect(moreAp[key], key).toBeGreaterThan(base[key]);
    expect(deriveSummonStats({ ...FINAL_STATS, atk: 9999 }, shiro)).toEqual(base);
    expect(base.atk).toBe(0);
  });

  it("은 디안의 태생값에서 정의의 태생 능력치를 그대로 낸다", () => {
    const dian = getRelic("dian");
    for (const id of ["kuro", "shiro"] as const) {
      const summon = dianSummon(id);
      const derived = deriveSummonStats(dian.stats, summon);
      for (const key of ["hp", "def", "res", "atk", "ap"] as const) {
        expect(Math.abs(derived[key] - summon.def.stats[key]), `${id}.${key}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("은 공격 속도·이동 속도를 올리지 않고 늑대 정의의 값을 그대로 쓰며 입력을 변경하지 않는다", () => {
    const kuro = dianSummon("kuro");
    const owner = { ...FINAL_STATS, atk: 10_000, attackSpeed: 300, moveSpeed: 300 };
    const snapshot = structuredClone(owner);
    const result = deriveSummonStats(owner, kuro);
    expect(result.attackSpeed).toBe(kuro.def.stats.attackSpeed);
    expect(result.moveSpeed).toBe(kuro.def.stats.moveSpeed);
    expect(owner).toEqual(snapshot);
    expect(result).not.toBe(owner);
  });


  it("은 양 진영의 쌍둥이 소환 ID를 각각 유일하게 만든다", () => {
    const ids = (["player", "enemy"] as const).flatMap((side) =>
      dianSummon("kuro") && ["kuro", "shiro"].map((summonId) => summonInstanceId(side, 0, summonId)),
    );
    expect(new Set(ids).size).toBe(4);
    expect(ids).toContain("player:0:summon:kuro");
    expect(ids).toContain("enemy:0:summon:kuro");
  });
});
