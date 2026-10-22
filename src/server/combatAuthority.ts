import { isStoryStageAvailable, storyDifficultyOf } from "../core/storyDifficulty";
import type { Session } from "../state/session";
import { getRelic } from "../data/relics";
import {
  getBattleStage,
  getStageEnemies,
  stageEnemyGrowth,
} from "../data/stages";
import {
  getCakeOperationTier,
  cakeOperationEnemies,
  cakeOperationRole,
} from "../data/cakeOperation";
import { getBountyTier, bountyRoundEnemy } from "../data/bounty";
import { getExpeditionNodeEnemies } from "../data/expeditionEnemies";
import {
  createExpeditionSkirmishConfig,
  type ExpeditionBattleInputDto,
} from "../core/expeditionBattle";
import { partyRuneTraitEffects } from "../core/runeTraitEffects";
import { ENCOUNTER_ROLE, encounterRoleFor } from "../core/levelDesign";
import { placedEnemyIndex } from "../data/placedEnemies";
import { RelicProgressionManager } from "../managers/RelicProgressionManager";
import { battleArena } from "../core/battleArena";
import {
  stepSkirmish,
  fireUltimate,
  canFireUltimate,
  skirmishRelicResults,
} from "../core/skirmish";
import { bossBattleRandom } from "../core/bossSimulation";
import {
  combatState,
  COMBAT_STEP_MS,
  MAX_COMBAT_TICKS,
  MAX_COMBAT_ACTIONS,
  emptyCombatJournal,
  type CombatPrepare,
  type CombatLease,
  type CombatProof,
  type CombatVerdict,
  type CombatJournal,
} from "../core/combatProtocol";

const fail = (): never => {
  throw new Error("COMBAT_REJECTED");
};
export function combatJournal(state: Session): CombatJournal {
  const journal = state.serverJournal!;
  return (journal.combat ??= emptyCombatJournal());
}
export function combatKey(input: CombatPrepare): string {
  const b = input.input;
  return b.mode === "stage"
    ? `stage:${input.stageId}`
    : b.mode === "expedition"
      ? `expedition:${b.runId}:${b.nodeId}`
      : b.mode === "duel" ? `duel:${b.requestId}`
      : b.mode === "cake" || b.mode === "bounty"
        ? `${b.mode}:${b.requestId}`
        : fail();
}

