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
  it("은 쿠로의 공격과 속도가 공격력만, 몸은 공격력과 주문력을 함께 따른다", () => {
    const kuro = dianSummon("kuro");
    const base = deriveSummonStats(FINAL_STATS, kuro);
    const moreAp = deriveSummonStats({ ...FINAL_STATS, ap: 300 }, kuro);
    // 주문력을 키워도 때리는 손과 속도는 그대로다.
    expect(moreAp.atk).toBe(base.atk);
    expect(moreAp.attackSpeed).toBe(base.attackSpeed);
    expect(moreAp.ap).toBe(0);
    // 몸은 두꺼워진다 — 주인이 어느 축을 키워도 앞에 선 방패가 같이 자란다.
    expect(moreAp.hp).toBeGreaterThan(base.hp);
    expect(moreAp.def).toBeGreaterThan(base.def);
    expect(moreAp.res).toBeGreaterThan(base.res);
  });

  it("은 시로의 공격과 속도가 주문력만, 몸은 공격력과 주문력을 함께 따른다", () => {
    const shiro = dianSummon("shiro");
    const base = deriveSummonStats(FINAL_STATS, shiro);
    const moreAtk = deriveSummonStats({ ...FINAL_STATS, atk: 400 }, shiro);
    expect(moreAtk.ap).toBe(base.ap);
    expect(moreAtk.attackSpeed).toBe(base.attackSpeed);
    expect(moreAtk.atk).toBe(0);
    expect(moreAtk.hp).toBeGreaterThan(base.hp);
    expect(moreAtk.def).toBeGreaterThan(base.def);
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

  it("은 반올림 뒤 공속·이속 상한을 적용하고 입력을 변경하지 않는다", () => {
    const kuro = dianSummon("kuro");
    const owner = { ...FINAL_STATS, atk: 10_000 };
    const snapshot = structuredClone(owner);
    const result = deriveSummonStats(owner, kuro);
    expect(result.attackSpeed).toBe(kuro.scaling.attackSpeedCap);
    expect(result.moveSpeed).toBe(kuro.scaling.moveSpeedCap);
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
