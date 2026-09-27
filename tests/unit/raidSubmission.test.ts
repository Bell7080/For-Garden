import { describe, expect, it } from "vitest";
import { battleArena } from "../../src/core/battleArena";
import { BATTLE_DEATH_CLOCK } from "../../src/core/battleClock";
import { createRaidSkirmishConfig } from "../../src/core/expeditionBattle";
import { resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { raidBossDef, raidBossPercentHpBasis } from "../../src/core/raid";
import { canFireUltimate, createSkirmish, fireUltimate, stepSkirmish, type SkirmishEvent, type SkirmishState } from "../../src/core/skirmish";
import { RAID_BOSS_BALANCE, RAID_BOSS_POOL, RAID_DIFFICULTY, type RaidDifficulty } from "../../src/data/raid";
import { RELICS } from "../../src/data/relics";

/**
 * 한 프레임의 사건을 **전투 씬과 같은 규칙으로** 적는다. 평타는 코어가 못 박은 타격 시각에, 궁극기는
 * 쓴 순간에 적고 궁극기의 피해 사건은 거두지 않는다(`BattleScene.pumpUltimateQueue`).
 */
function recordFrame(state: SkirmishState, events: readonly SkirmishEvent[], actions: ExpeditionBossAction[]): void {
  for (const event of events) {
    if (event.kind !== "attack") continue;
    const attacker = state.fighters.find(({ id }) => id === event.attackerId);
    const target = state.fighters.find(({ id }) => id === event.targetId);
    if (!state.boss || attacker?.side !== "player" || target?.side !== "enemy" || event.animate === false || event.followUp === true) continue;
    const kind = event.skill === "staccato" || event.skill === "shimmer" || event.skill === "weakpoint" ? "basic" : event.skill;
    if (kind === "basic") actions.push({ elapsedMs: Math.round((event.at ?? state.elapsed) * 1_000), actorId: attacker.def.id, kind });
  }
}

/** 씬처럼 궁극기를 쓴다 — 차는 대로(`auto`) 또는 상한 가까이 모아 두었다가(`hoard`). */
function castUltimates(state: SkirmishState, rng: () => number, mode: "auto" | "hoard", actions: ExpeditionBossAction[]): void {
  for (const fighter of state.fighters) {
    if (fighter.side !== "player" || !canFireUltimate(state, fighter)) continue;
    if (mode === "hoard" && fighter.energy < 290) continue;
    const castAt = state.elapsed; const energyBefore = fighter.energy;
    const events = fireUltimate(state, fighter.id, rng);
    if (events.length > 0 || fighter.energy < energyBefore) actions.push({ elapsedMs: Math.round(castAt * 1_000), actorId: fighter.def.id, kind: "ultimate" });
  }
}

/**
 * 레이드 한 판의 왕복 — 진짜 난전을 끝까지 돌려 **전투 씬과 같은 규칙으로** 행동을 적고, 그
 * 행동열을 서버 재현기에 넣는다. 손으로 적은 행동열은 검증기를 통과하도록 다듬어진 값이라
 * 실제 판이 거절돼도 계속 통과한다.
 *
 * 여기 모인 편성은 실제로 거절되던 자리다 — 디안의 합공이 한 행동에 두 사건을 남기고, 늑대의
 * 폭주가 오히려 느려지게 계산되고, 타보아의 둔화가 재현에서만 걸리고, 엘라의 금강불괴 가속이
 * 한계에 빠져 있었다. 넷 모두 "전투 기록이 서버 검증에서 거절되었습니다"로 끝났다.
 *
 * **궁극기도 쓴다.** 예전 왕복은 궁극기를 한 번도 쓰지 않아, 피해 없는 궁극기(오더·순풍)가 기록에서
 * 빠지고 모아 쏜 궁극기가 시간 한계에 걸려 실제 판의 절반이 거절되는 동안에도 통과했다(v0.198.5).
 * 3배속의 긴 프레임도 섞는다.
 */
function fightAndVerify(party: readonly string[], bossId: string, difficulty: RaidDifficulty, seed: number, mode: "auto" | "hoard" | "none" = "auto"): void {
  const players = party.map((id) => RELICS.find((relic) => relic.id === id)!);
  const base = RELICS.find(({ id }) => id === bossId)!;
  const boss = raidBossDef(base, difficulty);
  const basis = raidBossPercentHpBasis(base, difficulty);
  const seasonHp = RAID_DIFFICULTY[difficulty].totalHp;
  const config = createRaidSkirmishConfig(players, boss, basis, seasonHp);
  let value = seed;
  const rng = (): number => { value = (value * 1664525 + 1013904223) % 4294967296; return value / 4294967296; };
  const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena("raid"), {}, {}, {
    playerInitialStates: config.playerInitialStates, augmentEffects: config.augmentEffects, enemyBodyScale: config.enemyBodyScale, boss: config.boss,
  });
  const actions: ExpeditionBossAction[] = [];
  let frames = 0;
  while (state.phase === "fight" && frames++ < 60_000) {
    const dt = mode === "none" ? 1 / 60 : (frames % 97 === 0 ? 0.25 : frames % 13 === 0 ? 0.05 : 1 / 60) * 3;
    recordFrame(state, stepSkirmish(state, dt, rng), actions);
    if (mode !== "none") castUltimates(state, rng, mode, actions);
  }
  expect(["defeat", "victory"]).toContain(state.phase);
  expect(actions.length).toBeGreaterThan(0);
  const result = resolveExpeditionBossBattle({ allies: players, boss, balance: RAID_BOSS_BALANCE, percentHpBasis: basis, arena: battleArena("raid"), bossKillable: config.boss.endsOnKill === true, seasonHp }, actions);
  expect(result.totalDamage).toBeLessThanOrEqual(RAID_BOSS_BALANCE.maximumAcceptedScore);
}

