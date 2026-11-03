import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { applyMissionEvent } from "../../src/core/missions";
import {
  DELOPHY_HUNT, DELOPHY_HUNT_BUDGET, HUNT_DIFFICULTIES, HUNT_TREASURES, HuntFlipError, MIN_MOVE_MS, applyHuntMoves, createEmptyDelophyHuntState,
  delophyHuntStatus, flipHuntSlot, huntDifficulty, huntPairsGemValue, huntTreasure, isValidDelophyHuntState, normalizeDelophyHuntState,
  rollHuntLayout, rollHuntMoves, rollHuntPairs, type HuntRun,
} from "../../src/core/delophyHunt";
import { activeRegularEventId, isRegularEventActive } from "../../src/core/regularEventRotation";
import { activeLobbyEvents } from "../../src/ui/lobbyEventModel";

const TIA_WEEK = new Date("2026-11-02T03:00:00Z");
const DELOPHY_WEEK = new Date("2026-11-09T03:00:00Z");

function lcg(seed: number): () => number {
  let state = seed >>> 0;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 0x100000000; };
}

function serverWithCoins(coins: number, random: () => number, now = DELOPHY_WEEK) {
  const state = createDefaultSession();
  state.missions = applyMissionEvent(state.missions, { type: "stamina_spent", amount: coins }, now);
  return { state, api: new FakeServer(state, { latencyMs: 0, now: () => now, random, persistSession: () => undefined }) };
}

