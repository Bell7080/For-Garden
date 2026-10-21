import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { ROULETTE, rouletteStatus } from "../../src/core/roulette";

describe("일일 돌림판", () => {
  it("저장 실패 시 보상도 회전 횟수도 바뀌지 않아 재시도할 수 있다", async () => {
    const state = createDefaultSession();
    const before = structuredClone(state.wallet);
    let fail = true;
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-10-21"), random: () => 0,
      persistSession: () => { if (fail) throw new Error("offline"); } });
    await expect(api.spinRoulette({ requestId: "retry" })).rejects.toThrow("게임 상태를 저장하지 못했습니다.");
    expect(state.wallet).toEqual(before);
    expect((await api.getRouletteStatus()).remaining).toBe(1);
    fail = false;
    expect((await api.spinRoulette({ requestId: "retry" })).granted.gold).toBe(5000);
  });

  it("무료 회전은 한 번만 지급하며 같은 요청을 재시도해도 중복 지급하지 않는다", async () => {
    const state = createDefaultSession();
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-10-21T12:00:00Z"), random: () => 0 });
    const first = await api.spinRoulette({ requestId: "spin-1" });
    expect(first.granted.gold).toBe(5000);
    expect((await api.spinRoulette({ requestId: "spin-1" })).wallet.gold).toBe(first.wallet.gold);
    await expect(api.spinRoulette({ requestId: "spin-2" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    expect((await api.getRouletteStatus()).remaining).toBe(0);
  });
  it("검증된 광고 한 번으로 세 번만 더 열고 날짜가 바뀌면 무료 한 번으로 돌아간다", async () => {
    let now = new Date("2026-10-21T23:59:00Z");
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => now, verifyAdToken: async token => token === "valid" });
    await expect(api.unlockRouletteSpins({ requestId: "bad", verificationToken: "invalid" })).rejects.toMatchObject({ code: "AD_TOKEN_INVALID" });
    await api.spinRoulette({ requestId: "free" });
    expect((await api.unlockRouletteSpins({ requestId: "bonus", verificationToken: "valid" })).remaining).toBe(3);
    for (let i = 0; i < 3; i++) await api.spinRoulette({ requestId: `extra-${i}` });
    await expect(api.spinRoulette({ requestId: "fifth" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    now = new Date("2026-10-22T00:00:00Z");
    expect(await api.getRouletteStatus()).toMatchObject({ used: 0, remaining: 1, bonusAvailable: true });
  });
  it("저장한 사용량을 재실행 뒤에도 유지하고 종료된 이벤트는 지급하지 않는다", async () => {
    const ledger = { date: "2026-10-21", claimsBySlot: { [ROULETTE.counter]: 4, [ROULETTE.adSlot]: 1 } };
    expect(rouletteStatus(ledger, new Date("2026-10-21T10:00Z"))).toMatchObject({ remaining: 0, bonusAvailable: false });
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => new Date("2027-01-01") });
    await expect(api.spinRoulette({ requestId: "ended" })).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
  });
});