/** 적·편성·성장·노드는 서버 저장과 정적 정의에서만 복원한다. */
export function prepareCombat(
  state: Session,
  request: CombatPrepare,
  now: Date,
  id: string,
): CombatLease {
  if (request?.input?.mode === "duel") {
    const key = combatKey(request), records = combatJournal(state), ticket = records.tickets[key];
    if (!ticket?.duel || ticket.kind !== "duel") return fail();
    const active = Object.values(records.records).find(row => combatKey(row.input) === key && Date.parse(row.lease.expiresAt) > now.getTime());
    if (active) return structuredClone(active.lease);
    const setup = structuredClone(ticket.duel.setup);
    // 열린 구형 클라이언트는 새 코어 옵션을 모른다. 지원 여부를 요청한 새 전투만 전환한다.
    if (request.automaticUltimates !== true && setup.options) delete setup.options.automaticUltimates;
    const lease: CombatLease = { id, seed: id, setup, expiresAt: new Date(now.getTime() + 3600000).toISOString() };
    records.records = Object.fromEntries(Object.entries(records.records).filter(([, r]) => Date.parse(r.lease.expiresAt) > now.getTime()));
    if (Object.keys(records.records).length >= 8) return fail();
    records.records[id] = { lease, input: structuredClone(request), issuedAt: now.toISOString() };
    return structuredClone(lease);
  }
  if (
    !request ||
    !request.input ||
    !["stage", "cake", "bounty", "expedition"].includes(request.input.mode)
  )
    return fail();
  const records = combatJournal(state),
    input = structuredClone(request),
    key = combatKey(input),
    mode = input.input.mode;
  const active = Object.values(records.records).find(
    (row) =>
      combatKey(row.input) === key &&
      (row.input.input.mode !== "bounty" ||
        input.input.mode !== "bounty" ||
        row.input.input.round === input.input.round) &&
      Date.parse(row.lease.expiresAt) > now.getTime(),
  );
  if (active) return structuredClone(active.lease);
  let b = input.input;
  const ticket = records.tickets[key];
  if (mode !== "expedition" && !ticket) return fail();
  if (
    (b.mode === "stage" && ticket.target !== input.stageId) ||
    ((b.mode === "cake" || b.mode === "bounty") && ticket.target !== b.tierId)
  )
    return fail();
  if (b.mode === "bounty") {
    const bounty = b;
    if (!Number.isInteger(b.round) || b.round < 0 || b.round > 2) return fail();
    if (
      b.round > 0 &&
      !Object.values(records.records).some(
        (row) =>
          row.input.input.mode === "bounty" &&
          row.input.input.requestId === bounty.requestId &&
          row.input.input.round === bounty.round - 1 &&
          row.verdict?.victory,
      )
    )
      return fail();
  }
  if (b.mode === "expedition") {
    const expeditionInput = b;
    const run = state.expedition.run,
      node = run?.nodes.find((n) => n.id === expeditionInput.nodeId),
      prev = run?.nodes.find((n) => n.id === run.currentNodeId);
    if (
      !run ||
      run.runId !== b.runId ||
      run.settled ||
      !node ||
      !["normal", "elite", "horde"].includes(node.type) ||
      run.visitedNodeIds.includes(node.id) ||
      (!prev ? node.floor !== 1 : !prev.successorIds.includes(node.id))
    )
      return fail();
    b = {
      mode: "expedition",
      runId: run.runId,
      nodeId: node.id,
      nodeType: node.type as ExpeditionBattleInputDto["nodeType"],
      floor: node.floor,
      relics: structuredClone(run.relics),
      augments: structuredClone(run.selectedAugments),
    };
    input.input = b;
  }
  const party =
    b.mode === "expedition"
      ? b.relics.map((r) => r.relicId)
      : b.mode === "bounty"
        ? [state.party[b.round]]
        : state.party;
  if (
    party.some((r) => !r || !state.owned.has(r)) ||
    new Set(party).size !== party.length
  )
    return fail();
  const progression = new RelicProgressionManager(state);
  const frozen =
    b.mode === "expedition"
      ? new Map(
          state.expedition.run!.relics.map((r) => [r.relicId, r.snapshot]),
        )
      : undefined;
  const players = party.map((relicId) => ({
    ...getRelic(relicId),
    stats: structuredClone(
      frozen?.get(relicId)?.stats ?? progression.getFinalStats(relicId),
    ),
  }));
  const bonds = Object.fromEntries(
    party.map((r) => [
      r,
      frozen?.get(r)?.bondLevel ?? state.relicProgress[r]?.bondLevel ?? 0,
    ]),
  );
  const breakthroughs = Object.fromEntries(
    party.map((r) => [
      r,
      frozen?.get(r)?.breakthrough ?? state.relicProgress[r]?.breakthrough ?? 0,
    ]),
  );
  const traits = partyRuneTraitEffects(
    party.map((relicId) => ({
      relicId,
      runes:
        frozen?.get(relicId)?.runes ??
        (state.relicProgress[relicId]?.heartGemSlots ?? []).flatMap((id) =>
          state.runeInventory.filter((r) => r.instanceId === id),
        ),
    })),
  );
  const stage = getBattleStage(input.stageId ?? state.selectedStageId ?? "1-1");
  if (b.mode === "stage" && storyDifficultyOf(stage.id) !== "easy" && !isStoryStageAvailable(stage, state.cleared)) return fail();
  const cake = b.mode === "cake" ? getCakeOperationTier(b.tierId) : undefined;
  const enemies = cake
    ? cakeOperationEnemies(cake)
    : b.mode === "bounty"
      ? [bountyRoundEnemy(getBountyTier(b.tierId).rounds[b.round])]
      : b.mode === "expedition"
        ? getExpeditionNodeEnemies(b.nodeType, b.floor)
        : getStageEnemies(stage);
  const expedition =
    b.mode === "expedition"
      ? createExpeditionSkirmishConfig(b, players, enemies)
      : undefined;
  const setup: CombatLease["setup"] = {
    players: expedition?.playerDefs ?? players,
    enemies: expedition?.enemyDefs ?? enemies,
    arena: battleArena(b.mode),
    bonds,
    breakthroughs,
    options: expedition
      ? {
          playerInitialStates: expedition.playerInitialStates,
          augmentEffects: [...expedition.augmentEffects, ...traits],
          enemyBodyScale: expedition.enemyBodyScale,
        }
      : {
          augmentEffects: traits,
          enemyBreakthroughs:
            cake || b.mode === "bounty"
              ? [...placedEnemyIndex(b, stage, enemies).values()].map(
                  (e) => e.breakthrough,
                )
              : stageEnemyGrowth(stage).map((e) => e.breakthrough),
          enemyBodyScale:
            ENCOUNTER_ROLE[
              cake
                ? cakeOperationRole(cake)
                : encounterRoleFor(enemies.length, {
                    elite: stage.elite === true || b.mode === "bounty",
                  })
            ].bodyScale,
        },
  };
  const lease: CombatLease = JSON.parse(
    JSON.stringify({
      id,
      seed: id,
      setup,
      expiresAt: new Date(now.getTime() + 3600000).toISOString(),
    }),
  );
  records.records = Object.fromEntries(
    Object.entries(records.records).filter(
      ([, r]) => Date.parse(r.lease.expiresAt) > now.getTime(),
    ),
  );
  if (Object.keys(records.records).length >= 8) return fail();
  records.records[id] = {
    lease: structuredClone(lease),
    input,
    issuedAt: now.toISOString(),
  };
  return lease;
}

