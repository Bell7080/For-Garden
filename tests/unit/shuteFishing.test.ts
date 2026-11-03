import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { applyMissionEvent } from "../../src/core/missions";
import {
  FISHING_DIFFICULTIES, FISH_TREASURES, FishingReelError, MIN_WINDOW_MS, SHUTE_FISHING, SHUTE_FISHING_BUDGET, catchWindowMs, createEmptyShuteFishingState,
  fishTreasure, fishingDifficulty, fishingRunGemValue, gaugePosition, isValidShuteFishingState, judgeCatch, normalizeShuteFishingState,
  reelFishing, rollFishCatches, rollFishingFish, shuteFishingPlayable, shuteFishingStatus, type FishingCatch, type FishingRun,
} from "../../src/core/shuteFishing";
import { activeRegularEventId } from "../../src/core/regularEventRotation";
import { activeLobbyEvents } from "../../src/ui/lobbyEventModel";

const SHUTE_WEEK = new Date("2026-11-16T03:00:00Z");
const DELOPHY_WEEK = new Date("2026-11-09T03:00:00Z");

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
}

function serverWithCoins(coins: number, random: () => number, now = SHUTE_WEEK) {
  const state = createDefaultSession();
  state.missions = applyMissionEvent(state.missions, { type: "stamina_spent", amount: coins }, now);
  return { state, api: new FakeServer(state, { latencyMs: 0, now: () => now, random, persistSession: () => undefined }) };
}

/** 바늘이 구간 한가운데에 서는 첫 순간 — 0에서 출발해 오른쪽으로 가므로 `center × sweepMs`다. */
const centerHit = (spec: FishingCatch) => Math.round(spec.center * spec.sweepMs);
/** 구간 밖이 확실한 순간 — 출발점(0)은 구간이 끝에 붙지 않으므로 늘 밖이다. */
const MISS_AT = 0;

