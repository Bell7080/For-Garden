import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { getRelic } from "../../src/data/relics";

/** 이카닉시아는 중거리 마법사다 — 박쥐 떼가 주위를 매초 훑고, 회복은 가까운 셋이 입은 피해에서만 센다. */
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };

function setup(enemyIds: readonly string[]) {
  const state = createSkirmish([getRelic("ikanixia")], enemyIds.map((id) => getRelic(id)), ARENA);
  const boss = state.fighters.find((f) => f.def.id === "ikanixia")!;
  const foes = state.fighters.filter((f) => f.side !== boss.side);
  foes.forEach((f, i) => { f.x = boss.x + 60 + i * 20; f.y = boss.y; });
  for (const f of state.fighters) { f.attackCooldown = Number.POSITIVE_INFINITY; f.retargetIn = Number.POSITIVE_INFINITY; }
  return { state, boss, foes };
}

describe("이카닉시아 박쥐 떼", () => {
  it("직군은 전사 그대로이고 중거리 주문력 딜러다", () => {
    const def = getRelic("ikanixia");
    expect(def.reachTier).toBe("mid");
    expect(def.stats.ap).toBeGreaterThan(def.stats.atk * 4);
    expect(def.basic.targeting).toBe("splitShot");
    expect(def.ultimate.channel?.seconds).toBe(5);
  });

  it("범위 안의 모든 적이 매초 피해를 입고 회복은 가까운 셋까지만 센다", () => {
    const { state, boss, foes } = setup(["amo", "toby", "ripa", "amo"]);
    boss.hp = boss.maxHp * 0.5;
    const before = boss.hp;
    for (let t = 0; t < 1.1; t += 0.05) stepSkirmish(state, 0.05);
    expect(foes.every((f) => f.hp < f.maxHp)).toBe(true);
    expect(boss.hp).toBeGreaterThan(before);
    const plan = getRelic("ikanixia").passive.batSwarm!;
    const nearest = [...foes].sort((a, b) => Math.hypot(a.x - boss.x, a.y - boss.y) - Math.hypot(b.x - boss.x, b.y - boss.y)).slice(0, plan.healTargets);
    const dealt = nearest.reduce((sum, f) => sum + (f.maxHp - f.hp), 0);
    expect(boss.hp - before).toBeLessThanOrEqual(dealt * plan.healPercent / 100 + 1e-6);
  });

  it("범위 밖의 적은 맞지 않고 폭주는 범위를 넓힌다", () => {
    const { state, boss, foes } = setup(["amo"]);
    foes[0].x = boss.x + 400; // 걸어 들어오는 1초 동안에도 240 밖(약 300)에 남는다
    for (let t = 0; t < 1.1; t += 0.05) stepSkirmish(state, 0.05);
    expect(foes[0].hp).toBe(foes[0].maxHp);
    boss.ferocityFever = true;
    boss.batSwarmIn = 0;
    for (let t = 0; t < 0.1; t += 0.05) stepSkirmish(state, 0.05);
    expect(foes[0].hp).toBeLessThan(foes[0].maxHp);
  });
});
