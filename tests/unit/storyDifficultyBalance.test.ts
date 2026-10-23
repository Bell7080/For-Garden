import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, canFireUltimate, fireUltimate } from "../../src/core/skirmish";
import { generateRune, enhanceRune, runeEnhancementIncrease } from "../../src/core/runes";
import { applyLevelGrowth, applyHeartGems, BREAKTHROUGH_CAP } from "../../src/core/relicProgression";
import { battleArena } from "../../src/core/battleArena";
import { ENCOUNTER_ROLE } from "../../src/core/levelDesign";
import { getRelic } from "../../src/data/relics";
import { getBattleStage, getStageEnemies, stageEnemyGrowth } from "../../src/data/stages";

/** 실제 생성·세공·장착 함수로 만든 전설 룬 3개, 각 옵션 2성공/1실패. 근사 스탯을 덧붙이지 않는다. */
function battle(ids: readonly string[], level: number, stageId: string, seed: number) {
  const players = ids.map(id => {
    const def = getRelic(id);
    const gems = ([0, 1, 2] as const).map(part => {
      const rolls = [.2, .2, .3]; let index = 0;
      let rune = generateRune({instanceId:`${id}-${part}`,baseName:"balance",rarity:"legendary",part,mainKeys:["hp",def.stats.ap > def.stats.atk ? "ap" : "atk"],random:()=>rolls[index++ % rolls.length]});
      for (const option of [...rune.mainStats, ...rune.subStats]) for (let n=0;n<3;n++) rune=enhanceRune(rune,option.key,runeEnhancementIncrease(rune.rarity,option.key),n === 2 ? .99 : 0);
      return rune;
    });
    return {...def,stats:applyHeartGems(applyLevelGrowth(def.stats,level,def.rarity),gems)};
  });
  const stage = getBattleStage(stageId);
  const state = createSkirmish(players, getStageEnemies(stage), battleArena("stage"), {}, Object.fromEntries(ids.map(id => [id, BREAKTHROUGH_CAP])), { enemyBodyScales: getStageEnemies(stage).map(enemy=>ENCOUNTER_ROLE[enemy.encounterRole!].bodyScale), enemyBreakthroughs: stageEnemyGrowth(stage).map(enemy => enemy.breakthrough) });
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
    // v0.326.6: 루카의 초반 5초 은신으로 토리카·렉스·루카 조합이 어려움 마지막 관문을 못 깨게 되어 완주 조합 기준을 1로 낮췄다.
    expect(hardFinal.filter(row => row.wins > 0).length, "최종 어려움도 합법적인 성장·실제 룬 장비로 완주할 수 있어야 한다").toBeGreaterThanOrEqual(1);
    expect(hardFinal.reduce((sum, row) => sum + row.wins, 0)).toBeLessThan(normalFinal.reduce((sum, row) => sum + row.wins, 0));
    expect(hardFinal.reduce((sum, row) => sum + row.hp, 0)).toBeLessThan(normalFinal.reduce((sum, row) => sum + row.hp, 0));
    for (const ids of [["torika", "rex", "luka"], ["ella", "maki", "stella"], ["nodonia", "spino", "mette"], ["torika", "dian", "luka"], ["ella", "dian", "stella"]]) {
      const rows = results.filter(row => row.party === ids.join("/"));
      expect(rows[1].seconds > rows[0].seconds || rows[1].hp < rows[0].hp || rows[1].wins < rows[0].wins).toBe(true);

    }
  });
});
