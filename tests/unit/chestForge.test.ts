import { describe, expect, it } from "vitest";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { applyMissionEvent } from "../../src/core/missions";
import {
  CHEST_GRADE_MAX, chestBestCard, chestCardFlair, chestCollectedValue, chestGrade, chestGradeProgress, rollChestCard, type ChestCardCurrency,
  CHEST_BOXES, CHEST_CARDS, CHEST_FORGE, CHEST_FORGE_BUDGET, chestBox, chestGradeThresholds, chestBoxExpectedValue, chestCard, chestCardGemValue, chestForgeStatus, chestOfferSlots,
  createEmptyChestForgeState, normalizeChestForgeState, rollChestOffer,
} from "../../src/core/chestForge";

void SettingsManager;
const MONDAY = new Date("2026-11-02T03:00:00Z");

function serverWithCoins(coins: number, random: () => number, now = MONDAY) {
  const state = createDefaultSession();
  state.missions = applyMissionEvent(state.missions, { type: "stamina_spent", amount: coins }, now);
  return { state, api: new FakeServer(state, { latencyMs: 0, now: () => now, random, persistSession: () => undefined }) };
}

describe("보물상자 카드 규칙", () => {
  it("상자 하나의 최선 기대값이 정규 이벤트 예산(코인 100당) 안이다", () => {
    for (const box of CHEST_BOXES) {
      expect(chestBoxExpectedValue(undefined, box) / box.entryCost * 100).toBeLessThanOrEqual(CHEST_FORGE_BUDGET.gemValuePer100Stamina);
    }
    const best = chestBoxExpectedValue();
    // 늘 안전 카드만 골라도 빈손은 아니고, 도박을 고를수록 기대값이 크다(2026-11-03 안전 카드 상향으로 3배 → 2.5배).
    const safe = chestBoxExpectedValue((cards) => cards[0]);
    expect(safe).toBeGreaterThan(100);
    expect(best).toBeGreaterThan(safe * 2.5);
  });

  it("200·300 코인 상자는 같은 확률에 수량만 정확히 2배·3배다", () => {
    const [small, large, grand] = CHEST_BOXES.map((box) => ({ box, ev: chestBoxExpectedValue(undefined, box) }));
    expect(small.box.entryCost).toBe(100); expect(large.box.entryCost).toBe(200); expect(grand.box.entryCost).toBe(300);
    // 수량은 정확히 2배·3배, 확률은 같다 — 기대값도 그대로 2배·3배다.
    expect(large.ev).toBeCloseTo(small.ev * 2, 6);
    expect(grand.ev).toBeCloseTo(small.ev * 3, 6);
    for (const card of CHEST_CARDS) {
      expect(chestCard(card.id, grand.box)).toMatchObject({ amount: card.amount * 3, chance: card.chance });
      expect(chestCard(card.id, large.box)).toMatchObject({ amount: card.amount * 2, chance: card.chance });
    }
    expect(chestGradeThresholds(grand.box)[0]).toBeGreaterThan(chestGradeThresholds(small.box)[0]);
  });

  it("등급이 오를수록 받을 확률은 낮고 한 장의 기대값은 크다", () => {
    const order = ["safe", "mid", "risk", "big", "jackpot"] as const;
    const ev = (tier: string) => Math.max(...CHEST_CARDS.filter((card) => card.tier === tier).map((card) => chestCardGemValue(card) * card.chance / 100));
    const chance = (tier: string) => Math.max(...CHEST_CARDS.filter((card) => card.tier === tier).map((card) => card.chance));
    for (let index = 1; index < order.length; index += 1) {
      expect(chance(order[index])).toBeLessThan(chance(order[index - 1]) + 1);
      expect(ev(order[index])).toBeGreaterThan(ev(order[index - 1]));
    }
    // 원석은 고고학이 주 수급처라 안전 카드에만 선다.
    expect(CHEST_CARDS.filter((card) => card.currency === "rawStone").every((card) => card.tier === "safe")).toBe(true);
  });

  it("1~4번째는 세 장, 마지막은 네 장이고 자리마다 정한 등급만 나온다", () => {
    for (let round = 0; round < CHEST_FORGE.rounds; round += 1) {
      for (const roll of [0, 0.5, 0.999]) {
        const offer = rollChestOffer(round, () => roll);
        expect(offer).toHaveLength(round === CHEST_FORGE.rounds - 1 ? 4 : 3);
        offer.forEach((id, slot) => expect(chestOfferSlots(round)[slot].map(([tier]) => tier)).toContain(chestCard(id)!.tier));
      }
    }
  });

  it("코인은 이번 주에 쓴 스테미나와 같고, 주가 바뀌면 사라지며 예전 강화형 장부는 상자 없이 읽힌다", () => {
    const state = createDefaultSession();
    const missions = applyMissionEvent(applyMissionEvent(state.missions, { type: "stamina_spent", amount: 700 }, MONDAY), { type: "stamina_spent", amount: 800 }, MONDAY);
    expect(chestForgeStatus(missions, createEmptyChestForgeState(), MONDAY).coins).toBe(1500);
    expect(chestForgeStatus(missions, { weekKey: "2026-11-02", spent: 300, run: null }, MONDAY).coins).toBe(1200);
    const run = { round: 2, offer: rollChestOffer(2, () => 0), collected: { gold: 10_000 } };
    expect(chestForgeStatus(missions, { weekKey: "2026-11-02", spent: 300, run }, new Date("2026-11-09T00:00:01Z"))).toMatchObject({ coins: 0, run, weekKey: "2026-11-09" });
    expect(normalizeChestForgeState({ weekKey: "2026-11-02", spent: 100, stage: 3 })).toEqual({ weekKey: "2026-11-02", spent: 100, run: null });
  });
});