describe("델로피의 보물 찾기 규칙", () => {
  it("완벽하게 맞췄을 때의 기대 가치가 정규 이벤트 예산(코인 100당) 안이다", () => {
    for (const difficulty of HUNT_DIFFICULTIES) {
      const random = lcg(difficulty.entryCost);
      let total = 0;
      const runs = 4000;
      for (let index = 0; index < runs; index += 1) total += huntPairsGemValue(rollHuntPairs(difficulty, random));
      const per100 = total / runs / difficulty.entryCost * 100;
      expect(per100, difficulty.id).toBeLessThanOrEqual(DELOPHY_HUNT_BUDGET.gemValuePer100Stamina);
      expect(per100, difficulty.id).toBeGreaterThan(40);
    }
  });

  it("어려울수록 비싸고 쌍이 많으며 더 많이 섞인다", () => {
    for (let index = 1; index < HUNT_DIFFICULTIES.length; index += 1) {
      const a = HUNT_DIFFICULTIES[index - 1], b = HUNT_DIFFICULTIES[index];
      expect(b.entryCost).toBeGreaterThan(a.entryCost);
      expect(b.pairs).toBeGreaterThan(a.pairs);
      expect(b.swaps).toBeGreaterThan(a.swaps);
      expect(b.moveMs).toBeLessThan(a.moveMs);
    }
    expect(huntDifficulty("nope")).toBeUndefined();
  });

  it("원석은 평범한 보물에만, 대박은 쉬움에 나오지 않는다", () => {
    expect(HUNT_TREASURES.filter((t) => t.currency === "rawStone").every((t) => t.tier === "common")).toBe(true);
    const easy = HUNT_DIFFICULTIES[0];
    expect(easy.tierWeights.jackpot).toBe(0);
    const random = lcg(7);
    for (let index = 0; index < 500; index += 1) {
      expect(rollHuntPairs(easy, random).some((id) => huntTreasure(id)?.tier === "jackpot")).toBe(false);
    }
  });

  it("섞는 길은 서로 다른 슬롯끼리만, 너무 빠르지 않게 움직이고 배치를 보존한다", () => {
    for (const difficulty of HUNT_DIFFICULTIES) {
      const random = lcg(99);
      for (let round = 0; round < 80; round += 1) {
        const pairs = rollHuntPairs(difficulty, random);
        const layout = rollHuntLayout(pairs, random);
        expect(layout).toHaveLength(pairs.length * 2);
        const moves = rollHuntMoves(layout, difficulty, random);
        for (const move of moves) {
          expect(move.ms).toBeGreaterThanOrEqual(MIN_MOVE_MS);
          const slots = move.swaps.flat();
          expect(new Set(slots).size).toBe(slots.length);
          if (!difficulty.arc) expect(move.style).toBe("slide");
          if (!difficulty.dive) expect(move.style).not.toBe("dive");
        }
        const after = applyHuntMoves(layout, moves);
        expect([...after].sort()).toEqual([...layout].sort());
        const jackpotIds = new Set(pairs.filter((id) => huntTreasure(id)?.tier === "jackpot"));
        if (jackpotIds.size > 0) {
          const replay = [...layout];
          let touched = 0;
          for (const move of moves) {
            const hit = move.swaps.some(([x, y]) => jackpotIds.has(replay[x]) || jackpotIds.has(replay[y]));
            if (hit) { touched += 1; expect(move.style).not.toBe("slide"); }
            for (const [x, y] of move.swaps) [replay[x], replay[y]] = [replay[y], replay[x]];
          }
          expect(touched).toBeGreaterThanOrEqual(difficulty.jackpotMoves);
        }
      }
    }
  });

  it("뒤집기: 첫 장 → 맞음/틀림, 세 번 틀리면 끝, 전부 맞추면 클리어, 잘못된 슬롯은 거절", () => {
    const layout = ["a", "b", "a", "b"];
    const run: HuntRun = { difficulty: "easy", pairs: ["a", "b"], layout, found: [], misses: 0, first: null, collected: {} };
    const first = flipHuntSlot(run, 0);
    expect(first.flip.step).toBe("first");
    const miss = flipHuntSlot(first.run, 1);
    expect(miss.flip).toMatchObject({ step: "miss", misses: 1, finished: false });
    expect(miss.run.first).toBeNull();
    const match = flipHuntSlot(first.run, 2);
    expect(match.flip.step).toBe("match");
    const last = flipHuntSlot(flipHuntSlot(match.run, 1).run, 3);
    expect(last.flip).toMatchObject({ step: "match", finished: true, cleared: true });
    const doomed = flipHuntSlot(flipHuntSlot({ ...run, misses: DELOPHY_HUNT.maxMisses - 1 }, 0).run, 1);
    expect(doomed.flip).toMatchObject({ finished: true, cleared: false });
    expect(() => flipHuntSlot(run, 9)).toThrow(HuntFlipError);
    expect(() => flipHuntSlot(first.run, 0)).toThrow(HuntFlipError);
    expect(() => flipHuntSlot(match.run, 0)).toThrow(HuntFlipError);
  });

  it("코인은 이번 주 쓴 스테미나, 주가 바뀌면 판이 사라지고 저장 검증을 왕복한다", () => {
    const state = createDefaultSession();
    const missions = applyMissionEvent(state.missions, { type: "stamina_spent", amount: 700 }, DELOPHY_WEEK);
    expect(delophyHuntStatus(missions, createEmptyDelophyHuntState(), DELOPHY_WEEK).coins).toBe(700);
    const ledger = { weekKey: "2026-11-09", spent: 300, run: null };
    expect(delophyHuntStatus(missions, ledger, DELOPHY_WEEK).coins).toBe(400);
    expect(isValidDelophyHuntState(ledger)).toBe(true);
    expect(isValidDelophyHuntState({ ...ledger, spent: -1 })).toBe(false);
    expect(normalizeDelophyHuntState(undefined)).toEqual(createEmptyDelophyHuntState());
  });
});

describe("정규 이벤트 순환", () => {
  it("티아와 델로피가 한 주씩 번갈아 서고, 순환 밖 이벤트는 늘 열려 있다", () => {
    expect(activeRegularEventId(TIA_WEEK)).toBe("chest-forge");
    expect(activeRegularEventId(DELOPHY_WEEK)).toBe("delophy-hunt");
    expect(activeRegularEventId(new Date("2026-11-16T00:00:00Z"))).toBe("chest-forge");
    expect(isRegularEventActive("research-roulette", DELOPHY_WEEK)).toBe(true);
    expect(isRegularEventActive("chest-forge", DELOPHY_WEEK)).toBe(false);
  });

  it("로비 카드는 이번 주 차례의 이벤트만 보여 준다", () => {
    const ids = (now: Date) => activeLobbyEvents(now.getTime()).map((event) => event.id);
    expect(ids(TIA_WEEK)).toContain("chest-forge");
    expect(ids(TIA_WEEK)).not.toContain("delophy-hunt");
    expect(ids(DELOPHY_WEEK)).toContain("delophy-hunt");
    expect(ids(DELOPHY_WEEK)).not.toContain("chest-forge");
  });
});

