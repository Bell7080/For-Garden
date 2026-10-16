import { StateConflictError, type StateStore } from "./gameHandler";

interface Env { url: string; serviceKey: string; fetchImpl?: typeof fetch }

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 서비스 롤 키로 DB 함수를 부르는 저장소다. 키는 서버 환경 변수에만 있고 클라이언트로 나가지 않는다. */
export function createSupabaseStore(env: Env): StateStore {
  const f = env.fetchImpl ?? fetch;
  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${env.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.status === 409) throw new StateConflictError();
    if (!res.ok) throw new Error(`rpc_${name}_${res.status}`);
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  return {
    async load(playerId) {
      const r = (await rpc("server_load_state", { p_player: playerId })) as { revision: string; data: unknown } | null;
      return r ? { revision: r.revision, data: r.data } : null;
    },
    async findReceipt(playerId, requestId) {
      const r = await rpc("server_find_receipt", { p_player: playerId, p_request: requestId });
      return r === null ? undefined : r;
    },
    async commit(input) {
      const data = input.data as { saveVersion?: number; playerResearch?: { level?: number }; wallet?: { gems?: number; gold?: number } };
      const r = (await rpc("server_commit_state", {
        p_player: input.playerId,
        p_expected_revision: input.expectedRevision === null ? null : Number(input.expectedRevision),
        p_data: input.data,
        p_hash: await sha256Hex(JSON.stringify(input.data)),
        p_version: data.saveVersion ?? 1,
        p_summary: { level: data.playerResearch?.level ?? 1, gems: data.wallet?.gems ?? 0, gold: data.wallet?.gold ?? 0 },
        p_method: input.method,
        p_request: input.requestId,
        p_response: input.response,
      })) as { revision: string };
      return { revision: r.revision };
    },
  };
}
