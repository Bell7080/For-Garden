import { prepareCombat, finishCombat } from "./combatAuthority";
import { authoritativeArgs, recordBoundaryResult, verifyBossWallTime } from "./releaseBoundary";
import type { CombatPrepare, CombatProof } from "../core/combatProtocol";
/**
 * 서버가 소유하는 게임 상태를 한 번의 호출 단위로 실행한다.
 * 규칙은 새로 쓰지 않고 FakeServer를 그대로 돌린다 — 저장된 상태를 세션으로 되살려 메서드 하나를
 * 실행하고, 바뀐 상태를 낙관적 잠금(revision)으로 다시 저장한다. 이 모듈은 Phaser·HTTP·DB를 모르고
 * 저장소(`StateStore`)와 시각·난수를 주입받으므로 단위 테스트가 그대로 서버 경로를 지난다.
 */
import { FakeServer } from "../api/FakeServer";
import { saveManager } from "../state/SaveManager";
import { createDefaultSession, type Session } from "../state/session";
import { publicProfile } from "./publicProfile";
import { raidChanges, type SharedRaidContext, type SharedRaidChange } from "./sharedRaids";
import { isReadMethod, REQUEST_ID, validCall } from "./requestPolicy";
import { isServerGameMethod } from "./gameMethods";

export interface StoredState {
  revision: string;
  data: unknown;
}

export interface StateStore {
  load(playerId: string): Promise<StoredState | null>;
  identity?(playerId: string): Promise<{ uid: string; createdAt: string }>;
  pendingRequests?(playerId: string): Promise<number>;
  raidContext?(playerId: string, now: Date): Promise<SharedRaidContext>;
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
  constructor(readonly status: number, readonly code: string, message?: string) { super(message ?? code); }
}

export interface GameHandlerDeps {
  store: StateStore;
  now?: () => Date;
  random?: () => number;
  /** 같은 계정의 동시 호출이 낙관적 잠금에서 겹칠 때 다시 시도하는 횟수다. */
  maxAttempts?: number;
  strict?: boolean;
}

// 한 프로세스 안에서는 계정별로 호출을 줄 세운다. FakeServer가 모듈 단위 싱글턴을 일부 읽으므로
// 서로 다른 계정이 한꺼번에 돌지도 않게 전역 한 줄로 직렬화한다(서버리스 인스턴스당 동시 1건).
let chain: Promise<unknown> = Promise.resolve();
function serialize<T>(task: () => Promise<T>): Promise<T> {
  const next = chain.then(task, task);
  chain = next.catch(() => undefined);
  return next;
}



export function handleGameCall(playerId: string, req: GameCallRequest, deps: GameHandlerDeps): Promise<GameCallResponse> {
  if (!validCall(req)) throw new GameCallError(400, "invalid_request");
  if (deps.strict && !isReadMethod(req.method) && !req.requestId) throw new GameCallError(400, "request_id_required");
  if (!isServerGameMethod(req?.method)) throw new GameCallError(400, "unknown_method");
  if (req.args !== undefined && !Array.isArray(req.args)) throw new GameCallError(400, "invalid_args");
  if (req.args && req.args.length > 4) throw new GameCallError(400, "invalid_args");
  if (req.requestId !== undefined && !REQUEST_ID.test(req.requestId)) throw new GameCallError(400, "invalid_request_id");
  return serialize(() => run(playerId, req, deps));
}

async function run(playerId: string, req: GameCallRequest, deps: GameHandlerDeps): Promise<GameCallResponse> {
  const attempts = deps.maxAttempts ?? 3;
  const fingerprint = JSON.stringify([req.method, req.args ?? []]);
  for (let attempt = 1; ; attempt += 1) {
    if (req.requestId) {
      const cached = await deps.store.findReceipt(playerId, req.requestId);
      if (cached !== undefined) {
        const receipt = cached as GameCallResponse & { _requestFingerprint?: string };
        if (receipt._requestFingerprint !== fingerprint) throw new GameCallError(409, "request_id_conflict");
        const { _requestFingerprint, ...response } = receipt;
        return response;
      }
    }
    const stored = await deps.store.load(playerId);
    let state: Session;
    try {
      state = stored ? saveManager.parse(stored.data) : createDefaultSession();
    } catch {
      throw new GameCallError(500, "corrupt_state");
    }
    const before = JSON.stringify(saveManager.exportData(state));
    const now = deps.now?.() ?? new Date();
    if (deps.store.identity) {
      const identity = await deps.store.identity(playerId);
      state.playerCard.uid = identity.uid;
      state.playerCard.createdAt = identity.createdAt;
    }
    const context = /^(getRaids|summonRaid|enterRaid|submitRaidDamage|settleRaid)$/.test(req.method) && deps.store.raidContext ? await deps.store.raidContext(playerId, now) : undefined;
    if (context) state.raid.instances = context.records.map(row => structuredClone(row.instance));
    const server = new FakeServer(state, {
      latencyMs: 0,
      random: deps.random ?? Math.random,
      ...(deps.now ? { now: deps.now } : {}),
      persistSession: () => undefined,
      raidContext: context,
    });
    let result: unknown;
    try {
      const timingState = deps.strict && (req.method === "submitRaidDamage" || req.method === "submitExpeditionBossScore") ? structuredClone(state) : state;
      const args = deps.strict ? authoritativeArgs(state, req.method, req.args ?? []) : req.args ?? [];
      if (req.method === "prepareCombat") result = prepareCombat(state, args[0] as CombatPrepare, now, globalThis.crypto.randomUUID());
      else if (req.method === "finishCombat") result = finishCombat(state, args[0] as CombatProof, now);
      else {
        result = await (server as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>)[req.method](...args);
        if (req.method === "getNotificationSignals" && deps.store.pendingRequests) result = { ...(result as object), pendingFriendRequestCount: await deps.store.pendingRequests(playerId) };
        if (deps.strict) { verifyBossWallTime(timingState, req.method, args, result, now); recordBoundaryResult(state, req.method, args, now); }
      }
    } catch (error) {
      // 규칙이 거절한 호출은 상태를 바꾸지 않았으므로 저장하지 않고 거절 사유만 돌려준다.
      throw new GameCallError(422, "rejected", error instanceof Error ? error.message : String(error));
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
        response: { ...response, revision: undefined, _requestFingerprint: fingerprint },
        publicProfile: publicProfile(state, playerId, now),
        raids: context ? raidChanges(context, state) : undefined,
      });
      return { ...response, revision: committed.revision };
    } catch (error) {
      if (error instanceof StateConflictError && attempt < attempts) continue;
      if (error instanceof StateConflictError) throw new GameCallError(409, "save_conflict");
      throw error;
    }
  }
}
