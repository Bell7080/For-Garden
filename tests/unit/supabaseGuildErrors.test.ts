import { describe, expect, it } from "vitest";
import { createSupabaseGuildBackend } from "../../src/api/SupabaseGuildBackend";
import { GuildApiError, type GuildActor } from "../../src/api/guildContracts";
import { GameCallError } from "../../src/server/gameHandler";

const actor: GuildActor = { userId: "u", name: "n", level: 10, avatarRelicId: "torika", frameId: "none" };
const deck = { deck: [{}, {}, {}], lineup: [{}, {}, {}] } as never;

describe("운영 길드 백엔드의 거절 코드", () => {
  it("DB 함수가 길드 규칙 코드로 거절하면 GuildApiError로 되돌린다 — 게임 서버가 NOT_IN_GUILD를 코드로 가른다", async () => {
    const backend = createSupabaseGuildBackend(async () => { throw new GameCallError(422, "NOT_IN_GUILD"); });
    const error = await backend.syncWarStandby(actor, deck).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(GuildApiError);
    expect((error as GuildApiError).code).toBe("NOT_IN_GUILD");
  });

  it("길드 코드가 아닌 실패는 그대로 흘린다", async () => {
    const backend = createSupabaseGuildBackend(async () => { throw new Error("rpc_server_guild_call_500"); });
    const error = await backend.getGuild(actor).catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(GuildApiError);
    expect((error as Error).message).toBe("rpc_server_guild_call_500");
  });
});
