import { describe, expect, it } from "vitest";
import { BOSS_STEP_MS, bossBattleRandom } from "../../src/core/bossSimulation";
import { battleArena } from "../../src/core/battleArena";
import { createExpeditionBossSkirmishConfig, createRaidSkirmishConfig } from "../../src/core/expeditionBattle";
import { resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { raidBossDef, raidBossGrowth, raidBossPercentHpBasis, raidSeasonProgress } from "../../src/core/raid";
import { canFireUltimate, createSkirmish, fireUltimate, stepSkirmish, replayLoggedBossAction, type SkirmishState } from "../../src/core/skirmish";
import { RAID_BOSS_BALANCE, RAID_BOSS_POOL } from "../../src/data/raid";
import { expeditionBossGrowth, getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { getRelic } from "../../src/data/relics";

const parties = [["dian", "spino", "stella"], ["torika", "dodo", "parua"], ["rex", "luka", "torika"], ["rex", "mette", "torika"], ["morphe", "ella", "maddy"], ["deina", "quetzalcoatlus", "taboa"]];
function fight(state: SkirmishState, identity: string, auto: boolean, speed: number) {
  const random = bossBattleRandom(identity); const actions: ExpeditionBossAction[] = [];
  let remainder = 0; let frame = 0;
  while (state.phase === "fight" && frame++ < 20000) {
    // Deliberately mix long/short rendered frames, at 1x and 3x. Controls occur between full ticks.
    remainder += (frame % 13 === 0 ? 200 : 17) * speed;
    while (remainder >= BOSS_STEP_MS && state.phase === "fight") {
      stepSkirmish(state, BOSS_STEP_MS / 1000, random); remainder -= BOSS_STEP_MS;
    }
    if (auto) for (const fighter of state.fighters) {
      if (fighter.side !== "player" || fighter.summonOwnerId !== null || !canFireUltimate(state, fighter)) continue;
      const elapsedMs = Math.round(state.elapsed * 1000); const before = fighter.energy;
      const events = fireUltimate(state, fighter.id, random);
      if (events.length || fighter.energy < before) actions.push({ elapsedMs, actorId: fighter.def.id, kind: "ultimate" });
    }
  }
  expect(state.phase).not.toBe("fight");
  return actions;
}

describe("보스 화면과 확정 재현의 점수·시간·생존 일치", () => {
  for (const party of parties) for (const bossId of RAID_BOSS_POOL) for (const difficulty of ["easy", "normal", "hard", "rampage"] as const) for (const speed of [1, 3]) {
    it(`raid ${party.join('/')} / ${bossId} / ${difficulty} / ${speed}x`, () => {
      const players = party.map(getRelic); const base = getRelic(bossId);
      const boss = raidBossDef(base, difficulty); const basis = raidBossPercentHpBasis(base, difficulty);
      const seasonHp = 150000; const identity = `${party}:${bossId}:${speed}`;
      const config = createRaidSkirmishConfig(players, boss, basis, seasonHp);
      const state = createSkirmish(players, [boss], battleArena("raid"), {}, {}, { ...config, boss: config.boss, enemyBreakthroughs: [raidBossGrowth(difficulty).breakthrough] });
      const actions = fight(state, identity, true, speed);
      const replay = resolveExpeditionBossBattle({ allies: players, boss, arena: battleArena("raid"), balance: RAID_BOSS_BALANCE, bossKillable: true, seasonHp, percentHpBasis: basis, bossBreakthrough: raidBossGrowth(difficulty).breakthrough, replayIdentity: identity }, actions);
      expect(replay.totalDamage).toBe(Math.round(state.boss!.score));
      expect(replay.endedAtMs).toBe(Math.round(state.elapsed * 1000));
      expect(replay.bossDefeated).toBe(state.phase === "victory");
      expect(state.boss!.score).toBeLessThanOrEqual(seasonHp);
      expect(state.fighters.find(({ id }) => id === "enemy-0")!.hp).toBe(seasonHp - state.boss!.score);
    });
  }
  for (const party of parties) for (const speed of [1, 3]) for (const auto of [true, false]) {
    it(`expedition ${party.join('/')} / ${speed}x / auto=${auto}`, () => {
      const players = party.map(getRelic); const boss = getExpeditionNodeEnemies("boss", 20)[0]; const identity = `${party}:${speed}:${auto}`;
      const config = createExpeditionBossSkirmishConfig({ mode: "expeditionBoss", runId: "run", nodeId: "boss", floor: 20, relics: players.map(({ id }) => ({ relicId: id, currentHp: 60, alive: true })), augments: [], requestId: "score", settlementId: "settle" }, players, [boss]);
      const state = createSkirmish(players, [boss], battleArena("expeditionBoss"), {}, {}, { ...config, enemyBreakthroughs: [expeditionBossGrowth().breakthrough] });
      const actions = fight(state, identity, auto, speed);
      const replay = resolveExpeditionBossBattle({ allies: players, boss, initialHpPercentByRelic: Object.fromEntries(players.map(({ id }) => [id, 60])), arena: battleArena("expeditionBoss"), bossBreakthrough: expeditionBossGrowth().breakthrough, replayIdentity: identity }, actions);
      expect(replay.totalDamage).toBe(Math.round(state.boss!.score));
      expect(replay.endedAtMs).toBe(Math.round(state.elapsed * 1000));
      expect(replay.remainingHpByAlly).toEqual(Object.fromEntries(state.fighters.filter(({ side }) => side === "player").map(({ def, hp }) => [def.id, hp])));
    });
  }
  for (const stopAtMs of [0, 1000, 10000, 30000]) for (const mode of ["raid", "expeditionBoss"] as const) {
    it(`${mode}: 자발적 종료 ${stopAtMs}ms는 그 틱의 피해만 저장하고 살아 있는 편성을 전멸로 바꾸지 않는다`, () => {
      const players = ["rex", "mette", "torika"].map(getRelic), identity = "partial-fight";
      const base = getRelic("sukusuino"), raid = mode === "raid";
      const boss = raid ? raidBossDef(base, "easy") : getExpeditionNodeEnemies("boss", 20)[0];
      const config = raid ? createRaidSkirmishConfig(players, boss, raidBossPercentHpBasis(base, "easy"), 150000)
        : createExpeditionBossSkirmishConfig({ mode: "expeditionBoss", runId: "run", nodeId: "boss", floor: 20, relics: players.map(({id}) => ({relicId:id,currentHp:100,alive:true})), augments: [], requestId:"score",settlementId:"settle" }, players, [boss]);
      const bossBreakthrough = raid ? raidBossGrowth("easy").breakthrough : expeditionBossGrowth().breakthrough;
      const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena(mode), {}, {}, { ...config, enemyBreakthroughs: [bossBreakthrough] });
      const random = bossBattleRandom(identity);
      while (state.phase === "fight" && Math.round(state.elapsed * 1000) < stopAtMs) stepSkirmish(state, .02, random);
      const input = { allies: players, boss, arena: battleArena(mode), replayIdentity: identity, bossBreakthrough,
        ...(raid ? { balance: RAID_BOSS_BALANCE, bossKillable: true, seasonHp:150000, percentHpBasis:raidBossPercentHpBasis(base,"easy") } : {}) };
      const replay = resolveExpeditionBossBattle({ ...input, stopAtMs }, []);
      expect(replay.totalDamage).toBe(Math.round(state.boss!.score));
      expect(replay.endedAtMs).toBe(Math.round(state.elapsed * 1000));
      expect(replay.remainingHpByAlly).toEqual(Object.fromEntries(state.fighters.filter(({side})=>side==="player").map(({def,hp})=>[def.id,hp])));
      for (const bad of [-20, 1, NaN, Infinity, 9999999]) expect(() => resolveExpeditionBossBattle({...input,stopAtMs:bad},[])).toThrow();
      expect(() => resolveExpeditionBossBattle({...input,stopAtMs:0},[{kind:"ultimate",elapsedMs:20,actorId:"rex"}])).toThrow();
    });
  }
  it("추가 평타·거짓 궁극기·틱 사이 입력은 검증에서 거절한다", () => {
    const input = { allies: [getRelic("rex")], boss: getExpeditionNodeEnemies("boss", 20)[0], arena: battleArena("expeditionBoss"), replayIdentity: "run" };
    for (const action of [{ kind: "basic" as const, elapsedMs: 0 }, { kind: "ultimate" as const, elapsedMs: 0 }, { kind: "ultimate" as const, elapsedMs: 21 }]) expect(() => resolveExpeditionBossBattle(input, [{ ...action, actorId: "rex" }])).toThrow("INVALID_BOSS_BATTLE_INPUT");
  });
  it("공유 진행률은 초과 개인 피해와 별개로 100%에서 멈춘다", () => {
    expect(raidSeasonProgress(200, 100)).toEqual({ totalHp: 100, dealtDamage: 100, remainingHp: 0, remainingRatio: 0, defeated: true });
  });
  it("방어·무효화·보호막·과잉 타격은 실제 HP에 들어간 몫만 레이드 점수로 센다", () => {
    const hit = (defense: number, shield: number, hp = 10000, immune = false) => {
      const base = getRelic("sukusuino"); const boss = { ...raidBossDef(base, "easy"), stats: { ...raidBossDef(base, "easy").stats, def: defense } };
      const config = createRaidSkirmishConfig([getRelic("rex")], boss, raidBossPercentHpBasis(base, "easy"), hp);
      const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena("raid"), {}, {}, config);
      const target = state.fighters.find(({ id }) => id === "enemy-0")!; target.shield.amount = shield; target.undying = immune ? { remaining: 1, total: 1 } : null;
      replayLoggedBossAction(state, "rex", "basic", () => 0.99);
      expect(state.boss!.score).toBe(hp - target.hp);
      return state.boss!.score;
    };
    const normal = hit(100, 0); expect(normal).toBeGreaterThan(0);
    expect(hit(1000, 0)).toBeLessThan(normal);
    expect(hit(100, 100000)).toBe(0);
    expect(hit(1000000, 0)).toBe(1);
    expect(hit(100, 0, 10000, true)).toBe(0);
    expect(hit(0, 0, 1)).toBe(1);
  });

});
