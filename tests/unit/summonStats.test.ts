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
  const summon = getRelic("dian").summons?.find((entry) => entry.id === id);
  if (!summon) throw new Error(`디안 소환수 ${id} 정의가 없습니다.`);
  return summon;
}

describe("디안 귀속 소환수 능력치", () => {
  it("은 쿠로가 최종 공격력 성장만 따른다", () => {
    const kuro = dianSummon("kuro");
    const grown = deriveSummonStats({ ...FINAL_STATS, atk: 260 }, kuro);
    expect(grown.atk).toBeGreaterThan(deriveSummonStats(FINAL_STATS, kuro).atk);
    // 주문력 변화는 쿠로의 모든 파생 능력치에 영향을 주지 않는다.
    expect(deriveSummonStats({ ...FINAL_STATS, ap: 9999 }, kuro)).toEqual(deriveSummonStats(FINAL_STATS, kuro));
  });

  it("은 시로가 최종 주문력 성장만 따른다", () => {
    const shiro = dianSummon("shiro");
    const grown = deriveSummonStats({ ...FINAL_STATS, ap: 210 }, shiro);
    expect(grown.ap).toBeGreaterThan(deriveSummonStats(FINAL_STATS, shiro).ap);
    // 공격력 변화는 시로의 모든 파생 능력치에 영향을 주지 않는다.
    expect(deriveSummonStats({ ...FINAL_STATS, atk: 9999 }, shiro)).toEqual(deriveSummonStats(FINAL_STATS, shiro));
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