/** 입력은 궁극기를 누른 틱뿐이다. 평타·표적·피해·HP·승패는 같은 코어로 다시 계산한다. */
export function finishCombat(
  state: Session,
  proof: CombatProof,
  now: Date,
): CombatVerdict {
  if (
    !proof ||
    typeof proof.id !== "string" ||
    !Array.isArray(proof.actions) ||
    proof.actions.length > MAX_COMBAT_ACTIONS ||
    !Number.isInteger(proof.ticks) ||
    proof.ticks < 0 ||
    proof.ticks > MAX_COMBAT_TICKS ||
    (proof.abandoned !== undefined && typeof proof.abandoned !== "boolean")
  )
    return fail();
  const record = combatJournal(state).records[proof.id];
  if (!record || Date.parse(record.lease.expiresAt) < now.getTime())
    return fail();
  if (record.verdict) return structuredClone(record.verdict);
  if (record.lease.setup.options?.automaticUltimates && proof.actions.length) return fail();
  // 공식 최대 배속보다 빨리 끝나는 제출은 재현 전에 거절한다. 일시 정지는 상한을 늘리지 않는다.
  if (
    proof.ticks * COMBAT_STEP_MS >
    Math.max(0, now.getTime() - Date.parse(record.issuedAt)) * 3 + 2000
  )
    return fail();
  const battle = combatState(record.lease),
    rng = bossBattleRandom(record.lease.seed);
  let index = 0,
    previous = -1;
  for (const action of proof.actions) {
    if (
      !action ||
      !Number.isInteger(action.tick) ||
      action.tick < 0 ||
      action.tick < previous ||
      action.tick > proof.ticks ||
      typeof action.actorId !== "string"
    )
      return fail();
    previous = action.tick;
  }
  for (let tick = 0; tick <= proof.ticks; tick++) {
    while (index < proof.actions.length && proof.actions[index].tick === tick) {
      const action = proof.actions[index++],
        actor = battle.fighters.find(
          (f) => f.id === action.actorId && f.side === "player",
        );
      if (!actor || battle.phase !== "fight" || !canFireUltimate(battle, actor))
        return fail();
      fireUltimate(battle, actor.id, rng);
    }
    if (tick < proof.ticks) {
      if (battle.phase !== "fight") return fail();
      stepSkirmish(battle, COMBAT_STEP_MS / 1000, rng);
    }
  }
  if (
    index !== proof.actions.length ||
    (!proof.abandoned && battle.phase === "fight")
  )
    return fail();
  const victory = !proof.abandoned && battle.phase === "victory";
  const results = skirmishRelicResults(battle);
  const party =
    record.input.input.mode === "expedition"
      ? record.input.input.relics.map((r) => r.relicId)
      : record.lease.setup.players.map((f) => f.id);
  const verdict = {
    victory,
    relicHp: party.map((id) =>
      victory ? (results.find((r) => r.relicId === id)?.currentHp ?? 0) : 0,
    ),
    elapsedMs: proof.ticks * COMBAT_STEP_MS,
  };
  record.verdict = verdict;
  return structuredClone(verdict);
}

export function consumeCombat(state: Session, key: string): void {
  const journal = combatJournal(state);
  delete journal.tickets[key];
  for (const [id, record] of Object.entries(journal.records))
    if (combatKey(record.input) === key) delete journal.records[id];
}
