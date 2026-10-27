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

/** 씬이 공유하는 길드 진입점. 부르는 순간의 구현으로 넘긴다. */
export const guildApi: GuildApi = new Proxy({} as GuildApi, {
  get(_target, key) {
    const value = activeGuildApi[key as keyof GuildApi];
    return typeof value === "function" ? value.bind(activeGuildApi) : undefined;
  },
});
