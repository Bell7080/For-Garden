/**
 * 서버가 상태를 소유하는 GameApi 구현이다. 메서드 호출은 모두 `/api/game` 한 곳으로 가고, 응답에 실린
 * 호출 뒤의 전체 상태를 로컬 세션에 반영한다. 규칙은 서버가 FakeServer 그대로 실행하므로 여기에는 없다.
 * 인증 토큰은 `getAccessToken`이 보안 저장소에서 그때그때 꺼내 주며 이 클래스는 보관하지 않는다.
 */
import { apiUrl } from "../core/apiBase";
import { timeoutSignal } from "../core/timeoutSignal";
import { isReadMethod } from "../server/requestPolicy";
import { SERVER_GAME_METHODS } from "../server/gameMethods";
import { saveManager } from "../state/SaveManager";
import type { Session } from "../state/session";
import { GameApiError, type ApiErrorCode, type GameApi } from "./contracts";
import { markRemoteStateResult } from "./resultState";
import { reportAccountDeleted } from "./accountDeleted";
import { apiFailureSink } from "./apiFailureSink";

export interface RemoteGameApiOptions {
  endpoint?: string;
  getAccessToken: () => Promise<string | null>;
  /** 서버 상태를 로컬 세션에 덮어쓴다. 기본은 공유 세션이다. */
  applyState: (next: Session) => void;
  fetchImpl?: typeof fetch;
  newRequestId?: () => string;
}

/** 같은 조회의 답을 다시 쓰는 시간이다. 쓰기가 나가면 곧바로 비운다. */
const READ_REUSE_MS = 1500;


/** 서버가 규칙으로 거절한 호출이 아니라 **서버 오류·예상 밖 응답**일 때만 보고한다(재시도 소동·인증 만료·충돌 제외). */
function reportApiFailure(method: string, error: unknown): void {
  const status = error instanceof RemoteGameApiError ? error.status : 0;
  const code = error instanceof RemoteGameApiError ? error.code : "";
  if (status === 0 || status === 401 || status === 403 || status === 408 || code === "save_conflict" || code === "stale_response") return;
  apiFailureSink.report?.(`api.${status >= 500 ? "5xx" : "4xx"}`, error, { method, status, code });
}

export class RemoteGameApiError extends Error {
  constructor(readonly status: number, readonly code: string, message?: string) { super(message ?? code); }
}

// 상태를 바꾸지 않는 조회는 재전송 키가 필요 없다.