describe("보물상자 등급", () => {
  /** 시드 고정 난수 — 같은 분포를 언제나 같은 값으로 잰다. */
  function seeded(seed: number): () => number {
    let state = seed >>> 0;
    return () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 2 ** 32; };
  }
  it("문턱은 최선으로 고른 상자의 최종 가치 분포에서 정한 자리에 선다", () => {
    const random = seeded(7);
    const boxes = 20_000;
    const reached = [0, 0, 0, 0, 0];
    for (let box = 0; box < boxes; box += 1) {
      const collected: Partial<Record<ChestCardCurrency, number>> = {};
      for (let round = 0; round < CHEST_FORGE.rounds; round += 1) {
        const card = chestBestCard(rollChestOffer(round, random).map((id) => chestCard(id)!));
        if (rollChestCard(card, random)) collected[card.currency] = (collected[card.currency] ?? 0) + card.amount;
      }
      reached[chestGrade(chestCollectedValue(collected))] += 1;
    }
    const atLeast = (grade: number) => reached.slice(grade).reduce((sum, count) => sum + count, 0) / boxes;
    expect(atLeast(1)).toBeGreaterThan(0.85);
    expect(atLeast(2)).toBeGreaterThan(0.5); expect(atLeast(2)).toBeLessThan(0.72);
    expect(atLeast(3)).toBeGreaterThan(0.15); expect(atLeast(3)).toBeLessThan(0.32);
    expect(atLeast(4)).toBeGreaterThan(0.02); expect(atLeast(4)).toBeLessThan(0.08);
  });
  it("모은 몫으로 등급과 다음 문턱까지의 비율을 구하고, 화려함은 카드 등급 차례다", () => {
    expect(chestGrade(0)).toBe(0);
    expect(chestGradeProgress(90)).toEqual({ grade: 0, ratio: 0.5 });
    expect(chestGrade(chestCollectedValue({ gems: 100, gold: 40_000 }))).toBe(1);
    expect(chestGradeProgress(5_000)).toEqual({ grade: CHEST_GRADE_MAX, ratio: 1 });
    expect(chestCardFlair(chestCard("safe-gold")!)).toBe(0);
    expect(chestCardFlair(chestCard("jackpot-gems-max")!)).toBe(4);
  });
});

