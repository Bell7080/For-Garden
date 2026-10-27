import { secureRandom } from "./secureRandom";
import type { AncientRankingResponse, ExpeditionLeaderboardResponse } from "../api/contracts";
import { isContentUnlocked } from "../core/contentUnlock";
import { rollDuelPeriods, normalizeDuelState } from "../core/duelState";
import type { PlayerDuelContext, PlayerDuelChange } from "./playerDuels";
import { prepareCombat, finishCombat } from "./combatAuthority";
import { authoritativeArgs, recordBoundaryResult, verifyBossWallTime } from "./releaseBoundary";
import type { CombatPrepare, CombatProof } from "../core/combatProtocol";
/**
 * 서버가 소유하는 게임 상태를 한 번의 호출 단위로 실행한다.
 * 규칙은 새로 쓰지 않고 FakeServer를 그대로 돌린다 — 저장된 상태를 세션으로 되살려 메서드 하나를
 * 실행하고, 바뀐 상태를 낙관적 잠금(revision)으로 다시 저장한다. 이 모듈은 Phaser·HTTP·DB를 모르고
 * 저장소(`StateStore`)와 시각·난수를 주입받으므로 단위 테스트가 그대로 서버 경로를 지난다.
 */
import { GameApiError, type ApiErrorCode } from "../api/contracts";
import { FakeServer } from "../api/FakeServer";
import { saveManager } from "../state/SaveManager";
import { applyOpsAdjustments, drainOpsNotices, isOpsMailId, opsMailUuid, type OpsAppliedAdjustment, type OpsInbox } from "../core/opsInbox";
import { createDefaultSession, type Session } from "../state/session";
import { publicProfile } from "./publicProfile";
import { raidChanges, type SharedRaidContext, type SharedRaidChange } from "./sharedRaids";
import { isReadMethod, REQUEST_ID, validCall } from "./requestPolicy";
import { isServerGameMethod } from "./gameMethods";
import type { GuildBackend } from "../api/guildContracts";
import { createUnavailableGuildBackend } from "../api/UnavailableGuildBackend";

export interface StoredState {
  revision: string;
  data: unknown;
}

export interface StateStore {
  load(playerId: string): Promise<StoredState | null>;
  identity?(playerId: string): Promise<{ uid: string; createdAt: string }>;
  pendingRequests?(playerId: string): Promise<number>;
  raidContext?(playerId: string, now: Date): Promise<SharedRaidContext>;
  expeditionContext?(playerId: string, now: Date): Promise<{ rank: number | null; entries: ExpeditionLeaderboardResponse["entries"] }>;
  /** 고대 지층 상시 순위(100등까지 + 내 줄). 초기화하지 않으므로 기간 키가 없다. */
  ancientRanking?(playerId: string): Promise<AncientRankingResponse>;
  duelContext?(playerId: string, now: Date): Promise<PlayerDuelContext>;
  /** 운영 도구가 올린 받을 우편과 아직 반영하지 않은 재화 조정. 실패해도 게임 호출은 막지 않는다. */
  opsInbox?(playerId: string): Promise<OpsInbox>;
  /** 상태 확정 뒤 반영한 조정과 수령한 우편을 운영 표에 표시한다(실패해도 상태는 이미 확정이다). */
  opsAck?(playerId: string, applied: OpsAppliedAdjustment[], claimedMails: string[]): Promise<void>;
  findReceipt(playerId: string, requestId: string): Promise<unknown | undefined>;
  /** 상태와 영수증을 한 트랜잭션으로 확정한다. 읽은 revision이 달라졌으면 `StateConflictError`를 던진다. */
  commit(input: {
    playerId: string;
    expectedRevision: string | null;
    data: unknown;
    method: string;
    requestId: string | null;
    response: unknown;
    publicProfile?: ReturnType<typeof publicProfile>;
    raids?: SharedRaidChange[];
    duels?: PlayerDuelChange[];
  }): Promise<{ revision: string }>;
}

export class StateConflictError extends Error {
  constructor() { super("save_conflict"); }
}

export interface GameCallRequest {
  method: string;
  args?: unknown[];
  /** 같은 요청의 재전송이 두 번 반영되지 않게 하는 클라이언트 발급 키(8~64자)다. */
  requestId?: string;
}

export interface GameCallResponse {
  ok: true;
  result: unknown;
  /** 호출 뒤의 전체 상태다. 클라이언트는 이것을 그대로 로컬 세션에 반영한다. */
  state: unknown;
  revision: string;
}

export class GameCallError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string, readonly domainCode?: ApiErrorCode) { super(message ?? code); }
}