function defaultRequestId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function createRemoteGameApi(options: RemoteGameApiOptions): GameApi {
  // 동시에 나간 호출의 응답이 뒤바뀌어 도착해도 더 오래된 상태가 새 상태를 덮지 않게 한다.
  let appliedRevision = -1;
  const doFetch = options.fetchImpl ?? fetch;
  const endpoint = options.endpoint ?? apiUrl("/api/game");
  const newId = options.newRequestId ?? defaultRequestId;
  // 같은 조회가 화면 전환 때 겹쳐 나가면 한 번만 보내고, 쓰기가 상태를 바꾸기 전까지는 잠깐 그 답을 다시 쓴다.
  const retryIds = new Map<string, string>();
  const inflightReads = new Map<string, { at: number; promise: Promise<unknown> }>();
  const inflightWrites = new Map<string, Promise<unknown>>();

  async function call(method: string, args: unknown[], staleRetries = 0): Promise<unknown> {
    const token = await options.getAccessToken();
    if (!token) throw new RemoteGameApiError(401, "not_authenticated");
    // 응답이 오지 않은 쓰기를 다시 부를 때는 같은 키를 쓴다 — 서버가 첫 호출을 이미 확정했다면 새 키는 "처음 하는 일"로
    // 읽혀 거절당하고(승리 확정이 그렇다), 받은 초회 보상도 화면에 닿지 못한 채 다시 시도만 되풀이된다.
    const callKey = isReadMethod(method) ? "" : JSON.stringify([method, args]);
    const kept = retryIds.get(callKey);
    const requestId = isReadMethod(method) ? undefined : (kept ?? newId());
    if (requestId && callKey) retryIds.set(callKey, requestId);
    const body = JSON.stringify({ method, args, ...(requestId ? { requestId } : {}) });
    let lastError: unknown;
    const signal = timeoutSignal(35000);
    // 네트워크 단절은 같은 requestId로 재전송해도 서버가 한 번만 반영한다.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let res: Response;
      try {
        res = await doFetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body, signal });
      } catch (error) {
        lastError = error;
        if (signal.aborted) break;
        continue;
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; state?: unknown; code?: string; domainCode?: ApiErrorCode; message?: string } | null;
      // 서버가 규칙으로 거절한 호출(4xx)은 끝난 일이다. 시간 초과·서버 오류(5xx)는 확정되었는지 모르므로 키를 남긴다.
      if (!res.ok || !json?.ok) {
        const retryable = res.status === 408 || res.status >= 500
          || (res.status === 409 && json?.code === "save_conflict")
          || (res.ok && json === null);
        if (res.status >= 400 && res.status < 500 && !retryable && callKey) retryIds.delete(callKey);
        if (res.status === 403 && json?.code === "account_deleted") reportAccountDeleted();
        if (res.status === 422 && json?.domainCode) throw new GameApiError(json.domainCode, json.message ?? json.domainCode);
        const error = new RemoteGameApiError(res.status, json?.code ?? "request_failed", json?.message);
        if (retryable && attempt === 0 && !signal.aborted) {
          lastError = error;
          // 저장 직후 게이트웨이 응답만 유실된 경우도 같은 키로 영수증을 되찾는다.
          await new Promise(resolve => setTimeout(resolve, 250));
          if (signal.aborted) break;
          continue;
        }
        reportApiFailure(method, error);
        throw error;
      }
      const revision = Number((json as { revision?: unknown }).revision);
      if (Number.isFinite(revision) && revision < appliedRevision && isReadMethod(method)) {
        // 오래된 DTO도 반환하지 않는다. 최신 조회를 다시 받아 화면과 Manager 모두 같은 시점을 읽는다.
        if (staleRetries >= 2) throw new RemoteGameApiError(409, "stale_response");
        return call(method, args, staleRetries + 1);
      }
      if (!Number.isFinite(revision) || revision >= appliedRevision) {
        if (Number.isFinite(revision)) appliedRevision = revision;
        options.applyState(saveManager.parse(json.state));
      }
      markRemoteStateResult(json.result);
      if (callKey) retryIds.delete(callKey);
      return json.result;
    }
    reportApiFailure(method, lastError);
    throw lastError instanceof Error ? lastError : new RemoteGameApiError(0, "network");
  }

  async function callCached(method: string, args: unknown[]): Promise<unknown> {
    const key = JSON.stringify([method, args]);
    const hit = inflightReads.get(key);
    if (hit && Date.now() - hit.at < READ_REUSE_MS) return hit.promise;
    const promise = call(method, args);
    inflightReads.set(key, { at: Date.now(), promise });
    // 실패한 답은 남기지 않는다. 다음 호출이 새로 묻는다.
    promise.catch(() => { if (inflightReads.get(key)?.promise === promise) inflightReads.delete(key); });
    return promise;
  }

  function callWrite(method: string, args: unknown[]): Promise<unknown> {
    const key = JSON.stringify([method, args]);
    const pending = inflightWrites.get(key);
    if (pending) return pending;
    inflightReads.clear();
    // 같은 결과 확정이 겹치면 요청·상태 반영·실패 복구까지 하나의 Promise를 공유한다.
    // 성공한 호출이 재시도 키를 지운 뒤 다른 호출이 실패하는 경합도 막는다.
    const promise = call(method, args).finally(() => {
      inflightWrites.delete(key);
      inflightReads.clear();
    });
    inflightWrites.set(key, promise);
    return promise;
  }

  const api: Record<string, unknown> = {};
  for (const name of SERVER_GAME_METHODS) {
    api[name] = isReadMethod(name)
      ? (...args: unknown[]) => callCached(name, args)
      : (...args: unknown[]) => callWrite(name, args);
  }
  return api as unknown as GameApi;
}