describe("레이드 피해 제출 왕복", () => {
  const parties = [
    ["dian", "spino", "stella"], ["parua", "dian", "luka"], ["mette", "terisa", "dian"],
    ["ella", "maddy", "morphe"], ["anky", "dodo", "pachi"], ["pachi", "delopi", "deina"],
    ["anky", "dodo", "parua"],
    // 피해 없는 궁극기 — 슈테의 오더(듀오 공속), 스테라의 순풍 — 와 듀오 충전.
    ["maddy", "shute", "anky"], ["stella", "maki", "ella"], ["ella", "shute", "rex"], ["nodonia", "deina", "shute"],
  ];
  for (const bossId of RAID_BOSS_POOL) {
    for (const difficulty of ["easy", "rampage"] as const) {
      parties.forEach((party, index) => {
        it(`${bossId} ${difficulty} · ${party.join("·")} 편성의 실제 전투를 서버가 받아들인다`, () => {
          fightAndVerify(party, bossId, difficulty, index + 1, "none");
          fightAndVerify(party, bossId, difficulty, index + 11, "auto");
          fightAndVerify(party, bossId, difficulty, index + 21, "hoard");
        });
      });
    }
  }

  it("게이지가 차지 않은 궁극기와 대기를 건너뛴 평타는 여전히 거절한다", () => {
    const party = ["anky", "dodo", "parua"].map((id) => RELICS.find((relic) => relic.id === id)!);
    const base = RELICS.find(({ id }) => id === "sukusuino")!;
    const boss = raidBossDef(base, "easy");
    const input = { allies: party, boss, balance: RAID_BOSS_BALANCE, percentHpBasis: raidBossPercentHpBasis(base, "easy"), arena: battleArena("raid") };
    const ultimates = Array.from({ length: 5 }, (_, index) => ({ elapsedMs: 1_000 + index * 100, actorId: "anky", kind: "ultimate" as const }));
    expect(() => resolveExpeditionBossBattle(input, ultimates)).toThrow("INVALID_BOSS_BATTLE_INPUT");
    const basics = Array.from({ length: 5 }, (_, index) => ({ elapsedMs: 1_000 + index * 50, actorId: "anky", kind: "basic" as const }));
    expect(() => resolveExpeditionBossBattle(input, basics)).toThrow("INVALID_BOSS_BATTLE_INPUT");
  });

  it("디안의 합공은 한 행동에 평타 하나만 남긴다", () => {
    const dian = RELICS.find(({ id }) => id === "dian")!;
    const base = RELICS.find(({ id }) => id === "sukusuino")!;
    const config = createRaidSkirmishConfig([dian], raidBossDef(base, "easy"), raidBossPercentHpBasis(base, "easy"), RAID_DIFFICULTY.easy.totalHp);
    const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena("raid"), {}, {}, { playerInitialStates: config.playerInitialStates, boss: config.boss });
    const primary: number[] = [];
    for (let frame = 0; frame < 240; frame++) {
      for (const event of stepSkirmish(state, 1 / 60, () => 0.5)) {
        if (event.kind === "attack" && event.attackerId === "player-0" && event.followUp !== true) primary.push(Math.round((event.at ?? state.elapsed) * 1_000));
      }
    }
    expect(primary.length).toBeGreaterThan(0);
    expect(new Set(primary).size).toBe(primary.length);
  });

  it("남은 공유 게이지를 다 깎으면 그 자리에서 이기고, 서버 재현도 그 끝을 받는다", () => {
    // 남은 게이지를 작게 두어 한 판 안에 다 깎는다 — 규칙은 게이지의 크기와 무관하다.
    const party = ["anky", "dodo", "parua"].map((id) => RELICS.find((relic) => relic.id === id)!);
    const base = RELICS.find(({ id }) => id === "sukusuino")!;
    const boss = raidBossDef(base, "easy");
    const basis = raidBossPercentHpBasis(base, "easy");
    const seasonHp = 800;
    const config = createRaidSkirmishConfig(party, boss, basis, seasonHp);
    expect(config.boss.endsOnKill).toBe(true);
    const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena("raid"), {}, {}, { playerInitialStates: config.playerInitialStates, boss: config.boss });
    const actions: ExpeditionBossAction[] = [];
    for (let frame = 0; frame < 60_000 && state.phase === "fight"; frame++) {
      for (const event of stepSkirmish(state, 1 / 60, () => 0.5)) {
        if (event.kind !== "attack") continue;
        const attacker = state.fighters.find(({ id }) => id === event.attackerId);
        const target = state.fighters.find(({ id }) => id === event.targetId);
        if (attacker?.side !== "player" || target?.side !== "enemy" || event.animate === false || event.followUp === true) continue;
        const kind = event.skill === "staccato" || event.skill === "shimmer" || event.skill === "weakpoint" ? "basic" : event.skill === "transfer" ? "ultimate" : event.skill;
        actions.push({ elapsedMs: Math.round((event.at ?? state.elapsed) * 1_000), actorId: attacker.def.id, kind });
      }
    }
    expect(state.phase).toBe("victory");
    // 데스 카운트가 돌기 전에, 쓰러뜨린 그 자리에서 끝났다.
    expect(state.elapsed).toBeLessThan(BATTLE_DEATH_CLOCK.startsAtSeconds);
    const result = resolveExpeditionBossBattle({ allies: party, boss, balance: RAID_BOSS_BALANCE, percentHpBasis: basis, arena: battleArena("raid"), bossKillable: true, seasonHp }, actions);
    expect(result.bossDefeated).toBe(true);
    // 이긴 것은 점수가 남은 게이지에 닿았기 때문이다.
    expect(state.boss!.score).toBeGreaterThanOrEqual(seasonHp);
  });

  it("원정 폰토스처럼 쓰러지지 않는 보스는 여전히 전멸만이 끝이다", () => {
    const party = [RELICS.find((relic) => relic.id === "anky")!];
    const base = RELICS.find(({ id }) => id === "sukusuino")!;
    const boss = { ...raidBossDef(base, "easy"), stats: { ...raidBossDef(base, "easy").stats, hp: 50 } };
    const state = createSkirmish(party, [boss], battleArena("raid"), {}, {}, {
      boss: { phases: [{ startsAt: 0, damagePerSecond: 0, label: "p" }, { startsAt: 20, damagePerSecond: 1_000_000_000, label: "q" }], limitSeconds: 30 },
    });
    for (let frame = 0; frame < 3_000 && state.phase === "fight"; frame++) stepSkirmish(state, 1 / 60, () => 0.5);
    expect(state.phase).toBe("defeat");
  });
});
