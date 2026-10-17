/**
 * 서버가 상태를 소유하는 GameApi 구현이다. 메서드 호출은 모두 `/api/game` 한 곳으로 가고, 응답에 실린
 * 호출 뒤의 전체 상태를 로컬 세션에 반영한다. 규칙은 서버가 FakeServer 그대로 실행하므로 여기에는 없다.
 * 인증 토큰은 `getAccessToken`이 보안 저장소에서 그때그때 꺼내 주며 이 클래스는 보관하지 않는다.
 */
import { isReadMethod } from "../server/requestPolicy";
import { SERVER_GAME_METHODS } from "../server/gameMethods";
import { saveManager } from "../state/SaveManager";
import type { Session } from "../state/session";
import type { GameApi } from "./contracts";

export interface RemoteGameApiOptions {
  endpoint?: string;
  getAccessToken: () => Promise<string | null>;
  /** 서버 상태를 로컬 세션에 덮어쓴다. 기본은 공유 세션이다. */
  applyState: (next: Session) => void;
  fetchImpl?: typeof fetch;
  newRequestId?: () => string;
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
  const endpoint = options.endpoint ?? "/api/game";
  const newId = options.newRequestId ?? defaultRequestId;

  async function call(method: string, args: unknown[]): Promise<unknown> {
    const token = await options.getAccessToken();
    if (!token) throw new RemoteGameApiError(401, "not_authenticated");
    const requestId = isReadMethod(method) ? undefined : newId();
    const body = JSON.stringify({ method, args, ...(requestId ? { requestId } : {}) });
    let lastError: unknown;
    // 네트워크 단절은 같은 requestId로 재전송해도 서버가 한 번만 반영한다.
    for (let attempt = 0; attempt < 2; attempt += 1) {
      let res: Response;
      try {
        res = await doFetch(endpoint, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body });
      } catch (error) {
        lastError = error;
        continue;
      }
      const json = (await res.json().catch(() => null)) as { ok?: boolean; result?: unknown; state?: unknown; code?: string; message?: string } | null;
      if (!res.ok || !json?.ok) throw new RemoteGameApiError(res.status, json?.code ?? "request_failed", json?.message);
      const revision = Number((json as { revision?: unknown }).revision);
      if (!Number.isFinite(revision) || revision >= appliedRevision) {
        if (Number.isFinite(revision)) appliedRevision = revision;
        options.applyState(saveManager.parse(json.state));
      }
      return json.result;
    }
    throw lastError instanceof Error ? lastError : new RemoteGameApiError(0, "network");
  }

  const api: Record<string, unknown> = {};
  for (const name of SERVER_GAME_METHODS) api[name] = (...args: unknown[]) => call(name, args);
  return api as unknown as GameApi;
}