describe("슈테의 리듬 낚시 규칙", () => {
  it("다 낚았을 때의 기대 가치가 정규 이벤트 예산(코인 100당) 안이고, 판값은 입장값에 비례한다(1:2:3:4)", () => {
    const per100: number[] = [];
    for (const difficulty of FISHING_DIFFICULTIES) {
      const random = lcg(difficulty.entryCost + 7);
      let total = 0;
      const runs = 6000;
      for (let index = 0; index < runs; index += 1) total += fishingRunGemValue(rollFishingFish(difficulty, random));
      const value = total / runs / difficulty.entryCost * 100;
      expect(value, difficulty.id).toBeLessThanOrEqual(SHUTE_FISHING_BUDGET.gemValuePer100Stamina);
      per100.push(value);
    }
    const base = per100[0];
    for (const value of per100) expect(Math.abs(value / base - 1)).toBeLessThan(0.08);
  });

  it("어려울수록 비싸고 물고기가 많으며 바늘이 빠르고 구간이 좁다", () => {
    for (let index = 1; index < FISHING_DIFFICULTIES.length; index += 1) {
      const [easier, harder] = [FISHING_DIFFICULTIES[index - 1], FISHING_DIFFICULTIES[index]];
      expect(harder.entryCost).toBe(easier.entryCost + 100);
      expect(harder.fish).toBeGreaterThan(easier.fish);
      expect(harder.sweepMs).toBeLessThan(easier.sweepMs);
      expect(harder.zone).toBeLessThan(easier.zone);
    }
  });

  it("셋리스트는 뒤로 갈수록 좋아지고, 마지막 보스곡이 난이도에 맞춰 가장 크며, 대박은 보스곡에서만 나온다", () => {
    const random = lcg(42);
    const bossValues: number[] = [];
    for (const difficulty of FISHING_DIFFICULTIES) {
      let bossTotal = 0;
      const runs = 400;
      for (let run = 0; run < runs; run += 1) {
        const fish = rollFishingFish(difficulty, random);
        expect(fish).toHaveLength(difficulty.fish);
        expect(new Set(fish).size).toBe(fish.length);
        const values = fish.map((id) => fishingRunGemValue([id]));
        for (let index = 1; index < values.length; index += 1) expect(values[index], difficulty.id).toBeGreaterThanOrEqual(values[index - 1]);
        const tiers = fish.map((id) => fishTreasure(id)!.tier);
        expect(tiers.slice(0, -1)).not.toContain("jackpot");
        expect(difficulty.boss.map(([id]) => id)).toContain(fish[fish.length - 1]);
        bossTotal += values[values.length - 1];
      }
      bossValues.push(bossTotal / runs);
    }
    for (let index = 1; index < bossValues.length; index += 1) expect(bossValues[index]).toBeGreaterThan(bossValues[index - 1]);
    expect(FISHING_DIFFICULTIES.find((entry) => entry.id === "extreme")!.boss.every(([id]) => fishTreasure(id)!.tier === "jackpot")).toBe(true);
    const jackpots = FISH_TREASURES.filter((treasure) => treasure.tier === "jackpot");
    for (const treasure of jackpots) expect(treasure.currency === "gems" && treasure.amount >= 300 && treasure.amount <= 1000).toBe(true);
  });

  it("물고기마다 캐치는 3~5번이고, 어떤 캐치도 판정 창이 MIN_WINDOW_MS보다 짧지 않다", () => {
    const random = lcg(9);
    for (const difficulty of FISHING_DIFFICULTIES) {
      for (const treasure of FISH_TREASURES) {
        const catches = rollFishCatches(difficulty, treasure.id, random);
        expect(catches.length).toBeGreaterThanOrEqual(3);
        expect(catches.length).toBeLessThanOrEqual(5);
        for (const spec of catches) {
          expect(catchWindowMs(spec)).toBeGreaterThanOrEqual(MIN_WINDOW_MS - 1);
          expect(spec.center - spec.width / 2).toBeGreaterThan(0);
          expect(spec.center + spec.width / 2).toBeLessThan(1);
          expect(judgeCatch(spec, centerHit(spec)).judgment).toBe("perfect");
          expect(judgeCatch(spec, MISS_AT).judgment).toBe("miss");
        }
      }
    }
  });

  it("바늘은 0에서 오른쪽 끝까지 갔다가 돌아오는 삼각파다", () => {
    expect(gaugePosition(1000, 0)).toBe(0);
    expect(gaugePosition(1000, 500)).toBeCloseTo(0.5);
    expect(gaugePosition(1000, 1000)).toBeCloseTo(1);
    expect(gaugePosition(1000, 1500)).toBeCloseTo(0.5);
    expect(gaugePosition(1000, 2000)).toBeCloseTo(0);
  });

  it("캐치를 다 채우면 낚이고, 세 번 미스하면 끝나며, 잘못된 입력은 거절한다", () => {
    const difficulty = fishingDifficulty("easy")!;
    const random = lcg(3);
    const fish = rollFishingFish(difficulty, random);
    let run: FishingRun = { difficulty: "easy", fish, catches: fish.map((id) => rollFishCatches(difficulty, id, random)), index: 0, caught: 0, misses: 0, collected: {} };
    expect(() => reelFishing(run, -1)).toThrow(FishingReelError);
    expect(() => reelFishing(run, "x")).toThrow(FishingReelError);
    const first = run.catches[0];
    for (let index = 0; index < first.length; index += 1) {
      const step = reelFishing(run, centerHit(first[index]));
      run = step.run;
      if (index < first.length - 1) expect(step.reel.landed).toBeUndefined();
      else expect(step.reel.landed).toBe(fish[0]);
    }
    expect(run.index).toBe(1);
    for (let miss = 1; miss <= SHUTE_FISHING.maxMisses; miss += 1) {
      const step = reelFishing(run, MISS_AT);
      run = step.run;
      expect(step.reel.judgment).toBe("miss");
      expect(step.reel.finished).toBe(miss === SHUTE_FISHING.maxMisses);
    }
  });

  it("코인은 이번 주 쓴 스테미나이고 저장 검증을 왕복한다", () => {
    const state = createDefaultSession();
    const missions = applyMissionEvent(state.missions, { type: "stamina_spent", amount: 700 }, SHUTE_WEEK);
    expect(shuteFishingStatus(missions, createEmptyShuteFishingState(), SHUTE_WEEK).coins).toBe(700);
    const ledger = { weekKey: "2026-11-16", spent: 300, run: null };
    const status = shuteFishingStatus(missions, ledger, SHUTE_WEEK);
    expect(status.coins).toBe(400);
    expect(shuteFishingPlayable(status)).toBe(true);
    expect(shuteFishingPlayable({ coins: 99, run: null })).toBe(false);
    expect(isValidShuteFishingState(ledger)).toBe(true);
    expect(isValidShuteFishingState({ ...ledger, spent: -1 })).toBe(false);
    expect(normalizeShuteFishingState(undefined)).toEqual(createEmptyShuteFishingState());
  });
});

