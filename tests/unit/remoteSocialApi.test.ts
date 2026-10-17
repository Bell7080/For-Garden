import { describe, it, expect, vi } from "vitest";
import { createRemoteSocialApi } from "../../src/api/RemoteSocialApi";
import { SocialApiError } from "../../src/api/FakeSocialServer";

describe("실제 친구 API", () => {
  it("재전송은 같은 요청 ID와 본문을 유지하고 신청 수 신호를 갱신한다", async () => {
    const bodies: string[] = [];
    const f = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
      bodies.push(String(options?.body));
      if (bodies.length === 1) throw new Error("lost response");
      return new Response(
        JSON.stringify({
          ok: true,
          result: { relation: "outgoing" },
          incomingCount: 2,
        }),
      );
    });
    const api = createRemoteSocialApi({
      getAccessToken: async () => "user-token",
      fetchImpl: f,
      newRequestId: () => "request-test-1",
    });
    const listener = vi.fn();
    const stop = api.subscribe(listener);
    await expect(api.sendRequest("other-user")).resolves.toEqual({
      relation: "outgoing",
    });
    expect(bodies[0]).toBe(bodies[1]);
    expect(JSON.parse(bodies[0]).method).toBe("social.sendRequest");
    expect(api.pendingRequestCount()).toBe(2);
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
  });
  it("조회는 키를 만들지 않고 서버의 제한 오류를 그대로 전달한다", async () => {
    const f = vi.fn(async (_url: RequestInfo | URL, options?: RequestInit) => {
      const call = JSON.parse(String(options?.body));
      expect(call.requestId).toBeUndefined();
      return new Response(JSON.stringify({ ok: false, code: "rate_limited" }), {
        status: 429,
      });
    });
    const api = createRemoteSocialApi({
      getAccessToken: async () => "user-token",
      fetchImpl: f,
    });
    await expect(api.getFriends()).rejects.toBeInstanceOf(SocialApiError);
  });
  it("인증 없이 임시 친구로 폴백하지 않는다", async () => {
    const f = vi.fn();
    const api = createRemoteSocialApi({
      getAccessToken: async () => null,
      fetchImpl: f,
    });
    await expect(api.getFriends()).rejects.toThrow("not_authenticated");
    expect(f).not.toHaveBeenCalled();
  });
});
