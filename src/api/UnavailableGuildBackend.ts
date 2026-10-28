import { GuildApiError, GUILD_API_METHODS, type GuildBackend } from "./guildContracts";

/** 길드 저장소가 없는 서버 설정의 자리 — 성공을 흉내 내지 않고 모든 조작을 `UNAVAILABLE`로 거절한다. */
export function createUnavailableGuildBackend(): GuildBackend {
  const refuse = async (): Promise<never> => { throw new GuildApiError("UNAVAILABLE", "UNAVAILABLE"); };
  const backend = {} as Record<string, unknown>;
  for (const name of [...GUILD_API_METHODS, "createGuild", "changeBadge", "stampAttendance", "purchase", "recordGuard", "placeWarDefense"]) backend[name] = refuse;
  return backend as unknown as GuildBackend;
}
