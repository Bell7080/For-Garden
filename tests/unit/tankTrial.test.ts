import { describe, expect, it } from "vitest";
import { createSkirmish, encounterHealingReductionPercent, fireUltimate, stepSkirmish, type Arena } from "../../src/core/skirmish";
import { ENCOUNTER_ROLE } from "../../src/core/levelDesign";
import { summarizeStageDifficulty } from "../../src/core/stageDifficulty";
import { CHAPTERS, getStageEnemies } from "../../src/data/stages";
import { getRelic } from "../../src/data/relics";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import type { RelicDef } from "../../src/core/types";

const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const PARTIES: readonly (readonly string[])[] = [
  ["mosana", "kento", "anka"], ["mosana", "nodonia", "anka"], ["kento", "nodonia", "anka"],
  ["torika", "dodo", "parua"], ["ella", "maki", "stella"],
];
const party = (ids: readonly string[], level: number): RelicDef[] => ids.map((id) => {
  const def = getRelic(id); return { ...def, stats: applyLevelGrowth(def.stats, level, def.rarity) };
});
const ARENA: Arena = { left: 0, right: 1_000, top: 0, bottom: 1_200 };

describe("탱커 시험장 — 규칙", () => {
  it("모사나의 궁극기 막은 도발이 끝날 즈음 다 사라진다", () => {
    const state = createSkirmish([getRelic("mosana")], [getRelic("amo")], ARENA);
    const [mosana, enemy] = state.fighters;
    for (const f of state.fighters) f.attackCooldown = Number.POSITIVE_INFINITY;
    mosana.x = 500; mosana.y = 900; enemy.x = 500; enemy.y = 700;
    mosana.energy = 1_000;
    fireUltimate(state, mosana.id, () => 0.99);
    const first = mosana.shield.amount;
    expect(first).toBeGreaterThan(0);
    for (let i = 0; i < 50; i += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(mosana.shield.amount).toBeLessThan(first * 0.6);
    expect(mosana.shield.amount).toBeGreaterThan(0);
    // 5초가 지나면 이 궁극기의 막은 남지 않는다(조가비 같은 다른 막은 이 시계와 상관없다).
    for (let i = 0; i < 50; i += 1) stepSkirmish(state, 0.05, () => 0.99);
    expect(mosana.shieldFade).toBeNull();
  });

  it("코마의 궁극기는 맞은 적의 보호막을 피해가 박히기 전에 깬다", () => {
    const state = createSkirmish([getRelic("mosana")], [getRelic("koma")], ARENA);
    const [mosana, koma] = state.fighters;
    for (const f of state.fighters) f.attackCooldown = Number.POSITIVE_INFINITY;
    mosana.x = 500; mosana.y = 700; koma.x = 500; koma.y = 900;
    mosana.shield.amount = 1_000_000; mosana.shield.providerId = mosana.id;
    koma.energy = 1_000;
    const hpBefore = mosana.hp;
    fireUltimate(state, koma.id, () => 0.99);
    expect(mosana.shield.amount).toBe(0);
    // 막이 먹었다면 체력은 그대로였을 것이다 — 막이 깨진 뒤에 피해가 들어간다.
    expect(mosana.hp).toBeLessThan(hpBefore);
  });

  it("정예의 치유 감소는 싸움이 길어질수록 오른다", () => {
    const state = createSkirmish([getRelic("ella")], [{ ...getRelic("koma"), encounterRole: "elite" }], ARENA);
    const plan = ENCOUNTER_ROLE.elite.healingReduction!;
    expect(encounterHealingReductionPercent(state, "player")).toBe(plan.basePercent);
    state.elapsed = plan.rampSeconds;
    expect(encounterHealingReductionPercent(state, "player")).toBe(plan.maxPercent);
    // 정예 자신의 편은 깎이지 않는다.
    expect(encounterHealingReductionPercent(state, "enemy")).toBe(0);
  });
});

describe.skipIf(!process.env.TRIAL_REPORT)("탱커 시험장 — 실측 표", () => {
  it("report", () => {
    const only = (process.env.TRIAL_STAGES ?? "").split(",").filter(Boolean);
    const stages = CHAPTERS[0].stages.filter((s) => s.kind === "battle" && (only.length === 0 || only.includes(s.id)));
    for (const level of (process.env.TRIAL_LEVELS ?? "1,10,20").split(",").map(Number)) {
      for (const ids of PARTIES) {
        const row = stages.map((st) => {
          const r = summarizeStageDifficulty(party(ids, level), [...getStageEnemies(st as never)], SEEDS, "auto");
          return `${st.id}:${Math.round(r.winRate * 100)}%/${r.playerHpRatio.mean.toFixed(2)}`;
        });
        console.log(`LV${level} ${ids.join("/")}  ${row.join(" ")}`);
      }
    }
  }, 600_000);
});
