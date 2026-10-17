import type { Session } from "../state/session";
import { combatJournal, consumeCombat, combatKey } from "./combatAuthority";

const reject = (): never => {
  throw new Error("COMBAT_NOT_VERIFIED");
};
/** 보상 입력의 승패·HP·라운드는 저장된 서버 검증 결과로 덮어쓴다. 원본 요청으로는 보상하지 않는다. */
export function authoritativeArgs(
  state: Session,
  method: string,
  args: unknown[],
): unknown[] {
  const journal = combatJournal(state),
    request = args[0] as Record<string, unknown> | undefined;
  let key: string | undefined;
  if (method === "prepareExpeditionBoss") {
    const run = state.expedition.run;
    if (
      !run?.nodes
        .find((node) => node.id === run.currentNodeId)
        ?.successorIds.includes(String(request?.nodeId))
    )
      return reject();
  }
  if (method === "completeStage") key = `stage:${args[0]}`;
  if (method === "completeCakeOperation") key = `cake:${request?.requestId}`;
  if (method === "completeBounty") key = `bounty:${request?.requestId}`;
  if (method === "completeExpeditionNode") {
    const node = state.expedition.run?.nodes.find(
      (n) => n.id === request?.nodeId,
    );
    if (node?.type === "boss") return reject();
    if (node && !["normal", "elite", "horde"].includes(node.type))
      return [
        {
          ...request,
          relicHp: state.expedition.run!.relics.map((r) => r.currentHp),
        },
      ];
    if (node && ["normal", "elite", "horde"].includes(node.type))
      key = `expedition:${request?.runId}:${request?.nodeId}`;
  }
  if (key) {
    const records = Object.values(journal.records).filter(
      (record) => combatKey(record.input) === key && record.verdict,
    );
    if (!records.length) return reject();
    if (method === "completeStage")
      return [args[0], records[0].verdict!.victory];
    if (method === "completeBounty") {
      const rounds = new Map(
        records.map((record) => [
          record.input.input.mode === "bounty" ? record.input.input.round : -1,
          record.verdict!,
        ]),
      );
      const wins = [0, 1, 2].filter(
        (round) => rounds.get(round)?.victory,
      ).length;
      const terminal =
        rounds.get(2)?.victory ||
        [...rounds.values()].some((verdict) => !verdict.victory);
      if (!terminal || journal.tickets[key]?.target !== request?.tierId)
        return reject();
      return [{ ...request, victory: wins === 3, clearedRounds: wins }];
    }
    if (
      method === "completeCakeOperation" &&
      journal.tickets[key]?.target !== request?.tierId
    )
      return reject();
    return [
      {
        ...request,
        ...(method === "completeExpeditionNode"
          ? { relicHp: records[0].verdict!.relicHp }
          : { victory: records[0].verdict!.victory }),
      },
    ];
  }
  if (
    method === "enterRaid" ||
    method === "submitRaidDamage" ||
    method === "submitExpeditionBossScore"
  ) {
    if (request?.replayVersion !== 2)
      throw new Error("REPLAY_VERSION_REQUIRED");
    if (
      method !== "enterRaid" &&
      (!Array.isArray(request.actions) || request.actions.length > 4096)
    )
      throw new Error("INVALID_ACTIONS");
  }
  return args;
}

export function recordBoundaryResult(
  state: Session,
  method: string,
  args: unknown[],
  now: Date = new Date(),
): void {
  const journal = combatJournal(state),
    request = args[0] as Record<string, unknown> | undefined;
  if (
    method === "prepareExpeditionBoss" &&
    state.expedition.run?.bossSubmissionId
  ) {
    const issued = (journal.bossIssuedAt ??= {});
    issued[state.expedition.run.bossSubmissionId] ??= now.toISOString();
  }
  if (method === "completeExpeditionNode") {
    const node = state.expedition.run?.nodes.find(
      (n) => n.id === request?.nodeId,
    );
    if (node && !["normal", "elite", "horde"].includes(node.type))
      consumeCombat(state, `expedition:${request?.runId}:${request?.nodeId}`);
  }
  if (method === "enterStage" || method === "enterEventStage") {
    const stageId = String(request?.stageId ?? "");
    const key = `stage:${stageId}`;
    for (const [old, ticket] of Object.entries(journal.tickets))
      if (ticket.kind === "stage") consumeCombat(state, old);
    journal.tickets[key] = {
      kind: "stage",
      target: stageId,
      requestId: String(request?.requestId ?? ""),
    };
    state.selectedStageId = stageId;
  }
  if (method === "enterCakeOperation" || method === "enterBounty") {
    const kind = method === "enterBounty" ? "bounty" : "cake";
    for (const [old, ticket] of Object.entries(journal.tickets))
      if (ticket.kind === kind) consumeCombat(state, old);
    journal.tickets[`${kind}:${request?.requestId}`] = {
      kind,
      target: String(request?.tierId),
      requestId: String(request?.requestId),
    };
  }
  if (method === "completeStage") consumeCombat(state, `stage:${args[0]}`);
  if (method === "completeCakeOperation")
    consumeCombat(state, `cake:${request?.requestId}`);
  if (method === "completeBounty")
    consumeCombat(state, `bounty:${request?.requestId}`);
  if (method === "completeExpeditionNode")
    consumeCombat(state, `expedition:${request?.runId}:${request?.nodeId}`);
}

/** 다른 참가자의 제출과 별개로 서버 시계보다 빠른 전투 완료를 거절한다. */
export function verifyBossWallTime(
  state: Session,
  method: string,
  args: unknown[],
  result: unknown,
  now: Date,
): void {
  if (method !== "submitRaidDamage" && method !== "submitExpeditionBossScore")
    return;
  const request = args[0] as { requestId: string };
  const admission = state.serverJournal?.raidAdmissions[request.requestId];
  // 새 규칙으로 발급한 입장만 admittedAt이 있다. 구형 입장은 다시 입장해야 한다.
  const issued =
    method === "submitRaidDamage"
      ? admission?.admittedAt
      : combatJournal(state).bossIssuedAt?.[request.requestId];
  const duration = (result as { endedAtMs?: number }).endedAtMs;
  if (
    !issued ||
    typeof duration !== "number" ||
    !Number.isFinite(duration) ||
    duration > Math.max(0, now.getTime() - Date.parse(issued)) * 3 + 2000
  )
    throw new Error("COMBAT_TOO_FAST");
}
