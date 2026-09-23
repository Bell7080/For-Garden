import { describe, expect, it, vi } from "vitest";
import { createSkirmish, stepSkirmish, type SkirmishEvent } from "../../src/core/skirmish";
import { createExpeditionBossSkirmishConfig, type ExpeditionBossBattleInputDto } from "../../src/core/expeditionBattle";
import { calculateExpeditionRunScore } from "../../src/core/expeditionRewards";
import { resolveExpeditionBossBattle, type ExpeditionBossAction } from "../../src/core/expeditionBoss";
import { getExpeditionNodeEnemies } from "../../src/data/expeditionEnemies";
import { RELICS } from "../../src/data/relics";
import { ExpeditionBossSettlementError, ExpeditionBossSettlementFlow, ExpeditionManager } from "../../src/managers/ExpeditionManager";
import { beginBossSettlementAttempt, bossSettlementRecoveryRoute, completeBossSettlementAttempt, createBossSettlementFailureState, failBossSettlementAttempt } from "../../src/core/bossSettlementFailure";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession, type Session } from "../../src/state/session";

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
      const kind = event.skill === "staccato" || event.skill === "shimmer" || event.skill === "weakpoint"
        ? "basic" : event.skill === "transfer" ? "ultimate" : event.skill;
      actions.push({ elapsedMs: Math.round((event.at ?? state.elapsed) * 1_000), actorId: attacker.def.id, kind });
    }
  }
  expect(state.phase).toBe("defeat");
  return actions;
}

