import { describe, expect, it, vi } from "vitest";
import { createSupabaseStore } from "../../src/server/supabaseStore";

describe("운영 DB 조회 분리", () => {
  it("친구 신청 개수와 길드 출석·혜택에는 읽기 전용 RPC만 부른다", async () => {
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const path = String(input);
      if (path.endsWith("server_pending_friend_count")) return Response.json(3);
      if (path.endsWith("server_guild_read_context")) return Response.json({ level: 4, attendanceReady: false });
      throw Error(path);
    });
    const store = createSupabaseStore({ url: "https://notifications.test", serviceKey: "test", fetchImpl });
    await expect(store.pendingRequests!("player")).resolves.toBe(3);
    await expect(store.guildReadContext!("player")).resolves.toEqual({ level: 4, attendanceReady: false });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("지연되거나 실패한 정산 중에도 우편을 읽으며 나머지 정산을 이어 간다", async () => {
    let release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const jobs: Promise<unknown>[] = [];
    const mail = { mails: [{ id: "existing" }], adjustments: [] };
    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      if (String(input).endsWith("server_ops_inbox")) return Response.json(mail);
      if (String(input).endsWith("server_competitive_rewards_v2")) {
        await barrier;
        return Response.json({}, { status: 500 });
      }
      return Response.json(null);
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = createSupabaseStore({ url: "https://rank-refresh.test", serviceKey: "test", fetchImpl, waitUntil: job => { jobs.push(job); } });
    try {
      await expect(store.opsInbox!("player")).resolves.toEqual(mail);
      await expect(store.opsInbox!("player")).resolves.toEqual(mail);
      expect(fetchImpl.mock.calls.filter(([url]) => String(url).endsWith("server_competitive_rewards_v2"))).toHaveLength(1);
    } finally {
      release();
      await Promise.all(jobs);
      warn.mockRestore();
    }
    expect(fetchImpl.mock.calls.some(([url]) => String(url).endsWith("server_guild_weekly_rewards"))).toBe(true);
  });
});