describe("정규 이벤트 순환 — 슈테", () => {
  it("티아 → 델로피 → 슈테 순으로 한 주씩 서고 로비 카드도 그 차례를 따른다", () => {
    expect(activeRegularEventId(SHUTE_WEEK)).toBe("shute-fishing");
    expect(activeRegularEventId(new Date("2026-11-23T03:00:00Z"))).toBe("chest-forge");
    const ids = activeLobbyEvents(SHUTE_WEEK.getTime()).map((event) => event.id);
    expect(ids).toContain("shute-fishing");
    expect(ids).not.toContain("delophy-hunt");
    expect(activeLobbyEvents(DELOPHY_WEEK.getTime()).map((event) => event.id)).not.toContain("shute-fishing");
  });
});

describe("슈테의 리듬 낚시 서버 경계", () => {
  it("코인이 모자라거나 차례가 아닌 주에는 입장할 수 없다", async () => {
    await expect(serverWithCoins(99, () => 0).api.enterShuteFishing({ requestId: "a", difficulty: "easy" })).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
    await expect(serverWithCoins(1000, () => 0, DELOPHY_WEEK).api.enterShuteFishing({ requestId: "a", difficulty: "easy" })).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
    await expect(serverWithCoins(1000, () => 0).api.enterShuteFishing({ requestId: "a", difficulty: "nope" as never })).rejects.toBeDefined();
  });

  it("입장 → 캐치 → 낚은 보물 지급, 같은 요청은 한 번만 처리하고 진행 중에는 다시 입장할 수 없다", async () => {
    const { state, api } = serverWithCoins(1000, lcg(5));
    const entered = await api.enterShuteFishing({ requestId: "enter-1", difficulty: "normal" });
    expect(entered.status.coins).toBe(800);
    expect((await api.enterShuteFishing({ requestId: "enter-1", difficulty: "normal" })).status.coins).toBe(800);
    await expect(api.enterShuteFishing({ requestId: "enter-2", difficulty: "easy" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    const run = entered.status.run!;
    const before = structuredClone(state.wallet);
    let reelCount = 0;
    let last;
    for (let fishIndex = 0; fishIndex < run.fish.length; fishIndex += 1) {
      for (const spec of run.catches[fishIndex]) {
        reelCount += 1;
        last = await api.reelShuteFishing({ requestId: `reel-${reelCount}`, elapsedMs: centerHit(spec) });
        expect(last.reel!.judgment).toBe("perfect");
      }
      expect(last!.reel!.landed).toBe(run.fish[fishIndex]);
    }
    expect(last!.reel!.cleared).toBe(true);
    expect(last!.status.run).toBeNull();
    for (const id of run.fish) {
      const treasure = fishTreasure(id)!;
      expect(state.wallet[treasure.currency]).toBeGreaterThan(before[treasure.currency]);
    }
  });

  it("세 번 미스하면 판이 끝나고 코인은 돌려주지 않는다", async () => {
    const { api } = serverWithCoins(1000, lcg(11));
    await api.enterShuteFishing({ requestId: "enter", difficulty: "hard" });
    let last;
    for (let miss = 1; miss <= SHUTE_FISHING.maxMisses; miss += 1) last = await api.reelShuteFishing({ requestId: `miss-${miss}`, elapsedMs: MISS_AT });
    expect(last!.reel!.finished).toBe(true);
    expect(last!.status.run).toBeNull();
    expect(last!.status.coins).toBe(700);
  });
});