describe("델로피의 보물 찾기 서버 경계", () => {
  it("코인이 모자라거나 차례가 아닌 주에는 입장할 수 없다", async () => {
    await expect(serverWithCoins(199, () => 0).api.enterDelophyHunt({ requestId: "a", difficulty: "easy" })).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
    await expect(serverWithCoins(1000, () => 0, TIA_WEEK).api.enterDelophyHunt({ requestId: "a", difficulty: "easy" })).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
    await expect(serverWithCoins(1000, () => 0).api.enterDelophyHunt({ requestId: "a", difficulty: "nope" as never })).rejects.toBeDefined();
  });

  it("QA 디버그 도구는 정규 이벤트 코인을 이번 주 몫으로 더한다(두 이벤트 공용)", async () => {
    const { api } = serverWithCoins(100, () => 0);
    await expect(api.applyDebugCommand({ kind: "eventCoins", amount: 500 })).resolves.toMatchObject({ changed: 1 });
    expect((await api.getDelophyHunt()).coins).toBe(600);
    expect((await api.getChestForge()).coins).toBe(600);
    const off = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => DELOPHY_WEEK, random: () => 0, persistSession: () => undefined, developmentTools: false });
    await expect(off.applyDebugCommand({ kind: "eventCoins", amount: 500 })).rejects.toMatchObject({ code: "DEBUG_TOOLS_DISABLED" });
  });

  it("QA 빌드는 로비 이벤트를 기한·교대와 상관없이 모두 세운다", () => {
    const all = activeLobbyEvents(TIA_WEEK.getTime(), undefined, true).map((event) => event.id);
    expect(all).toEqual(expect.arrayContaining(["chest-forge", "delophy-hunt"]));
  });

  it("입장 → 짝 맞추기 → 보상 지급, 같은 요청은 한 번만 처리하고 진행 중에는 다시 입장할 수 없다", async () => {
    const { state, api } = serverWithCoins(1000, lcg(5));
    const entered = await api.enterDelophyHunt({ requestId: "enter", difficulty: "easy" });
    expect(entered.status.coins).toBe(1000 - 200);
    expect(entered.show?.layout).toHaveLength(6);
    const again = await api.enterDelophyHunt({ requestId: "enter", difficulty: "easy" });
    expect(again.status.coins).toBe(800);
    await expect(api.enterDelophyHunt({ requestId: "other", difficulty: "easy" })).rejects.toMatchObject({ code: "INVALID_STATE" });
    const before = JSON.stringify(state.wallet);

    // 화면이 받은 섞는 길을 따라 정답 배치를 계산해 모두 맞춘다(서버만 아는 값이라 직접 재현).
    const final = applyHuntMoves(entered.show!.layout, entered.show!.moves);
    const bySlot = new Map<string, number[]>();
    final.forEach((id, slot) => bySlot.set(id, [...(bySlot.get(id) ?? []), slot]));
    let n = 0, last;
    for (const [, [a, b]] of bySlot) {
      await api.flipDelophyCard({ requestId: `f${n++}`, slot: a });
      last = await api.flipDelophyCard({ requestId: `f${n++}`, slot: b });
      expect(last.flip?.step).toBe("match");
    }
    expect(last?.flip?.cleared).toBe(true);
    expect(last?.status.run).toBeNull();
    expect(JSON.stringify(state.wallet)).not.toBe(before);
  });

  it("세 번 틀리면 판이 끝나고 코인은 돌려주지 않는다", async () => {
    const { api } = serverWithCoins(1000, lcg(11));
    const entered = await api.enterDelophyHunt({ requestId: "enter", difficulty: "easy" });
    const final = applyHuntMoves(entered.show!.layout, entered.show!.moves);
    const other = final.findIndex((id, slot) => slot > 0 && id !== final[0]);
    let n = 0, result;
    for (let miss = 0; miss < DELOPHY_HUNT.maxMisses; miss += 1) {
      await api.flipDelophyCard({ requestId: `f${n++}`, slot: 0 });
      result = await api.flipDelophyCard({ requestId: `f${n++}`, slot: other });
      expect(result.flip?.step).toBe("miss");
    }
    expect(result?.flip).toMatchObject({ finished: true, cleared: false });
    expect(result?.status.run).toBeNull();
    expect(result?.status.coins).toBe(800);
  });
});
