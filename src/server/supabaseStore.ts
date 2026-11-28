import { EXPEDITION_WEEKLY_RANK_POOL, EXPEDITION_WEEKLY_RANK_POOL_V2 } from "../data/expedition";
import { competitiveMonthlyOn, COMPETITIVE_MONTHLY_SINCE } from "../core/competitiveSeason";
import { DUEL_TIERS } from "../core/duelArena";
import { ANCIENT_MONTHLY_RANK_REWARDS, ARENA_MONTHLY_RANK_REWARDS, DUEL_MONTHLY_RANK_REWARDS, GUILD_WEEKLY_RANK_REWARDS, WEEKLY_RANK_GEMS, ancientMonthlyRankRewards } from "../data/competitiveRewards";
import { ARENA_TIERS, ARENA_WEEKLY_RANK_GEMS } from "../core/arenaStanding";
import { expeditionWeekKey } from "../core/expeditionBoss";
import { duelSeasonId } from "../core/duelArena";
import { contentUnlockLevel } from "../core/contentUnlock";
import type { PlayerDuelContext } from "./playerDuels";
import type { GiftContext } from "./playerGifts";
import type { OpsInbox } from "../core/opsInbox";
import { requestBudget } from "./requestPolicy";
import { refreshWindow } from "./refreshWindow";
import { sharedReadCache } from "./sharedReadCache";
import { worldRaidDefinitions, type SharedRaidContext } from "./sharedRaids";
import { GameCallError, StateConflictError, type StateStore } from "./gameHandler";

/** v2 함수가 없는 운영 DB에 넘기는 예전 원정 인양 기록 표(`WEEKLY_RANK_GEMS`와 같은 줄). 마이그레이션이 적용되면 지운다. */
const LEGACY_EXPEDITION_RANK_SALVAGE = [400, 320, 250, 180, 130, 80] as const;
/** 금칙어는 자주 바뀌지 않는다 — 함수 인스턴스 안에서 5분 동안 같은 목록을 쓴다. */
const bannedWordsCache = sharedReadCache<string[]>(300_000);
/** 운영 일정은 1분 동안 같은 값을 쓴다 — 어드민에서 바꾼 기간이 늦어도 1분 안에 서버에 닿는다. */
const scheduleCache = sharedReadCache<unknown>(60_000);
const launchAtCache = sharedReadCache<string | null>(60_000);
// 알림·가방을 읽을 때 순위 보상 정산까지 반복하지 않는다. 우편함 자체는 항상 최신을 읽는다.
const refreshRankRewards = refreshWindow(60_000);

interface Env {
  url: string;
  serviceKey: string;
  fetchImpl?: typeof fetch;
  signal?: AbortSignal;
  waitUntil?: (task: Promise<unknown>) => void;
}

