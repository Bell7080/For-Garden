import { GuildApiError, GUILD_API_METHODS, type GuildApiMethod, type GuildBackend } from "./guildContracts";

/**
 * `GuildApi` 밖에서 게임 서버만 부르는 길드 조작. **표가 아니라 키 집합**으로 적어 `GuildBackend`에 조작이
 * 늘면 여기서 타입 오류가 난다 — 문자열 목록이던 때는 `syncWarStandby`·`beginWarAttack`·`recordWarAttack`·`claimWeeklyRankRewards`가
 * 빠진 채 남아, 길드 저장소가 없는 서버에서 로비에 들어서기만 해도 `is not a function`이 422로 새었다.
 */
const SERVER_ONLY_METHODS: Record<Exclude<keyof GuildBackend, GuildApiMethod>, true> = {
  createGuild: true, changeBadge: true, renameGuild: true, stampAttendance: true, purchase: true, recordGuard: true,
  placeWarDefense: true, syncWarStandby: true, beginWarAttack: true, recordWarAttack: true, claimWeeklyRankRewards: true,
};

/** 길드 저장소가 없는 서버 설정의 자리 — 성공을 흉내 내지 않고 모든 조작을 `UNAVAILABLE`로 거절한다. */
export function createUnavailableGuildBackend(): GuildBackend {
  const refuse = async (): Promise<never> => { throw new GuildApiError("UNAVAILABLE", "UNAVAILABLE"); };
  const backend = {} as Record<string, unknown>;
  for (const name of [...GUILD_API_METHODS, ...Object.keys(SERVER_ONLY_METHODS)]) backend[name] = refuse;
  return backend as unknown as GuildBackend;
}
