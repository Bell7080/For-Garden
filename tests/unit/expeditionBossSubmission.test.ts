import { describe, expect, it, vi } from "vitest";
import { createSkirmish, stepSkirmish, type SkirmishEvent } from "../../src/core/skirmish";
import { createExpeditionBossSkirmishConfig, type ExpeditionBossBattleInputDto } from "../../src/core/expeditionBattle";
import { calculateExpeditionRunScore } from "../../src/core/expeditionRewards";
import { resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { RELICS } from "../../src/data/relics";
import { ExpeditionBossSettlementError, ExpeditionBossSettlementFlow } from "../../src/managers/ExpeditionManager";
import type { SettleExpeditionRunResponse, SubmitExpeditionBossScoreResponse } from "../../src/api/contracts";

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

  it("여러 일반 노드 뒤 폰토스 피해를 한 판 점수로 한 번만 합친다", () => {
    const bossDamageScore = verify(["anky", "rex", "spino"], fightAndLog(["anky", "rex", "spino"], 1));
    const nodeScoreTotal = 4_000 + 5_700 + 7_200;
    const first = calculateExpeditionRunScore({ normalNodeScoreTotal: nodeScoreTotal, bossDamageScore });
    const retry = calculateExpeditionRunScore({ normalNodeScoreTotal: nodeScoreTotal, bossDamageScore });
    expect(first.runScore).toBe(nodeScoreTotal + bossDamageScore);
    expect(retry).toEqual(first);
  });

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

/** 렌더러와 무관하게 두 await 경계의 멱등·복구 상태만 고정하는 최소 영수증이다. */
const scoreReceipt = { score: 130, normalNodeScoreTotal: 100, bossDamageScore: 30, runScore: 130, bestScore: 130, cumulativeScore: 230, improved: true, endedAtMs: 90_000, rankBefore: 4, rankAfter: 2, weekKey: "2026-08-31" } satisfies SubmitExpeditionBossScoreResponse;
// 흐름은 PlayerStateDto의 나머지 필드를 해석하지 않으므로 테스트 영수증은 관찰 필드만 채운다.
const settlementReceipt = { runId: "run", settlementId: "settle", outcome: "completed", granted: { gold: 50 } } as unknown as SettleExpeditionRunResponse;
const request = { requestId: "score", settlementId: "settle", runId: "run", nodeId: "boss" };

/** 테스트는 manager가 응답 적용을 소유한다는 호출 계약도 함께 관찰한다. */
function settlementHarness() {
  const applyBossScore = vi.fn(() => true);
  const api = { submitExpeditionBossScore: vi.fn(async () => scoreReceipt), settleExpeditionRun: vi.fn(async () => settlementReceipt) };
  return { flow: new ExpeditionBossSettlementFlow(api, { applyBossScore }), api, applyBossScore };
}

describe("원정 보스 비동기 정산 복구", () => {
  it("점수 제출 실패는 정산을 시작하지 않고 score 단계에서 재시도한다", async () => {
    const harness = settlementHarness();
    harness.api.submitExpeditionBossScore.mockRejectedValueOnce(new Error("offline"));
    await expect(harness.flow.finish(request, [])).rejects.toMatchObject({ phase: "score" } satisfies Partial<ExpeditionBossSettlementError>);
    await expect(harness.flow.finish(request, [])).resolves.toEqual({ score: scoreReceipt, settlement: settlementReceipt });
    expect(harness.api.submitExpeditionBossScore).toHaveBeenCalledTimes(2);
    expect(harness.api.settleExpeditionRun).toHaveBeenCalledTimes(1);
  });

  it("점수 성공 뒤 정산 실패는 점수를 다시 제출하지 않고 settlement 단계만 재시도한다", async () => {
    const harness = settlementHarness();
    harness.api.settleExpeditionRun.mockRejectedValueOnce(new Error("timeout"));
    await expect(harness.flow.finish(request, [])).rejects.toMatchObject({ phase: "settlement" } satisfies Partial<ExpeditionBossSettlementError>);
    await expect(harness.flow.finish(request, [])).resolves.toEqual({ score: scoreReceipt, settlement: settlementReceipt });
    expect(harness.api.submitExpeditionBossScore).toHaveBeenCalledTimes(1);
    expect(harness.api.settleExpeditionRun).toHaveBeenCalledTimes(2);
  });

  it("정산 성공 뒤 UI 생성이 중단되어도 캐시된 최종 영수증으로 복구한다", async () => {
    const harness = settlementHarness();
    const first = await harness.flow.finish(request, []);
    // 첫 결과를 받은 뒤 렌더가 예외로 끊겼다고 가정해 동일 입력으로 최종 결과만 다시 얻는다.
    const recovered = await harness.flow.finish(request, []);
    expect(recovered).toEqual(first);
    expect(harness.api.submitExpeditionBossScore).toHaveBeenCalledTimes(1);
    expect(harness.api.settleExpeditionRun).toHaveBeenCalledTimes(1);
  });

  it("같은 멱등 ID 재시도는 누적 점수와 정산 보상을 만드는 API를 다시 부르지 않는다", async () => {
    const harness = settlementHarness();
    await harness.flow.finish(request, []);
    await harness.flow.finish({ ...request }, []);
    expect(harness.api.submitExpeditionBossScore).toHaveBeenCalledTimes(1);
    expect(harness.api.settleExpeditionRun).toHaveBeenCalledTimes(1);
    expect(harness.applyBossScore).toHaveBeenCalledTimes(1);
  });
});
