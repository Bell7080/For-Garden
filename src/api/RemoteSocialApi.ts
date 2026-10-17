import { isReadMethod } from "../server/requestPolicy";
import {
  SocialApiError,
  type SocialApi,
  type SocialErrorCode,
} from "./FakeSocialServer";

export const SOCIAL_METHODS = [
  "getFriends",
  "getRequests",
  "searchUsers",
  "getRecommendations",
  "sendRequest",
  "cancelRequest",
  "acceptRequest",
  "declineRequest",
  "acceptAllRequests",
  "declineAllRequests",
  "setFavorite",
  "removeFriend",
  "rentFavoriteRelic",
] as const;
export type SocialMethod = (typeof SOCIAL_METHODS)[number];
export const isSocialMethod = (value: string): value is SocialMethod =>
  (SOCIAL_METHODS as readonly string[]).includes(value);

/** 실제 친구 관계와 대여는 인증된 서버에서만 확정한다. 로비 신호는 최근 서버 응답의 받은 신청 수다. */
export function createRemoteSocialApi(options: {
  getAccessToken(): Promise<string | null>;
  fetchImpl?: typeof fetch;
  newRequestId?: () => string;
}): SocialApi {
  const listeners = new Set<() => void>();
  let incoming = 0;
  const api = {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    pendingRequestCount() {
      return incoming;
    },
  } as SocialApi;
  for (const name of SOCIAL_METHODS)
    (api as unknown as Record<string, unknown>)[name] = async (
      ...args: unknown[]
    ) => {
      const token = await options.getAccessToken();
      if (!token) throw new Error("not_authenticated");
      const method = `social.${name}`;
      const requestId = isReadMethod(method)
        ? undefined
        : (options.newRequestId?.() ?? crypto.randomUUID());
      const body = JSON.stringify({
        method,
        args,
        ...(requestId ? { requestId } : {}),
      });
      let response: Response | undefined;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          response = await (options.fetchImpl ?? fetch)("/api/game", {
            method: "POST",
            headers: {
              authorization: `Bearer ${token}`,
              "content-type": "application/json",
            },
            body,
          });
          break;
        } catch (error) {
          if (attempt === 1) throw error;
        }
      }
      const json = (await response!.json()) as {
        ok?: boolean;
        code?: string;
        result?: unknown;
        incomingCount?: number;
      };
      if (!response!.ok || !json.ok)
        throw new SocialApiError(
          json.code as SocialErrorCode,
          json.code ?? "request_failed",
        );
      if (
        typeof json.incomingCount === "number" &&
        incoming !== json.incomingCount
      ) {
        incoming = json.incomingCount;
        listeners.forEach((listener) => listener());
      }
      return json.result;
    };
  return api;
}
