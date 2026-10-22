import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { ROULETTE, ROULETTE_REWARDS, rouletteStatus } from "../../src/core/roulette";

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
    expect((await api.spinRoulette({ requestId: "retry" })).granted.gold).toBe(10000);
  });

  it("무료 회전은 한 번만 지급하며 같은 요청을 재시도해도 중복 지급하지 않는다", async () => {
    const state = createDefaultSession();
    const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-10-21T12:00:00Z"), random: () => 0 });
    const first = await api.spinRoulette({ requestId: "spin-1" });
    expect(first.granted.gold).toBe(10000);
    expect((await api.spinRoulette({ requestId: "spin-1" })).wallet.gold).toBe(first.wallet.gold);
    await expect(api.spinRoulette({ requestId: "spin-2" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    expect((await api.getRouletteStatus()).remaining).toBe(0);
  });
  it("검증된 광고 한 번마다 한 회전을 열며 하루 세 번까지만 추가하고 날짜가 바뀌면 무료 한 번으로 돌아간다", async () => {
    let now = new Date("2026-10-21T23:59:00Z");
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => now, verifyAdToken: async token => token === "valid" });
    await expect(api.unlockRouletteSpins({ requestId: "bad", verificationToken: "invalid" })).rejects.toMatchObject({ code: "AD_TOKEN_INVALID" });
    await api.spinRoulette({ requestId: "free" });
    for (let i = 0; i < 3; i++) {
      const unlocked = await api.unlockRouletteSpins({ requestId: `bonus-${i}`, verificationToken: "valid" });
      expect(unlocked).toMatchObject({ remaining: 1, bonusRemaining: 2 - i });
      await api.spinRoulette({ requestId: `extra-${i}` });
    }
    await expect(api.unlockRouletteSpins({ requestId: "fourth-ad", verificationToken: "valid" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    await expect(api.spinRoulette({ requestId: "fifth" })).rejects.toMatchObject({ code: "AD_DAILY_LIMIT" });
    now = new Date("2026-10-22T00:00:00Z");
    expect(await api.getRouletteStatus()).toMatchObject({ used: 0, remaining: 1, bonusAvailable: true, bonusRemaining: 3 });
  });
  it("저장한 사용량을 재실행 뒤에도 유지하고 종료된 이벤트는 지급하지 않는다", async () => {
    const ledger = { date: "2026-10-21", claimsBySlot: { [ROULETTE.counter]: 4, [ROULETTE.adSlot]: 3 } };
    expect(rouletteStatus(ledger, new Date("2026-10-21T10:00Z"))).toMatchObject({ remaining: 0, bonusAvailable: false, bonusRemaining: 0 });
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => new Date("2027-01-01") });
    await expect(api.spinRoulette({ requestId: "ended" })).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
  });
  it("이전 버전에서 광고 한 번으로 연 세 회전은 배포 당일 끝까지 그대로 인정한다", () => {
    const legacy = { date: "2026-10-21", claimsBySlot: { [ROULETTE.counter]: 2, [ROULETTE.legacyAdSlot]: 1 } };
    expect(rouletteStatus(legacy, new Date("2026-10-21T10:00Z"))).toMatchObject({ remaining: 2, bonusAvailable: false, bonusRemaining: 0 });
  });
  it("여섯 칸은 화면에 적힌 상향 보상과 서버 지급표를 그대로 공유한다", () => {
    expect(ROULETTE_REWARDS).toEqual([
      { currency: "gold", amount: 10000 }, { currency: "cheesecake", amount: 50 },
      { currency: "stamina", amount: 30 }, { currency: "gems", amount: 50 },
      { currency: "rawStone", amount: 100 }, { currency: "gold", amount: 20000 },
    ]);
  });
});
