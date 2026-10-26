import { isReadMethod } from "../server/requestPolicy";
import { apiUrl } from "../core/apiBase";
import { GUILD_API_METHODS, GuildApiError, type GuildApi, type GuildErrorCode } from "./guildContracts";

/** 길드 조회·가입·직위 조작을 `/api/game`의 `guild.*` 요청으로 보낸다. 호출자는 서버가 JWT에서 정한다. */
export function createRemoteGuildApi(options: {
  getAccessToken(): Promise<string | null>;
  fetchImpl?: typeof fetch;
  newRequestId?: () => string;
}): GuildApi {
  const api = {} as Record<string, unknown>;
  for (const name of GUILD_API_METHODS)
    api[name] = async (...args: unknown[]) => {
      const token = await options.getAccessToken();
      if (!token) throw new Error("not_authenticated");
      const method = `guild.${name}`;
      const requestId = isReadMethod(method) ? undefined : (options.newRequestId?.() ?? crypto.randomUUID());
      const body = JSON.stringify({ method, args, ...(requestId ? { requestId } : {}) });
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await (options.fetchImpl ?? fetch)(apiUrl("/api/game"), { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body });
          break;
        } catch (error) { if (attempt === 1) throw error; }
      }
      const json = (await response!.json().catch(() => ({}))) as { ok?: boolean; code?: string; result?: unknown };
      if (!response!.ok || !json.ok) throw new GuildApiError((json.code ?? "UNAVAILABLE") as GuildErrorCode, json.code ?? "request_failed");
      return json.result;
    };
  return api as unknown as GuildApi;
}
