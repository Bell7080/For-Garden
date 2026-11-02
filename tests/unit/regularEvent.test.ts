import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { FakeServer } from "../../src/api/FakeServer";
import type { RegularEventDto } from "../../src/api/contracts";
import { createDefaultSession } from "../../src/state/session";

void SettingsManager;
const event: RegularEventDto = {
  id: "e1", kind: "wheel", variant: 1, name: "이번 주 이벤트", description: "", currency: "eventCoin", costPerPlay: 10, dailyFreePlays: 1,
  rewardTable: [{ weight: 1, rewards: [{ asset: "gold", amount: 1000 }] }], weekStart: "2026-11-02", endsAt: "2026-11-09T00:00:00.000Z",
};

describe("정기 이벤트 통로", () => {
  it("서버가 주입한 편성만 돌려주고, 없으면 null이다", async () => {
    const none = new FakeServer(createDefaultSession(), { latencyMs: 0, persistSession: () => undefined });
    expect((await none.getRegularEvent()).event).toBeNull();
    const some = new FakeServer(createDefaultSession(), { latencyMs: 0, persistSession: () => undefined, regularEvent: event });
    const res = await some.getRegularEvent();
    expect(res.event).toEqual(event);
    expect(res.event).not.toBe(event);
    expect(Number.isNaN(Date.parse(res.serverTime))).toBe(false);
  });

  it("DB 함수의 주 경계는 UTC 월요일이다", () => {
    const sql = readFileSync("supabase/migrations/20261118000000_server_regular_event.sql", "utf8");
    expect(sql).toContain("now() at time zone 'UTC'");
    expect(sql).not.toContain("Asia/Seoul");
    expect(sql).toContain("to service_role");
  });
});
