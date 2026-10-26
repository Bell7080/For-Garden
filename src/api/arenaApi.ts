import { apiEndpoint } from "../core/appRuntime";
import { t } from "../i18n";
import { connectArenaRealtime } from "./arenaRealtime";
import type { ArenaRoom, ArenaRules, ArenaAction } from '../core/liveArena';
export interface ArenaStatus {
    playerId: string;
    score: number;
    wins: number;
    losses: number;
    queuedAt?: string;
    room: ArenaRoom | null;
    incoming: ArenaRoom[];
    /** 입구 조회와 끝난 판에서만 온다(`server_arena_standing`). 옛 서버는 비워 둔다. */
    winStreak?: number;
    bestStreak?: number;
    bestScore?: number;
    nextStreakBonus?: number;
    rank?: number | null;
    weekEndsAt?: string;
    serverTime?: string;
    lastWeek?: { score: number; rank: number | null } | null;
}
/** 내 자리만 — 로비 프로필이 방 잠금 없이 읽는다. */
export type ArenaStandingStatus = Required<Pick<ArenaStatus, 'score' | 'wins' | 'losses' | 'winStreak' | 'bestStreak' | 'bestScore' | 'nextStreakBonus' | 'rank' | 'weekEndsAt' | 'serverTime' | 'lastWeek'>>;
export interface ArenaRankingEntry { rank: number; playerId: string; displayName: string; score: number; isMe: boolean; favoriteRelicId?: string }
export interface ArenaRankingStatus { rank: number | null; entries: ArenaRankingEntry[] }
const READ_KINDS = new Set(['status', 'standing', 'ranking']);
let lastStanding: { score: number; played: boolean } | null = null;
/** 마지막으로 받은 내 RP. 프로필이 아레나에 다녀온 뒤 다시 묻지 않고 곧바로 읽는다. 한 판도 안 했으면 null이다. */
export function cachedArenaScore(): number | null { return lastStanding?.played ? lastStanding.score : null; }
/** 이번 접속에서 내 RP를 한 번이라도 받았는가 — 한 판도 안 한 계정을 매번 다시 묻지 않는다. */
export function arenaStandingKnown(): boolean { return lastStanding !== null; }
function remember(result: { score?: unknown; wins?: unknown; losses?: unknown }): void {
    if (typeof result.score !== 'number') return;
    lastStanding = { score: result.score, played: Number(result.wins ?? 0) + Number(result.losses ?? 0) > 0 };
}
export async function arenaStanding(): Promise<ArenaStandingStatus> { return await arenaRequest('standing') as ArenaStandingStatus; }
export async function arenaRanking(): Promise<ArenaRankingStatus> { return await arenaRequest('ranking') as ArenaRankingStatus; }
let tokenProvider: (() => Promise<string | null>) | null = null;
/** 마지막으로 쓴 토큰 — 창이 닫히는 순간에는 토큰을 기다릴 수 없어 이것으로 기권을 보낸다. */
let lastToken: string | null = null;
let generation = 0;
export function installArenaApi(provider: (() => Promise<string | null>) | null): void { tokenProvider = provider; generation++; lastStanding = null; lastToken = null; void connectArenaRealtime(provider).catch(() => undefined); }
export function arenaAvailable(): boolean { return tokenProvider !== null; }
export async function arenaCall(kind = 'status', options: {
    roomId?: string;
    target?: string;
    rules?: ArenaRules;
    action?: ArenaAction;
} = {}): Promise<ArenaStatus> {
    return await arenaRequest(kind, options) as ArenaStatus;
}
async function arenaRequest(kind: string, options: Record<string, unknown> = {}): Promise<unknown> {
    const current = generation, provider = tokenProvider;
    if (!provider)
        throw Error('ARENA_OFFLINE');
    const token = await provider();
    if (!token || generation !== current)
        throw Error('ARENA_OFFLINE');
    lastToken = token;
    const read = READ_KINDS.has(kind);
    const body = JSON.stringify({ method: read ? 'arena.get' : 'arena.act', args: [{ kind, ...options }], ...(read ? {} : { requestId: crypto.randomUUID() }) });
    let last: unknown;
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch(apiEndpoint('/api/game'), { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(15000) });
            const data = await response.json() as {
                ok: boolean;
                code?: string;
                result: unknown;
            };
            if (!response.ok || !data.ok) {
                if (response.status >= 500 && i === 0)
                    continue;
                throw Error(data.code ?? 'ARENA_NETWORK');
            }
            if (generation !== current)
                throw Error('ARENA_OFFLINE');
            if (data.result && typeof data.result === 'object') remember(data.result as { score?: unknown });
            return data.result;
        }
        catch (e) {
            last = e;
            if (i === 1 || (e instanceof Error && /^ARENA_/.test(e.message)))
                throw e;
        }
    }
    throw last;
}
/**
 * 창을 닫거나 다른 페이지로 떠나는 순간 밴·배치 중인 방을 기권으로 끝낸다(`keepalive` — 페이지가 내려가도 요청은 간다).
 * 앱을 잠깐 내린 것만으로는 보내지 않는다 — 그 경우는 서버의 침묵 규칙(`ARENA_ABSENCE_MS`)이 맡는다.
 */
export function arenaForfeitOnExit(roomId: string): void {
    if (!lastToken) return;
    const body = JSON.stringify({ method: 'arena.act', args: [{ kind: 'action', roomId, action: { kind: 'forfeit' } }], requestId: crypto.randomUUID() });
    void fetch(apiEndpoint('/api/game'), { method: 'POST', keepalive: true, headers: { authorization: `Bearer ${lastToken}`, 'content-type': 'application/json' }, body }).catch(() => undefined);
}
export function arenaError(error: unknown): string {
    const code = error instanceof Error ? error.message : '';
    if (code === 'ARENA_ROSTER' || code === 'ARENA_OPPONENT_ROSTER')
        return t("arena.error.roster");
    if (code === 'ARENA_BUSY')
        return t("arena.error.busy");
    if (code === 'ARENA_INVITE_EXPIRED')
        return t("arena.error.expired");
    if (code === 'ARENA_TURN')
        return t("arena.error.turn");
    if (code === 'ARENA_PLACEMENT')
        return t("arena.error.placement");
    if (code === 'ARENA_OFFLINE')
        return t("arena.error.offline");
    if (code === 'ARENA_INVITE_COOLDOWN')
        return t("arena.error.cooldown");
    return t("arena.error.connection");
}
