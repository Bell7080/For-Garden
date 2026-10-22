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
}
let tokenProvider: (() => Promise<string | null>) | null = null;
let generation = 0;
export function installArenaApi(provider: (() => Promise<string | null>) | null): void { tokenProvider = provider; generation++; void connectArenaRealtime(provider).catch(() => undefined); }
export function arenaAvailable(): boolean { return tokenProvider !== null; }
export async function arenaCall(kind = 'status', options: {
    roomId?: string;
    target?: string;
    rules?: ArenaRules;
    action?: ArenaAction;
} = {}): Promise<ArenaStatus> {
    const current = generation, provider = tokenProvider;
    if (!provider)
        throw Error('ARENA_OFFLINE');
    const token = await provider();
    if (!token || generation !== current)
        throw Error('ARENA_OFFLINE');
    const body = JSON.stringify({ method: kind === 'status' ? 'arena.get' : 'arena.act', args: [{ kind, ...options }], ...(kind === 'status' ? {} : { requestId: crypto.randomUUID() }) });
    let last: unknown;
    for (let i = 0; i < 2; i++) {
        try {
            const response = await fetch('/api/game', { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(15000) });
            const data = await response.json() as {
                ok: boolean;
                code?: string;
                result: ArenaStatus;
            };
            if (!response.ok || !data.ok) {
                if (response.status >= 500 && i === 0)
                    continue;
                throw Error(data.code ?? 'ARENA_NETWORK');
            }
            if (generation !== current)
                throw Error('ARENA_OFFLINE');
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
