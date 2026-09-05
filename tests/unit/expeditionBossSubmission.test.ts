import { describe, expect, it } from "vitest";
import { createSkirmish, stepSkirmish, type SkirmishEvent } from "../../src/core/skirmish";
import { createExpeditionBossSkirmishConfig, type ExpeditionBossBattleInputDto } from "../../src/core/expeditionBattle";
import { resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { RELICS } from "../../src/data/relics";

const ARENA = { left: 130, right: 950, top: 600, bottom: 1360 };

/**
 * 손으로 적은 행동열은 검증기를 통과하도록 이미 다듬어진 값이라, 실제 판이 거절돼도 계속
 * 통과한다(v0.66.1까지 폰토스 정산 실패가 그렇게 살아남았다). 그래서 이 회귀는 진짜 난전을
 * 끝까지 돌려 **전투 씬과 같은 규칙으로** 행동을 적고, 그 행동열을 서버 검증기에 넣는다.
 */
function fightAndLog(party: readonly string[], seed: number): ExpeditionBossAction[] {
  const players = party.map((id) => RELICS.find((relic) => relic.id === id)!);
  const input: ExpeditionBossBattleInputDto = {
    mode: "expeditionBoss", runId: "run", nodeId: "boss", floor: 20,
    relics: party.map((relicId) => ({ relicId, currentHp: 100, alive: true })), augments: [],
    requestId: "score", settlementId: "settle",
  };
  const config = createExpeditionBossSkirmishConfig(input, players, getExpeditionNodeEnemies("boss", 20));
  let value = seed;
  const rng = (): number => { value = (value * 1664525 + 1013904223) % 4294967296; return value / 4294967296; };
  const state = createSkirmish(config.playerDefs, config.enemyDefs, ARENA, {}, {}, {
    playerInitialStates: config.playerInitialStates, augmentEffects: config.augmentEffects, boss: config.boss,
  });
  const actions: ExpeditionBossAction[] = [];
  let frames = 0;
  while (state.phase === "fight" && frames++ < 20_000) {
    const events: SkirmishEvent[] = stepSkirmish(state, 1 / 60, rng);
    for (const event of events) {
      if (event.kind !== "attack") continue;
      const attacker = state.fighters.find(({ id }) => id === event.attackerId);
      const target = state.fighters.find(({ id }) => id === event.targetId);
      // BattleScene의 기록 조건과 같은 줄을 쓴다 — 하나라도 달라지면 이 회귀가 실제를 검사하지 못한다.
      if (!state.boss || attacker?.side !== "player" || target?.side !== "enemy" || event.animate === false || event.followUp === true) continue;
      const kind = event.skill === "staccato" || event.skill === "shimmer" ? "basic" : event.skill === "transfer" ? "ultimate" : event.skill;
      actions.push({ elapsedMs: Math.round((event.at ?? state.elapsed) * 1_000), actorId: attacker.def.id, kind });
    }
  }
  expect(state.phase).toBe("defeat");
  return actions;
}

function verify(party: readonly string[], actions: readonly ExpeditionBossAction[]): number {
  const result = resolveExpeditionBossBattle({
    allies: party.map((id) => RELICS.find((relic) => relic.id === id)!),
    boss: RELICS.find(({ id }) => id === "pontos")!,
    initialHpPercentByRelic: Object.fromEntries(party.map((id) => [id, 100])),
    augmentEffects: [], arena: ARENA,
  }, actions);
  return result.totalDamage;
}

describe("원정 보스 제출 왕복", () => {
  // 연격을 가진 스피나가 한 행동에 두 사건을 남기고, 그 두 사건이 같은 밀리초에 평타로 기록돼
  // 서버 재사용 대기 검증이 제출 전체를 거절했다. 그러면 정산 화면에는 "다시 시도"만 남는다.
  const parties = [["anky", "rex", "spino"], ["spino", "luka", "dodo"], ["mette", "maki", "pachi"], ["keris", "stella", "tia"], ["meron", "delopi", "spino"]];
  for (const party of parties) {
    for (const seed of [1, 7, 4_242]) {
      it(`${party.join("·")} 편성의 실제 전투(seed ${seed}) 행동열을 서버가 받아들인다`, () => {
        const actions = fightAndLog(party, seed);
        expect(actions.length).toBeGreaterThan(0);
        expect(() => verify(party, actions)).not.toThrow();
      });
    }
  }

  it("한 행동이 남긴 뒤이은 타격은 행동으로 세지 않는다", () => {
    const actions = fightAndLog(["anky", "rex", "spino"], 1);
    // 같은 개체·같은 종류가 같은 밀리초에 두 번 서면 그것이 곧 연격을 두 행동으로 센 것이다.
    const keys = actions.map(({ elapsedMs, actorId, kind }) => `${actorId}:${kind}:${elapsedMs}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("재현으로 설명되지 않을 만큼 빠른 평타는 여전히 거절한다", () => {
    const actions = fightAndLog(["anky", "rex", "spino"], 1);
    const first = actions.find(({ kind }) => kind === "basic")!;
    const spam = Array.from({ length: 8 }, (_, index) => ({ ...first, elapsedMs: first.elapsedMs + index * 10 }));
    expect(() => verify(["anky", "rex", "spino"], spam)).toThrow();
  });
});