function verify(party: readonly string[], actions: readonly ExpeditionBossAction[]): number {
  const result = resolveExpeditionBossBattle({
    allies: party.map((id) => RELICS.find((relic) => relic.id === id)!),
    // 서버와 같이 불사 자리를 새긴다 — 강인함·경감은 개체가 아니라 그 자리가 갖는다.
    boss: { ...RELICS.find(({ id }) => id === "pontos")!, encounterRole: "endless" },
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

type PersistPhase = "score" | "settlement";

/**
 * 실제 Session 하나를 FakeServer와 manager가 공유하게 해 클라이언트/임시 서버의 상태 이전을 함께 본다.
 * 개발 바로가기는 보스 도달 상태만 준비하며, pendingRewards는 앞선 노드가 서버에 맡긴 임시 전리품을 모사한다.
 */
function settlementHarness(failOnce?: PersistPhase) {
  const state = createDefaultSession();
  const managerSaves: Session[] = [];
  const serverPersists: Session[] = [];
  const commitOrder: string[] = [];
  let bossNodeId = "";
  let failed = false;
  const manager = new ExpeditionManager(state, { save: (next) => {
    managerSaves.push(structuredClone(next));
    commitOrder.push(next.expedition.run?.visitedNodeIds.includes(bossNodeId) ? "local-node" : "manager-setup");
  } }, () => new Date("2026-09-02T12:00:00Z"), true);
  const shortcut = manager.prepareDevelopmentBossShortcut(["anky", "rex", "spino"]);
  if (!shortcut.ok) throw new Error(`보스 테스트 런 준비 실패: ${shortcut.reason}`);
  const boss = state.expedition.run!.nodes.find(({ type }) => type === "boss")!;
  bossNodeId = boss.id;
  state.expedition.run!.pendingRewards = { gold: 73 };
  const walletBefore = state.wallet.gold;
  const persistSession = vi.fn((next: Session) => {
    const phase: PersistPhase = next.expedition.run === null ? "settlement" : "score";
    // 점수 저장 실패는 FakeServer가 점수/누적 영수증을 소유하지 않아야 하고, 최종 저장 실패는
    // manager가 이미 확정한 보스 방문을 보존한 채 FakeServer의 원자 정산만 재시도해야 한다.
    if (!failed && failOnce === phase) { failed = true; throw new Error(`${phase} persistence failure`); }
    serverPersists.push(structuredClone(next));
    commitOrder.push(phase);
  });
  const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-02T12:00:00Z"), persistSession });
  const submit = vi.spyOn(server, "submitExpeditionBossScore");
  const settle = vi.spyOn(server, "settleExpeditionRun");
  const requests = manager.prepareBossRequests(boss.id)!;
  const request = { ...requests, runId: state.expedition.run!.runId, nodeId: boss.id };
  const actions = fightAndLog(["anky", "rex", "spino"], 1);
  // 준비 단계의 manager 저장은 finish 순서 검증 대상이 아니므로 실제 왕복 직전에 기록만 비운다.
  commitOrder.length = 0;
  return { state, manager, server, flow: new ExpeditionBossSettlementFlow(server, manager), request, actions, walletBefore, managerSaves, serverPersists, commitOrder, persistSession, submit, settle };
}

describe("원정 보스 비동기 정산 복구", () => {
  it("실제 구성요소가 점수·방문·임시 보상·주간 횟수·런 제거를 각각 한 번만 확정한다", async () => {
    const harness = settlementHarness();
    const result = await harness.flow.finish(harness.request, harness.actions);
    expect(result.score.bossDamageScore).toBeGreaterThan(0);
    expect(result.settlement.granted).toEqual({ gold: 73 });
    expect(harness.submit).toHaveBeenCalledTimes(1);
    expect(harness.settle).toHaveBeenCalledTimes(1);
    expect(harness.managerSaves.filter(({ expedition }) => expedition.run?.visitedNodeIds.includes(harness.request.nodeId))).toHaveLength(1);
    // 실제 FakeServer 점수 커밋, manager의 로컬 노드 적용, 최종 런 정산이 서로 앞서거나 합쳐지지 않는다.
    const scoreCommit = harness.serverPersists.findIndex(({ expedition }) => expedition.run?.bossDamageScore === result.score.bossDamageScore);
    const localNodeCommit = harness.managerSaves.findIndex(({ expedition }) => expedition.run?.visitedNodeIds.includes(harness.request.nodeId));
    const settlementCommit = harness.serverPersists.findIndex(({ expedition }) => expedition.run === null);
    expect(scoreCommit).toBeGreaterThanOrEqual(0);
    expect(localNodeCommit).toBeGreaterThanOrEqual(0);
    expect(settlementCommit).toBeGreaterThan(scoreCommit);
    expect(harness.commitOrder).toEqual(["score", "local-node", "settlement"]);
    expect(harness.state.wallet.gold).toBe(harness.walletBefore + 73);
    expect(harness.state.expedition.playsThisWeek).toBe(1);
    expect(harness.state.expedition.run).toBeNull();
  });

  it("점수 저장 실패는 score 소유자가 깨끗한 상태로 재시도해 누적을 한 번만 반영한다", async () => {
    const harness = settlementHarness("score");
    await expect(harness.flow.finish(harness.request, harness.actions)).rejects.toMatchObject({ phase: "score", causeCode: "PERSISTENCE_FAILED" } satisfies Partial<ExpeditionBossSettlementError>);
    const result = await harness.flow.finish(harness.request, harness.actions);
    expect(harness.submit).toHaveBeenCalledTimes(2);
    expect(harness.settle).toHaveBeenCalledTimes(1);
    expect(result.score.cumulativeScore).toBe(result.score.bossDamageScore);
    expect(harness.state.wallet.gold).toBe(harness.walletBefore + 73);
    expect(harness.state.expedition.playsThisWeek).toBe(1);
  });

  it("최종 정산 저장 실패는 settlement 소유자만 재시도해 보상과 플레이 횟수를 중복하지 않는다", async () => {
    const harness = settlementHarness("settlement");
    await expect(harness.flow.finish(harness.request, harness.actions)).rejects.toMatchObject({ phase: "settlement", causeCode: "PERSISTENCE_FAILED" } satisfies Partial<ExpeditionBossSettlementError>);
    const result = await harness.flow.finish(harness.request, harness.actions);
    expect(result.settlement.granted).toEqual({ gold: 73 });
    expect(harness.submit).toHaveBeenCalledTimes(1);
    expect(harness.settle).toHaveBeenCalledTimes(2);
    expect(harness.state.wallet.gold).toBe(harness.walletBefore + 73);
    expect(harness.state.expedition.playsThisWeek).toBe(1);
    expect(harness.state.expedition.run).toBeNull();
  });

  it("페이지 재시작으로 flow 캐시가 사라져도 저장된 ID와 서버 영수증으로 복구한다", async () => {
    const harness = settlementHarness("settlement");
    await expect(harness.flow.finish(harness.request, harness.actions)).rejects.toMatchObject({ phase: "settlement" });
    const storedRequest = { requestId: harness.state.expedition.run!.bossSubmissionId!, settlementId: harness.state.expedition.run!.bossSettlementId!, runId: harness.state.expedition.run!.runId, nodeId: harness.request.nodeId };
    // 새 flow와 manager는 페이지 메모리 캐시가 모두 사라진 뒤의 Boot 복구 소유자이고, FakeServer의
    // 영속 멱등 영수증과 Session에 먼저 저장한 ID만으로 점수 누적 없이 최종 정산을 계속한다.
    const restartedManager = new ExpeditionManager(harness.state, { save: vi.fn() }, () => new Date("2026-09-02T12:00:00Z"));
    const restartedFlow = new ExpeditionBossSettlementFlow(harness.server, restartedManager);
    const recovered = await restartedFlow.finish(storedRequest, harness.actions);
    expect(recovered.settlement.settlementId).toBe(storedRequest.settlementId);
    expect(harness.submit).toHaveBeenCalledTimes(2);
    expect(harness.settle).toHaveBeenCalledTimes(2);
    expect(recovered.score.cumulativeScore).toBe(recovered.score.bossDamageScore);
    expect(harness.state.wallet.gold).toBe(harness.walletBefore + 73);
    expect(harness.state.expedition.playsThisWeek).toBe(1);
  });

  it("최종 커밋 직후 페이지가 재시작되어 활성 런이 없어도 두 서버 영수증을 다시 읽는다", async () => {
    const harness = settlementHarness();
    const first = await harness.flow.finish(harness.request, harness.actions);
    // 성공 직후 렌더 전에 재시작한 경우 런은 이미 제거됐다. 새 flow는 저장된 요청 ID를 전달받아
    // 로컬 노드를 다시 적용하지 않고 FakeServer의 점수/정산 영수증 복구 경계를 사용해야 한다.
    const restarted = new ExpeditionBossSettlementFlow(harness.server, new ExpeditionManager(harness.state, { save: vi.fn() }, () => new Date("2026-09-02T12:00:00Z")));
    const recovered = await restarted.finish(harness.request, harness.actions);
    expect(recovered).toEqual(first);
    expect(harness.state.wallet.gold).toBe(harness.walletBefore + 73);
    expect(harness.state.expedition.playsThisWeek).toBe(1);
    expect(harness.state.expedition.run).toBeNull();
  });

  it("영구 정산 실패도 실패판은 한 장씩 교체하고 Boot 복구 이탈을 제공한다", async () => {
    const harness = settlementHarness();
    harness.persistSession.mockImplementation((next: Session) => { if (next.expedition.run === null) throw new Error("offline"); });
    const state = createBossSettlementFailureState();
    expect(beginBossSettlementAttempt(state)).toBe(true);
    // 전송 중의 두 번째 탭은 새 네트워크 요청이나 실패 UI를 만들 수 없다.
    expect(beginBossSettlementAttempt(state)).toBe(false);
    await expect(harness.flow.finish(harness.request, harness.actions)).rejects.toMatchObject({ phase: "settlement" });
    failBossSettlementAttempt(state);
    expect(state).toMatchObject({ bossSettlementPending: false, failureVisible: true, failureUiGeneration: 1 });

    // 재시도 시작이 기존 판을 먼저 숨기고, 다시 실패해도 최신 세대 한 장만 표시한다.
    expect(beginBossSettlementAttempt(state)).toBe(true);
    expect(state.failureVisible).toBe(false);
    await expect(harness.flow.finish(harness.request, harness.actions)).rejects.toMatchObject({ phase: "settlement" });
    failBossSettlementAttempt(state);
    expect(state).toMatchObject({ bossSettlementPending: false, failureVisible: true, failureUiGeneration: 2 });
    expect(harness.submit).toHaveBeenCalledTimes(1);
    expect(harness.settle).toHaveBeenNthCalledWith(2, expect.objectContaining({ settlementId: harness.request.settlementId }));

    // 이 경로에는 정산 성공이나 로컬 런 삭제 명령이 없고 Boot 목적지만 존재한다.
    expect(bossSettlementRecoveryRoute()).toEqual({ scene: "boot", data: { destination: "lobby" } });
    completeBossSettlementAttempt(state);
    expect(state).toMatchObject({ bossSettlementPending: false, failureVisible: false });
  });
});