export interface GameHandlerDeps {
  store: StateStore;
  now?: () => Date;
  random?: () => number;
  /** 같은 계정의 동시 호출이 낙관적 잠금에서 겹칠 때 다시 시도하는 횟수다. */
  maxAttempts?: number;
  strict?: boolean;
  /** QA 디버그 명령(`applyDebugCommand`)을 실행할지. 서버 번들은 일반 빌드라 환경 변수로만 켠다. */
  developmentTools?: boolean;
  /** 길드 저장소. 지갑이 얽힌 길드 조작(`createGuild` 등)이 쓰며, 없으면 모든 조작이 `UNAVAILABLE`로 거절된다. */
  guild?: GuildBackend;
}

// 한 프로세스 안에서는 계정별로 호출을 줄 세운다. FakeServer가 모듈 단위 싱글턴을 일부 읽으므로
// 서로 다른 계정이 한꺼번에 돌지도 않게 전역 한 줄로 직렬화한다(서버리스 인스턴스당 동시 1건).
const unavailableGuild = createUnavailableGuildBackend();
let chain: Promise<unknown> = Promise.resolve();
export const MAX_PENDING_GAME_CALLS = 32;
let pendingCalls = 0;
function serialize<T>(task: () => Promise<T>): Promise<T> {
  if (pendingCalls >= MAX_PENDING_GAME_CALLS) throw new GameCallError(503, "server_busy");
  pendingCalls++;
  const next = chain.then(task, task).finally(() => { pendingCalls--; });
  chain = next.catch(() => undefined);
  return next;
}



/** 운영 우편·재화 조정을 읽어 반영하는 호출 — 우편·알림·가방처럼 지금 값을 보여 주는 조회와 수령이다. */
const OPS_SYNC_METHODS = new Set(["getNotificationSignals", "getMails", "markMailsRead", "claimMailRewards", "getInventory", "getPlayerState"]);

export function handleGameCall(playerId: string, req: GameCallRequest, deps: GameHandlerDeps): Promise<GameCallResponse> {
  if (!validCall(req)) throw new GameCallError(400, "invalid_request");
  if (deps.strict && !isReadMethod(req.method) && !req.requestId) throw new GameCallError(400, "request_id_required");
  if (!isServerGameMethod(req?.method)) throw new GameCallError(400, "unknown_method");
  if (req.args !== undefined && !Array.isArray(req.args)) throw new GameCallError(400, "invalid_args");
  if (req.args && req.args.length > 4) throw new GameCallError(400, "invalid_args");
  if (req.requestId !== undefined && !REQUEST_ID.test(req.requestId)) throw new GameCallError(400, "invalid_request_id");
  const call = isReadMethod(req.method) ? { ...req, requestId: undefined } : req;
  return serialize(() => run(playerId, call, deps));
}