describe("보물상자 서버", () => {
  it("상자를 열고 다섯 번 고르면 성공한 카드만 지급되고 상자가 닫힌다", async () => {
    const { api, state } = serverWithCoins(150, () => 0);
    const entered = await api.enterChestForge({ requestId: "a", box: "small" });
    expect(entered.status).toMatchObject({ coins: 50, run: { box: "small", round: 0, collected: {} } });
    const goldBefore = state.wallet.gold;
    let last = entered;
    for (let round = 0; round < CHEST_FORGE.rounds; round += 1) {
      const card = chestCard(last.status.run!.offer[0])!;
      last = await api.pickChestCard({ requestId: `p${round}`, index: 0 });
      expect(last.pick).toMatchObject({ index: 0, cardId: card.id, success: true });
    }
    expect(last.status.run).toBeNull();
    expect(last.pick?.total?.gold).toBe(state.wallet.gold - goldBefore);
  });

  it("실패한 카드만 놓치고, 같은 처리 ID는 다시 굴리지 않는다", async () => {
    let roll = 0;
    const { api, state } = serverWithCoins(100, () => roll);
    await api.enterChestForge({ requestId: "a", box: "small" });
    roll = 0.99; // 95% 카드도 0.99에서는 실패한다.
    const gemsBefore = state.wallet.gems;
    const failed = await api.pickChestCard({ requestId: "b", index: 0 });
    expect(failed.pick).toMatchObject({ success: false, granted: 0 });
    expect(failed.status.run?.round).toBe(1);
    roll = 0;
    const replay = await api.pickChestCard({ requestId: "b", index: 0 });
    expect(replay.pick?.success).toBe(false);
    expect(replay.status.run?.round).toBe(1);
    expect(state.wallet.gems).toBe(gemsBefore);
    await expect(api.pickChestCard({ requestId: "c", index: 9 })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("코인이 모자라거나 이미 연 상자가 있으면 열지 못한다", async () => {
    await expect(serverWithCoins(299, () => 0).api.enterChestForge({ requestId: "a", box: "grand" })).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
    await expect(serverWithCoins(600, () => 0).api.enterChestForge({ requestId: "a", box: "huge" as never })).rejects.toMatchObject({ code: "INVALID_STATE" });
    const { api } = serverWithCoins(600, () => 0);
    await api.enterChestForge({ requestId: "a", box: "small" });
    await expect(api.enterChestForge({ requestId: "b", box: "small" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("300 코인 상자는 키운 수량을 지급하고, 종류 없는 예전 상자는 작은 상자로 읽는다", async () => {
    const { api, state } = serverWithCoins(300, () => 0);
    const entered = await api.enterChestForge({ requestId: "a", box: "grand" });
    expect(entered.status.coins).toBe(0);
    const id = entered.status.run!.offer[0];
    const before = { ...state.wallet };
    const picked = await api.pickChestCard({ requestId: "p", index: 0 });
    const card = chestCard(id, chestBox("grand"))!;
    expect(picked.pick?.granted).toBe(Math.min(card.amount, card.amount));
    expect(state.wallet[card.currency] - before[card.currency]).toBe(picked.pick?.granted);
    expect(picked.status.run?.box).toBe("grand");
    const legacy = normalizeChestForgeState({ weekKey: "2026-11-02", spent: 200, run: { round: 1, offer: rollChestOffer(1, () => 0), collected: {} } });
    expect(legacy.run?.box).toBeUndefined();
  });
});

describe("보물상자 저장", () => {
  it("받은 차례대로 쌓인 모은 보상도 저장 검증을 지난다", async () => {
    const { isValidChestForgeState } = await import("../../src/core/chestForge");
    const run = { round: 1, offer: rollChestOffer(1, () => 0), collected: { gems: 100, gold: 10_000 } };
    expect(isValidChestForgeState({ weekKey: "2026-11-02", spent: 300, run })).toBe(true);
  });
});