async function sha256Hex(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * DB에 닿지 못한 실패인가 — `fetch failed`(TypeError: 연결 실패·응답 전 끊김)와 한 번의 시간 초과다.
 * 규칙·DB가 답한 실패는 여기 들지 않는다(그건 응답이 있다).
 */
export function isStalledConnection(error: unknown): boolean {
  return error instanceof Error && (error.name === "TypeError" || error.name === "TimeoutError");
}

/** 서비스 롤 키로 DB 함수를 부르는 저장소다. 키는 서버 환경 변수에만 있고 클라이언트로 나가지 않는다. */
export function createSupabaseStore(env: Env) {
  const f = env.fetchImpl ?? fetch;
  async function send(name: string, payload: string, timeoutMs: number): Promise<Response> {
    return f(`${env.url}/rest/v1/rpc/${name}`, {
      method: "POST",
      headers: { apikey: env.serviceKey, authorization: `Bearer ${env.serviceKey}`, "content-type": "application/json" },
      body: payload,
      signal: env.signal ? AbortSignal.any([env.signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
    });
  }
  async function rpc(name: string, body: Record<string, unknown>, background = false): Promise<unknown> {
    const payload = JSON.stringify(body);
    // 저장은 느려도 기다린다. 나머지는 한 번에 8초까지만 기다리고 **연결이 멎은 것**(응답 전 끊김·시간 초과)이면
    // 한 번 더 보낸다 — 2026-11-22 새 연결 하나가 10초 동안 서지 못해 결과 확정이 통째로 503이 되었다.
    // 저장이 실제로 들어간 뒤 답만 잃었어도 다시 보낸 저장은 revision 검사(409)에 걸리고, 처리기가 영수증을 되찾는다.
    const timeoutMs = background ? 3500 : name === "server_commit_state" ? 15000 : 8000;
    let res: Response;
    try {
      res = await send(name, payload, timeoutMs);
    } catch (error) {
      if (background || !isStalledConnection(error) || env.signal?.aborted) throw error;
      res = await send(name, payload, timeoutMs);
    }
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
      try {
        return await rpc("server_pending_friend_count", { p_player: playerId }) as number;
      } catch (error) {
        if (!(error instanceof Error) || error.message !== "rpc_server_pending_friend_count_404") throw error;
        const legacy = await rpc("server_social_call", { p_player: playerId, p_method: "getRequests", p_args: [], p_request: null }) as { incomingCount: number };
        return legacy.incomingCount;
      }
    },
    async guildReadContext(playerId) {
      return await rpc("server_guild_read_context", { p_player: playerId }) as { level: number; attendanceReady: boolean };
    },
    async expeditionContext(playerId, now) { return await rpc("server_expedition_ranking", { p_player: playerId, p_week: expeditionWeekKey(now), p_limit: 100 }) as { rank: number | null; entries: import("../api/contracts").ExpeditionLeaderboardEntry[] }; },
    async ancientRanking(playerId) { return await rpc("server_ancient_ranking", { p_player: playerId, p_limit: 100 }) as import("../api/contracts").AncientRankingResponse; },
    async duelContext(playerId, now) {
      const context = await rpc("server_duel_context", { p_player: playerId, p_season: duelSeasonId(now), p_level: contentUnlockLevel("duel") }) as PlayerDuelContext;
      return { ...context, changes: [] };
    },
    async giftContext(playerId, recipientId, now) {
      const context = await rpc("server_gift_context", { p_player: playerId, p_recipient: recipientId, p_now: now.toISOString() }) as Omit<GiftContext, "playerId" | "changes">;
      return { ...context, playerId, changes: [] };
    },
    async regularEvent() { return await rpc("server_regular_event", {}) as import("../api/contracts").RegularEventDto | null; },
    async identity(playerId) { return await rpc("server_player_identity", { p_player: playerId }) as { uid: string; createdAt: string }; },
    async raidContext(playerId, now) { return await rpc("server_raid_context", { p_player: playerId, p_worlds: worldRaidDefinitions(now) }) as SharedRaidContext; },
    async opsInbox(playerId) {
      env.waitUntil?.(refreshRankRewards(`${env.url}:${playerId}`, async () => {
        // 월간 시즌(`competitiveMonthlyOn`)은 마이그레이션 20261204000000_competitive_monthly의 두 함수를 부른다 —
        // 결투장 주간 티어·월간 순위·원정 주간 순위(v3), 아레나 주간 티어·월간 순위(v2). 모든 우편에 종류(kind)·표식(meta)이 붙는다.
        const jobs = competitiveMonthlyOn() ? [
          ["server_competitive_rewards_v3", {
            since: COMPETITIVE_MONTHLY_SINCE,
            duelTiers: DUEL_TIERS.map((tier) => ({ tier: tier.id, floor: tier.floor, ...tier.weeklyReward })),
            duelMonth: DUEL_MONTHLY_RANK_REWARDS, expedition: EXPEDITION_WEEKLY_RANK_POOL_V2,
            // 켜기 전 주의 결투장 주간 순위는 예전 표로 한 번(20261205000000_competitive_monthly_transition).
            legacyDuel: WEEKLY_RANK_GEMS,
          }],
          ["server_arena_rewards_v2", {
            since: COMPETITIVE_MONTHLY_SINCE,
            tiers: ARENA_TIERS.map((tier) => ({ tier: tier.id, floor: tier.floor, ...tier.weeklyReward })), month: ARENA_MONTHLY_RANK_REWARDS,
            legacy: {
              tiers: ARENA_TIERS.map((tier) => ({ floor: tier.floor, ...tier.weeklyReward })),
              ranks: ARENA_WEEKLY_RANK_GEMS.map((row) => ({ upTo: row.upTo, gems: row.gems })),
            },
          }],
          ["server_ancient_monthly_rewards", ancientMonthlyRankRewards(true)],
          ["server_guild_weekly_rewards", GUILD_WEEKLY_RANK_REWARDS],
        ] as const : [
          ["server_competitive_rewards_v2", { duel: WEEKLY_RANK_GEMS, expedition: EXPEDITION_WEEKLY_RANK_POOL }],
          ["server_arena_weekly_rewards", {
            tiers: ARENA_TIERS.map((tier) => ({ floor: tier.floor, ...tier.weeklyReward })),
            ranks: ARENA_WEEKLY_RANK_GEMS.map((row) => ({ upTo: row.upTo, gems: row.gems })),
          }],
          ["server_ancient_monthly_rewards", ANCIENT_MONTHLY_RANK_REWARDS],
          ["server_guild_weekly_rewards", GUILD_WEEKLY_RANK_REWARDS],
        ] as const;
        // 한 정산의 실패가 다른 정산과 우편 조회를 막지 않는다. 다음 갱신까지 재시도를 쉰다.
        for (const [name, rules] of jobs) {
          if (env.signal?.aborted) break;
          try {
            await rpc(name, { p_player: playerId, p_rules: rules }, true).catch(error => {
              if (name !== "server_competitive_rewards_v2" || !(error instanceof Error)
                || error.message !== "rpc_server_competitive_rewards_v2_404") throw error;
              return rpc("server_competitive_rewards", {
                p_player: playerId,
                p_rules: WEEKLY_RANK_GEMS.map((row, index) => ({ ...row, salvageRecord: LEGACY_EXPEDITION_RANK_SALVAGE[index] ?? 0 })),
              }, true);
            });
          } catch (error) {
            console.warn(JSON.stringify({ event: "rank_rewards_refresh_failed", rpc: name, name: error instanceof Error ? error.name : "Error" }));
          }
        }
      }));
      return await rpc("server_ops_inbox", { p_player: playerId }) as OpsInbox;
    },
    async opsAck(playerId, applied, claimedMails) { await rpc("server_ops_ack", { p_player: playerId, p_applied: applied, p_claimed_mails: claimedMails }); },
    async opsProfileAck(playerId, ids) { await rpc("server_profile_actions_ack", { p_player: playerId, p_ids: ids }); },
    async bannedWords() {
      // 닉네임을 바꿀 때만 읽는다. 5분 동안은 같은 목록을 쓰고, 마이그레이션 전 DB에는 함수가 없으므로 빈 목록이다.
      return bannedWordsCache.read(env.url, async () => {
        const value = await rpc("server_banned_words", {});
        return Array.isArray(value) ? value.filter((w): w is string => typeof w === "string") : [];
      }).catch(() => bannedWordsCache.peek(env.url) ?? []);
    },
    async liveSchedule() {
      // 실패하면(마이그레이션 전 포함) 지난 값, 없으면 빈 일정 — 정의 기간 그대로다.
      return scheduleCache.read(env.url, async () => await rpc("server_live_schedule", {}) ?? [])
        .catch(() => scheduleCache.peek(env.url) ?? []);
    },
    async launchAt() {
      // 마이그레이션(20261124000000) 전 DB에는 함수가 없다 — 그때는 지난 값, 없으면 모른다(`undefined`)로 둔다.
      return launchAtCache.read(env.url, async () => {
        const raw = await rpc("server_launch_at", {});
        return typeof raw === "string" && raw.length > 0 ? raw : null;
      }).catch(() => launchAtCache.peek(env.url));
    },
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
        p_summary: { _profile: input.publicProfile, _raids: input.raids, _duels: input.duels, ...(input.gifts?.length ? { _gifts: input.gifts } : {}), level: data.playerResearch?.level ?? 1, gems: data.wallet?.gems ?? 0, gold: data.wallet?.gold ?? 0 },
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
    /**
     * 이 기기를 그 계정의 지금 기기로 세운다. 표식이 없거나 DB에 함수가 아직 없으면(마이그레이션 20261125000000 전)
     * 막지 않는다 — 기기 확인이 없던 때와 같다.
     */
    async claimDeviceSession(playerId: string, device: string | null): Promise<boolean> {
      if (!device) return true;
      await rpc("server_claim_device_session", { p_player: playerId, p_session: device }).catch(() => undefined);
      return true;
    },
    /**
     * 표식이 지금 기기와 같은가. 세운 기기가 없거나 함수가 없으면 지난다. **세운 기기가 있는 계정은 표식 없는 호출도
     * 막는다** — 표식을 빼고 부르면 한 기기 규칙을 통째로 비껴가던 길이다(토큰을 빼낸 스크립트가 게임과 나란히 돈다).
     */
    async deviceSessionAllowed(playerId: string, device: string | null): Promise<boolean> {
      const active = await rpc("server_device_session", { p_player: playerId }).catch(() => null);
      return typeof active !== "string" || active.length === 0 || active === device;
    },
    async guildCall(playerId: string, method: string, actor: unknown, args: unknown[], requestId: string | null) {
      return rpc("server_guild_call", { p_player: playerId, p_method: method, p_actor: actor, p_args: args, p_request: requestId });
    },
    async arenaRpc(name: string, args: Record<string, unknown>) { return rpc(name, args); },
    async socialCall(playerId: string, method: string, args: unknown[], requestId?: string) {
      return rpc("server_social_call", { p_player: playerId, p_method: method, p_args: args, p_request: requestId ?? null });
    },
  });
}