async function run(playerId: string, req: GameCallRequest, deps: GameHandlerDeps): Promise<GameCallResponse> {
  const attempts = deps.maxAttempts ?? 3;
  const legacyFingerprint = JSON.stringify([req.method, req.args ?? []]);
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(legacyFingerprint));
  const fingerprint = "sha256:" + [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("");
  for (let attempt = 1; ; attempt += 1) {
    // 서로 기다릴 이유가 없는 조회는 한꺼번에 나간다 — 순서대로 부르면 왕복 시간이 그대로 쌓인다.
    const wantsRaid = /^(getRaids|getNotificationSignals|summonRaid|enterRaid|submitRaidDamage|settleRaid)$/.test(req.method) && deps.store.raidContext;
    const now = deps.now?.() ?? new Date();
    const wantsOps = OPS_SYNC_METHODS.has(req.method) && deps.store.opsInbox;
    const wantsDuel = /^(getDuelStatus|refreshDuelOpponents|setDuelDefense|enterDuel|resolveDuel|buyDuelAttempt|getDuelRanking|claimDuelSeasonReward)$/.test(req.method) && deps.store.duelContext;
    const [cached, stored, identity, context, ops, duels, expedition, ancient] = await Promise.all([
      req.requestId ? deps.store.findReceipt(playerId, req.requestId) : undefined,
      deps.store.load(playerId),
      deps.store.identity ? deps.store.identity(playerId) : undefined,
      wantsRaid ? deps.store.raidContext!(playerId, now) : undefined,
      wantsOps ? deps.store.opsInbox!(playerId).catch(() => null) : null,
      wantsDuel ? deps.store.duelContext!(playerId, now) : undefined,
      /^(getExpeditionWeeklyBest|getExpeditionLeaderboard)$/.test(req.method) && deps.store.expeditionContext ? deps.store.expeditionContext(playerId, now) : undefined,
      req.method === "getAncientRanking" && deps.store.ancientRanking ? deps.store.ancientRanking(playerId) : undefined,
    ]);
    if (cached !== undefined) {
      const receipt = cached as GameCallResponse & { _requestFingerprint?: string };
      if (receipt._requestFingerprint !== fingerprint && receipt._requestFingerprint !== legacyFingerprint) throw new GameCallError(409, "request_id_conflict");
      const { _requestFingerprint, ...response } = receipt;
      // 영수증의 지급 사실은 보존하고, 현재 상태는 최신 저장을 함께 보낸다.
      if (stored && Number(stored.revision) >= Number(response.revision)) return { ...response, state: stored.data, revision: stored.revision };
      throw new GameCallError(409, "receipt_state_unavailable");
    }
    let state: Session;
    try {
      state = stored ? saveManager.parse(stored.data) : createDefaultSession();
    } catch {
      throw new GameCallError(500, "corrupt_state");
    }
    const before = JSON.stringify(saveManager.exportData(state));
    if (identity) {
      state.playerCard.uid = identity.uid;
      state.playerCard.createdAt = identity.createdAt;
    }
    if (wantsDuel && !isContentUnlocked("duel", state.playerResearch.level)) throw new GameCallError(422, "content_locked");
    if (isContentUnlocked("duel", state.playerResearch.level)) state.duel = rollDuelPeriods(normalizeDuelState(state.duel, [...state.owned]), now);
    if (context) state.raid.instances = context.records.map(row => structuredClone(row.instance));
    const server = new FakeServer(state, {
      latencyMs: 0,
      random: deps.random ?? secureRandom,
      ...(deps.now ? { now: deps.now } : {}),
      persistSession: () => undefined,
      raidContext: context,
      duelContext: duels,
      expeditionRank: expedition?.rank,
      ancientRanking: ancient,
      guild: deps.guild ?? unavailableGuild,
      playerId,
      developmentTools: deps.developmentTools === true,
    });
    // 재전송이 같은 길드 변경을 두 번 반영하지 않도록 길드 백엔드의 멱등 키를 요청 id로 고정한다.
    if (req.requestId) server.useGuildRequestId(req.requestId);
    const claimedBefore = new Set(state.claimedMailIds ?? []);
    let applied: OpsAppliedAdjustment[] = [];
    if (ops) {
      applied = applyOpsAdjustments(state, ops.adjustments, now);
      server.attachOpsMails(ops.mails);
    }
    let result: unknown;
    try {
      const timingState = deps.strict && (req.method === "submitRaidDamage" || req.method === "submitExpeditionBossScore") ? structuredClone(state) : state;
      const args = deps.strict ? authoritativeArgs(state, req.method, req.args ?? []) : req.args ?? [];
      if (req.method === "prepareCombat") result = prepareCombat(state, args[0] as CombatPrepare, now, globalThis.crypto.randomUUID());
      else if (req.method === "finishCombat") result = finishCombat(state, args[0] as CombatProof, now);
      else {
        result = await (server as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[req.method](...args);
        if (req.method === "getExpeditionLeaderboard" && expedition) result = { ...(result as object), entries: expedition.entries.slice(0, Math.max(0, Math.min(100, Number(args[0] ?? 100)))) };
        if (req.method === "getNotificationSignals" && deps.store.pendingRequests) result = { ...(result as object), pendingFriendRequestCount: await deps.store.pendingRequests(playerId) };
        if (req.method === "getNotificationSignals") { const opsNotices = drainOpsNotices(state); if (opsNotices.length) result = { ...(result as object), opsNotices }; }
        if (deps.strict) { verifyBossWallTime(timingState, req.method, args, result, now); recordBoundaryResult(state, req.method, args, now); }
      }
    } catch (error) {
      // 규칙이 거절한 호출은 상태를 바꾸지 않았으므로 저장하지 않고 거절 사유만 돌려준다.
      throw new GameCallError(422, "rejected", error instanceof Error ? error.message : String(error), error instanceof GameApiError ? error.code : undefined);
    }
    const data = saveManager.exportData(state);
    const changed = JSON.stringify(data) !== before;
    const fresh = stored === null;
    const response: GameCallResponse = { ok: true, result: result ?? null, state: data, revision: stored?.revision ?? "0" };
    if (!changed && !fresh && !req.requestId) return response;
    try {
      const committed = await deps.store.commit({
        playerId,
        expectedRevision: stored?.revision ?? null,
        data,
        method: req.method,
        requestId: req.requestId ?? null,
        response: { ok: true, result: response.result, revision: undefined, _requestFingerprint: fingerprint },
        publicProfile: publicProfile(state, playerId, now),
        raids: context ? raidChanges(context, state) : undefined,
        duels: duels?.changes,
      });
      const claimedMails = (state.claimedMailIds ?? []).filter((id) => isOpsMailId(id) && !claimedBefore.has(id)).map(opsMailUuid);
      if ((applied.length > 0 || claimedMails.length > 0) && deps.store.opsAck) await deps.store.opsAck(playerId, applied, claimedMails).catch(() => undefined);
      return { ...response, revision: committed.revision };
    } catch (error) {
      if (error instanceof StateConflictError && attempt < attempts) continue;
      if (error instanceof StateConflictError) throw new GameCallError(409, "save_conflict");
      throw error;
    }
  }
}
