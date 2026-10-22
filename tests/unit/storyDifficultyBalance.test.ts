import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, canFireUltimate, fireUltimate } from "../../src/core/skirmish";
import { RUNE_GENERATION_RULES } from "../../src/core/runes";
import { applyLevelGrowth } from "../../src/core/relicProgression";
import { battleArena } from "../../src/core/battleArena";
import { getRelic } from "../../src/data/relics";
import { getBattleStage, getStageEnemies, stageEnemyGrowth } from "../../src/data/stages";

function battle(ids: readonly string[], level: number, stageId: string, seed: number) {
  const players = ids.map(id => { const def = getRelic(id); const stats = applyLevelGrowth(def.stats, level, def.rarity);
    const rune = RUNE_GENERATION_RULES.legendary;
    const gear = 1 + 3 * (rune.mainBase + 3 * rune.mainEnhancement) / 100;
    for (const key of ["hp", "atk", "def"] as const) stats[key] = Math.round(stats[key] * gear);
    return { ...def, stats }; });
  const stage = getBattleStage(stageId);
  const state = createSkirmish(players, getStageEnemies(stage), battleArena("stage"), {}, Object.fromEntries(ids.map(id => [id, 5])), { enemyBreakthroughs: stageEnemyGrowth(stage).map(enemy => enemy.breakthrough) });
  let rng = seed;
  const random = () => { rng = (rng * 1664525 + 1013904223) >>> 0; return rng / 4294967296; };
  while (state.phase === "fight" && state.elapsed < 120) {
    stepSkirmish(state, 1 / 30, random);
    for (const fighter of state.fighters.filter(f => f.side === "player")) if (canFireUltimate(state, fighter)) fireUltimate(state, fighter.id, random);
  }
  return { win: state.phase === "victory", seconds: state.elapsed, hp: state.fighters.filter(f => f.side === "player" && ids.includes(f.def.id)).reduce((sum, f) => sum + Math.max(0, f.hp) / f.maxHp, 0) / 3 };
}

describe("스토리 난이도 실전 곡선", () => {
  it("같은 파티·장비에서 보통과 어려움의 체력이탈·전투 시간이 쉬움과 구별된다", () => {
    const results: { party: string; stage: string; wins: number; seconds: number; hp: number }[] = [];
    for (const ids of [["torika", "rex", "luka"], ["ella", "maki", "stella"], ["nodonia", "spino", "mette"], ["torika", "dian", "luka"], ["ella", "dian", "stella"]]) {
      for (const stage of ["1-10", "normal:1-10", "normal:4-10", "hard:1-10", "hard:4-10"]) {
        const runs = [1, 2, 3].map(seed => battle(ids, 60, stage, seed));
        results.push({ party: ids.join("/"), stage, wins: runs.filter(r => r.win).length, seconds: Math.round(runs.reduce((sum, r) => sum + r.seconds, 0) / runs.length * 10) / 10, hp: Math.round(runs.reduce((sum, r) => sum + r.hp, 0) / runs.length * 100) / 100 });
      }
    }
    console.table(results);
    const normalFinal = results.filter(row => row.stage === "normal:4-10");
    const hardFinal = results.filter(row => row.stage === "hard:4-10");
    expect(hardFinal.some(row => row.wins > 0), "최종 어려움도 합법적인 성장·장비로 완주할 수 있어야 한다").toBe(true);
    expect(hardFinal.reduce((sum, row) => sum + row.wins, 0)).toBeLessThan(normalFinal.reduce((sum, row) => sum + row.wins, 0));
    expect(hardFinal.reduce((sum, row) => sum + row.hp, 0)).toBeLessThan(normalFinal.reduce((sum, row) => sum + row.hp, 0));
    for (const ids of [["torika", "rex", "luka"], ["ella", "maki", "stella"], ["nodonia", "spino", "mette"], ["torika", "dian", "luka"], ["ella", "dian", "stella"]]) {
      const rows = results.filter(row => row.party === ids.join("/"));
      expect(rows[1].seconds > rows[0].seconds || rows[1].hp < rows[0].hp || rows[1].wins < rows[0].wins).toBe(true);

    }
  });
});
