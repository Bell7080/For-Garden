import { EXPEDITION_WEEKLY_RANK_REWARDS } from "../data/expedition";
import { WEEKLY_RANK_GEMS } from "../data/competitiveRewards";
import { expeditionWeekKey } from "../core/expeditionBoss";
import { duelSeasonId } from "../core/duelArena";
import { contentUnlockLevel } from "../core/contentUnlock";
import type { PlayerDuelContext } from "./playerDuels";
import type { OpsInbox } from "../core/opsInbox";
import { requestBudget } from "./requestPolicy";
import { worldRaidDefinitions, type SharedRaidContext } from "./sharedRaids";
import { GameCallError, StateConflictError, type StateStore } from "./gameHandler";

interface Env { url: string; serviceKey: string; fetchImpl?: typeof fetch }

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** 서비스 롤 키로 DB 함수를 부르는 저장소다. 키는 서버 환경 변수에만 있고 클라이언트로 나가지 않는다. */
export function createSupabaseStore(env: Env) {
  const f = env.fetchImpl ?? fetch;
  async function rpc(name: string, body: Record<string, unknown>): Promise<unknown> {
    const res = await f(`${env.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}`, "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });
    if (res.status === 409 && name === "server_commit_state") throw new StateConflictError();
    if (!res.ok) {
      const body = await res.json().catch(() => null) as { message?: string } | null;
      if ([400,403,409,422,429].includes(res.status)) throw new GameCallError(res.status, body?.message ?? "rejected");
      throw new Error(`rpc_${name}_${res.status}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }
  const store: StateStore = {
    async pendingRequests(playerId) {
      const response = await rpc("server_social_call", { p_player: playerId, p_method: "getRequests", p_args: [], p_request: null }) as { incomingCount: number };
      return response.incomingCount;
    },
    async expeditionContext(playerId, now) { return await rpc("server_expedition_ranking", { p_player: playerId, p_week: expeditionWeekKey(now), p_limit: 100 }) as { rank: number | null; entries: import("../api/contracts").ExpeditionLeaderboardEntry[] }; },
    async duelContext(playerId, now) {
      const context = await rpc("server_duel_context", { p_player: playerId, p_season: duelSeasonId(now), p_level: contentUnlockLevel("duel") }) as PlayerDuelContext;
      return { ...context, changes: [] };
    },
    async identity(playerId) { return await rpc("server_player_identity", { p_player: playerId }) as { uid: string; createdAt: string }; },
    async raidContext(playerId, now) { return await rpc("server_raid_context", { p_player: playerId, p_worlds: worldRaidDefinitions(now) }) as SharedRaidContext; },
    async opsInbox(playerId) {
      await rpc("server_competitive_rewards", { p_player: playerId, p_rules: WEEKLY_RANK_GEMS.map((row, index) => ({ ...row, salvageRecord: EXPEDITION_WEEKLY_RANK_REWARDS[index].rewards.salvageRecord ?? 0 })) });
      return await rpc("server_ops_inbox", { p_player: playerId }) as OpsInbox;
    },
    async opsAck(playerId, applied, claimedMails) { await rpc("server_ops_ack", { p_player: playerId, p_applied: applied, p_claimed_mails: claimedMails }); },
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
        p_summary: { _profile: input.publicProfile, _raids: input.raids, _duels: input.duels, level: data.playerResearch?.level ?? 1, gems: data.wallet?.gems ?? 0, gold: data.wallet?.gold ?? 0 },
        p_method: input.method,
        p_request: input.requestId,
        p_response: input.response,
      })) as { revision: string };
      return { revision: r.revision };
    },
  };
  return Object.assign(store, {
    async takeRate(playerId: string, method: string) {
      const budget = requestBudget(method);
      for (const [bucket, window, limit] of [["all",60,300],[method,budget.windowSeconds,budget.limit]] as const) {
        const out = await rpc("server_take_rate", { p_player: playerId, p_bucket: bucket, p_window: window, p_limit: limit }) as { allowed: boolean; retryAfter: number };
        if (!out.allowed) return out;
      }
      return { allowed: true, retryAfter: 0 };
    },
    async guildCall(playerId: string, method: string, actor: unknown, args: unknown[], requestId: string | null) {
      return rpc("server_guild_call", { p_player: playerId, p_method: method, p_actor: actor, p_args: args, p_request: requestId });
    },
    async socialCall(playerId: string, method: string, args: unknown[], requestId?: string) {
      return rpc("server_social_call", { p_player: playerId, p_method: method, p_args: args, p_request: requestId ?? null });
    },
  });
}
