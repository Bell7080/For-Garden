import { QA_GUILD_AUTO_JOIN, QA_TOOLS_ENABLED } from "../core/buildFlavor";
import { session } from "../state/session";
import { localGuildBackend } from "./FakeGuildServer";
import { guildActorFrom } from "./guildActor";
import { GUILD_API_METHODS, type GuildApi, type GuildBackend } from "./guildContracts";

/** 이 기기의 임시 구현 — 하나뿐인 플레이어(`local-player`)를 호출자로 백엔드에 바인딩한다. */
function bindLocal(backend: GuildBackend): GuildApi {
  const api = {} as Record<string, unknown>;
  for (const name of GUILD_API_METHODS)
    api[name] = (...args: unknown[]) => (backend[name] as (...a: unknown[]) => unknown)(guildActorFrom(session, "local-player"), ...args);
  return api as unknown as GuildApi;
}

const localGuildApi: GuildApi = bindLocal(localGuildBackend);
let activeGuildApi: GuildApi = localGuildApi;

/** 서버가 길드를 소유하는 구현으로 갈아 끼운다. `null`이면 이 기기의 임시 구현으로 돌아간다. */
export function installGuildApi(api: GuildApi | null): void { activeGuildApi = api ?? localGuildApi; }

/**
 * QA 전용 — 서버가 연결된 QA 빌드에서도 길드만 이 기기의 임시 구현(표본 길드·길드원)으로 돌린다.
 * 일반 빌드에서는 켤 수 없다. 지갑이 얽힌 조작(만들기·출석·상점)은 `gameApi`가 서버로 보내므로 이 모드에서는 쓰지 않는다.
 */
let guildSandbox = QA_GUILD_AUTO_JOIN;
export function setGuildSandbox(on: boolean): void { guildSandbox = QA_TOOLS_ENABLED && on; }
export const isGuildSandbox = (): boolean => guildSandbox;

/** QA 빌드는 처음 길드에 닿는 순간 표본 길드 「포가든 수호대」의 길드장으로 앉는다(한 번만 — 탈퇴하면 그대로 둔다). */
let qaAutoJoined = false;
/** 표본 길드 중 첫째(「포가든 수호대」 — 16명·길드전 점수가 있어 두 판을 다 열 수 있다). */
export const QA_AUTO_GUILD_ID = "sample-1";
export function ensureQaGuildMembership(): void {
  if (!QA_GUILD_AUTO_JOIN || qaAutoJoined || !guildSandbox) return;
  qaAutoJoined = true;
  localGuildBackend.qaJoinAsLeader(guildActorFrom(session, "local-player"), QA_AUTO_GUILD_ID);
}

/** 씬이 공유하는 길드 진입점. 부르는 순간의 구현으로 넘긴다. */
export const guildApi: GuildApi = new Proxy({} as GuildApi, {
  get(_target, key) {
    if (guildSandbox) ensureQaGuildMembership();
    const target = guildSandbox ? localGuildApi : activeGuildApi;
    const value = target[key as keyof GuildApi];
    return typeof value === "function" ? value.bind(target) : undefined;
  },
});
