import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { ROULETTE, ROULETTE_REWARDS, ROULETTE_WEIGHT_TOTAL, rouletteIndex, rouletteIndexAtPointer, rouletteRate, rouletteRateOrder, rouletteStatus } from "../../src/core/roulette";
import { TRADE_GEM_RATE } from "../../src/data/tradePackages";

/** 젬 1개에 받는 양 — 무역 시세표 + 스테미나는 젬 충전 1단계(젬 50 → 60). */
const PER_GEM: Record<string, number> = { ...TRADE_GEM_RATE, stamina: 60 / 50 };

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
  it("기본 QA 광고 증명으로 해금한 직후 같은 서버에서 추가 회전을 지급한다", async () => {
    const api = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => new Date("2026-10-21T12:00:00Z"), random: () => 0 });
    await api.spinRoulette({ requestId: "free" });
    await expect(api.unlockRouletteSpins({ requestId: "ad", verificationToken: `verified:${ROULETTE.adSlot}` })).resolves.toMatchObject({ remaining: 1, bonusRemaining: 2 });
    await expect(api.spinRoulette({ requestId: "ad-spin" })).resolves.toMatchObject({ granted: { gold: 10000 }, status: { remaining: 0, bonusRemaining: 2 } });
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
  it("여덟 칸은 젬 100·300·1,000과 기존 보상을 담고, 확률은 가중치에서만 나온다", () => {
    expect(ROULETTE_REWARDS.map(({ currency, amount }) => [currency, amount])).toEqual([
      ["gold", 10000], ["gems", 100], ["cheesecake", 50], ["gems", 1000],
      ["stamina", 30], ["gold", 20000], ["rawStone", 100], ["gems", 300],
    ]);
    expect(ROULETTE_WEIGHT_TOTAL).toBe(1000);
    const sum = ROULETTE_REWARDS.reduce((total, _, index) => total + rouletteRate(index), 0);
    expect(sum).toBeCloseTo(1, 10);
    // 젬이 클수록 드물다 — 1,000은 0.5%, 300은 2.5%, 100은 9%.
    const gem = (amount: number) => rouletteRate(ROULETTE_REWARDS.findIndex((reward) => reward.currency === "gems" && reward.amount === amount));
    expect([gem(100), gem(300), gem(1000)]).toEqual([0.09, 0.025, 0.005]);
    // 가장 흔한 칸은 골드 1만(사실상 꽝)이다.
    expect(Math.max(...ROULETTE_REWARDS.map((_, index) => rouletteRate(index)))).toBe(rouletteRate(0));
  });
  it("한 번의 기대값은 젬 환산으로 예전(약 30)보다 조금 높은 40~45 안에 든다", () => {
    const value = ROULETTE_REWARDS.reduce((sum, reward, index) => sum + rouletteRate(index) * reward.amount / PER_GEM[reward.currency], 0);
    expect(value).toBeGreaterThan(40);
    expect(value).toBeLessThan(45);
  });
  it("난수 구간이 가중치대로 칸을 고르고, 범위를 벗어난 난수도 칸 밖으로 새지 않는다", () => {
    expect(rouletteIndex(() => 0)).toBe(0);
    expect(rouletteIndex(() => 0.2999)).toBe(0);
    expect(rouletteIndex(() => 0.3)).toBe(1);
    expect(rouletteIndex(() => 0.999999)).toBe(ROULETTE_REWARDS.length - 1);
    expect(rouletteIndex(() => 1)).toBe(ROULETTE_REWARDS.length - 1);
    expect(rouletteIndex(() => -3)).toBe(0);
    expect(rouletteIndex(() => Number.NaN)).toBe(0);
    const counts = new Array(ROULETTE_REWARDS.length).fill(0);
    for (let step = 0; step < 1000; step += 1) counts[rouletteIndex(() => (step + 0.5) / 1000)] += 1;
    expect(counts).toEqual(ROULETTE_REWARDS.map(({ weight }) => weight));
  });
  it("확률표는 귀한 칸부터 선다", () => {
    expect(rouletteRateOrder().map((index) => ROULETTE_REWARDS[index].weight)).toEqual([...ROULETTE_REWARDS.map(({ weight }) => weight)].sort((a, b) => a - b));
  });
  it("바늘 아래 칸은 바퀴를 돌린 각도와 맞는다", () => {
    ROULETTE_REWARDS.forEach((_, index) => {
      expect(rouletteIndexAtPointer(-index * 45)).toBe(index);
      expect(rouletteIndexAtPointer(360 * 6 - index * 45 + 10)).toBe(index);
    });
  });
});
