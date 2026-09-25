import { describe, expect, it } from "vitest";
import { battleArena } from "../../src/core/battleArena";
import { createRaidSkirmishConfig } from "../../src/core/expeditionBattle";
import { resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { raidBossDef, raidBossPercentHpBasis } from "../../src/core/raid";
import { createSkirmish, stepSkirmish } from "../../src/core/skirmish";
import { RAID_BOSS_BALANCE, RAID_BOSS_POOL, type RaidDifficulty } from "../../src/data/raid";
import { RELICS } from "../../src/data/relics";

/**
 * 레이드 한 판의 왕복 — 진짜 난전을 끝까지 돌려 **전투 씬과 같은 규칙으로** 행동을 적고, 그
 * 행동열을 서버 재현기에 넣는다. 손으로 적은 행동열은 검증기를 통과하도록 다듬어진 값이라
 * 실제 판이 거절돼도 계속 통과한다.
 *
 * 여기 모인 편성은 실제로 거절되던 자리다 — 디안의 합공이 한 행동에 두 사건을 남기고, 늑대의
 * 폭주가 오히려 느려지게 계산되고, 타보아의 둔화가 재현에서만 걸리고, 엘라의 금강불괴 가속이
 * 한계에 빠져 있었다. 넷 모두 "전투 기록이 서버 검증에서 거절되었습니다"로 끝났다.
 */
function fightAndVerify(party: readonly string[], bossId: string, difficulty: RaidDifficulty, seed: number): void {
  const players = party.map((id) => RELICS.find((relic) => relic.id === id)!);
  const base = RELICS.find(({ id }) => id === bossId)!;
  const boss = raidBossDef(base, difficulty);
  const basis = raidBossPercentHpBasis(base, difficulty);
  const config = createRaidSkirmishConfig(players, boss, basis);
  let value = seed;
  const rng = (): number => { value = (value * 1664525 + 1013904223) % 4294967296; return value / 4294967296; };
  const state = createSkirmish(config.playerDefs, config.enemyDefs, battleArena("raid"), {}, {}, {
    playerInitialStates: config.playerInitialStates, augmentEffects: config.augmentEffects, enemyBodyScale: config.enemyBodyScale, boss: config.boss,
  });
  const actions: ExpeditionBossAction[] = [];
  let frames = 0;
  while (state.phase === "fight" && frames++ < 60_000) {
    for (const event of stepSkirmish(state, 1 / 60, rng)) {
      if (event.kind !== "attack") continue;
      const attacker = state.fighters.find(({ id }) => id === event.attackerId);
      const target = state.fighters.find(({ id }) => id === event.targetId);
      // BattleScene의 기록 조건과 같은 줄을 쓴다 — 하나라도 달라지면 이 회귀가 실제를 검사하지 못한다.
      if (!state.boss || attacker?.side !== "player" || target?.side !== "enemy" || event.animate === false || event.followUp === true) continue;
      const kind = event.skill === "staccato" || event.skill === "shimmer" || event.skill === "weakpoint"
        ? "basic" : event.skill === "transfer" ? "ultimate" : event.skill;
      actions.push({ elapsedMs: Math.round((event.at ?? state.elapsed) * 1_000), actorId: attacker.def.id, kind });
    }
  }
  expect(state.phase).toBe("defeat");
  expect(actions.length).toBeGreaterThan(0);
  const result = resolveExpeditionBossBattle({ allies: players, boss, balance: RAID_BOSS_BALANCE, percentHpBasis: basis, arena: battleArena("raid") }, actions);
  expect(result.totalDamage).toBeLessThanOrEqual(RAID_BOSS_BALANCE.maximumAcceptedScore);
}

describe("레이드 피해 제출 왕복", () => {
  const parties = [
    ["dian", "spino", "stella"], ["parua", "dian", "luka"], ["mette", "terisa", "dian"],
    ["ella", "maddy", "morphe"], ["anky", "dodo", "pachi"], ["pachi", "delopi", "deina"],
    ["anky", "dodo", "parua"],
  ];
  for (const bossId of RAID_BOSS_POOL) {
    for (const difficulty of ["easy", "rampage"] as const) {
      parties.forEach((party, index) => {
        it(`${bossId} ${difficulty} · ${party.join("·")} 편성의 실제 전투를 서버가 받아들인다`, () => {
          fightAndVerify(party, bossId, difficulty, index + 1);
        });
      });
    }
  }

  it("디안의 합공은 한 행동에 평타 하나만 남긴다", () => {
    const dian = RELICS.find(({ id }) => id === "dian")!;
    const base = RELICS.find(({ id }) => id === "sukusuino")!;
    const config = createRaidSkirmishConfig([dian], raidBossDef(base, "easy"), raidBossPercentHpBasis(base, "easy"));
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

  it("레이드 보스를 쓰러뜨리면 그 자리에서 이기고, 서버 재현도 그 끝을 받는다", () => {
    // 몸을 작게 세워 한 판 안에 쓰러뜨린다 — 규칙은 몸의 크기와 무관하다.
    const party = ["anky", "dodo", "parua"].map((id) => RELICS.find((relic) => relic.id === id)!);
    const base = RELICS.find(({ id }) => id === "sukusuino")!;
    const boss = { ...raidBossDef(base, "easy"), stats: { ...raidBossDef(base, "easy").stats, hp: 800 } };
    const basis = raidBossPercentHpBasis(base, "easy");
    const config = createRaidSkirmishConfig(party, boss, basis);
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
    // 제한 시간(90초)까지 서 있지 않고 쓰러뜨린 그 자리에서 끝났다.
    expect(state.elapsed * 1_000).toBeLessThan(RAID_BOSS_BALANCE.phases[RAID_BOSS_BALANCE.phases.length - 1].startsAtMs);
    const result = resolveExpeditionBossBattle({ allies: party, boss, balance: RAID_BOSS_BALANCE, percentHpBasis: basis, arena: battleArena("raid"), bossKillable: true }, actions);
    expect(result.bossDefeated).toBe(true);
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
