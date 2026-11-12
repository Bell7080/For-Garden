import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { resolveAcquisitions } from "../../src/core/gacha";
import { BREAKTHROUGH_CAP, calculateFinalStats } from "../../src/core/relicProgression";
import {
  RESONANCE_CAP, RESONANCE_CHEESECAKE, RESONANCE_FRAGMENTS, canResonate, relicFragmentRoom, remainingResonanceFragments,
  resonanceFragmentRoom, resonanceFragmentSpend, resonanceOf, resonanceStatEffect,
} from "../../src/core/relicResonance";
import { RELICS } from "../../src/data/relics";
import { createDefaultSession } from "../../src/state/session";
import { SaveManager } from "../../src/state/SaveManager";

describe("공명 규칙", () => {
  it("등급별 파편 표와 합이 승인한 값과 같다", () => {
    expect(RESONANCE_FRAGMENTS).toEqual({ SSR: [1, 1, 2, 2, 3], SR: [2, 2, 3, 3, 4], R: [4, 4, 6, 6, 8] });
    expect(remainingResonanceFragments("SSR", 0)).toBe(9);
    expect(remainingResonanceFragments("SR", 2)).toBe(10);
    expect(remainingResonanceFragments("R", 5)).toBe(0);
    expect(RESONANCE_CHEESECAKE).toBe(2_000);
  });

  it("저장값을 믿지 않고 0~5 정수로 맞춘다", () => {
    expect(resonanceOf(undefined)).toBe(0);
    expect(resonanceOf({ resonance: 9 })).toBe(RESONANCE_CAP);
    expect(resonanceOf({ resonance: 1.5 })).toBe(0);
  });

  it("그 개체의 파편을 먼저 쓰고 모자란 몫만 만능 파편이 채운다", () => {
    expect(resonanceFragmentSpend("SR", 2, 1, 5)).toEqual({ own: 1, universal: 2, enough: true });
    expect(resonanceFragmentSpend("SR", 2, 0, 1)).toEqual({ own: 0, universal: 1, enough: false });
    expect(resonanceFragmentSpend("SSR", 5, 9, 9).enough).toBe(false);
  });

  it("돌파를 끝내야 공명할 수 있고 치즈케이크가 함께 든다", () => {
    expect(canResonate("SSR", { breakthrough: BREAKTHROUGH_CAP - 1 }, BREAKTHROUGH_CAP, 9, 99_999, 0)).toBe(false);
    expect(canResonate("SSR", { breakthrough: BREAKTHROUGH_CAP }, BREAKTHROUGH_CAP, 1, RESONANCE_CHEESECAKE, 0)).toBe(true);
    expect(canResonate("SSR", { breakthrough: BREAKTHROUGH_CAP }, BREAKTHROUGH_CAP, 1, RESONANCE_CHEESECAKE - 1, 0)).toBe(false);
    expect(canResonate("SSR", { breakthrough: BREAKTHROUGH_CAP, resonance: RESONANCE_CAP }, BREAKTHROUGH_CAP, 9, 99_999, 0)).toBe(false);
  });

  it("받을 수 있는 파편 수는 돌파 중이면 끝이 없고 돌파 V면 공명 V까지 남은 몫이다", () => {
    expect(relicFragmentRoom("SR", { breakthrough: 2 }, 40, BREAKTHROUGH_CAP)).toBe(Number.POSITIVE_INFINITY);
    expect(relicFragmentRoom("SR", { breakthrough: BREAKTHROUGH_CAP }, 3, BREAKTHROUGH_CAP)).toBe(11);
    expect(resonanceFragmentRoom("SSR", RESONANCE_CAP, 0)).toBe(0);
  });

  it("단계마다 오각형 다섯만 5%씩 더해 오르고, PvP 선택은 공명을 끈다", () => {
    expect(resonanceStatEffect(2)).toEqual({ hp: 10, def: 10, res: 10, atk: 10, ap: 10 });
    const def = RELICS.find(({ id }) => id === "torika")!;
    const progress = { level: 1, exp: 0, breakthrough: BREAKTHROUGH_CAP, bondLevel: 0, bondXp: 0, lastLobbyInteractionDate: "", heartGemSlots: [null, null, null] as [null, null, null] };
    const plain = calculateFinalStats(def.stats, progress, [], def.rarity);
    const resonated = calculateFinalStats(def.stats, { ...progress, resonance: 5 }, [], def.rarity);
    const pvp = calculateFinalStats(def.stats, { ...progress, resonance: 5 }, [], def.rarity, { resonance: false });
    expect(resonated.hp).toBeCloseTo(plain.hp * 1.25, -1);
    expect(resonated.atk).toBeGreaterThan(plain.atk);
    expect(resonated.attackSpeed).toBe(plain.attackSpeed);
    expect(pvp).toEqual(plain);
  });
});

describe("연구소 중복", () => {
  it("돌파 V 개체의 중복은 공명에 쓸 몫만큼 파편이 되고 그 뒤만 마일리지가 된다", () => {
    const outcome = resolveAcquisitions(new Set(["a"]), { a: 0 }, ["a", "a", "a"], { a: 5 }, 5, () => 30, { a: 2 });
    expect(outcome.slots.map(({ kind }) => kind)).toEqual(["fragment", "fragment", "overflow"]);
    expect(outcome.fragmentsById.a).toBe(2);
    expect(outcome.overflowFragments).toBe(30);
  });
});

describe("FakeServer 공명", () => {
  function setup() {
    const state = createDefaultSession();
    state.owned.add("torika");
    state.relicProgress.torika = { ...state.relicProgress.torika!, level: 60, exp: 0, breakthrough: BREAKTHROUGH_CAP };
    return { state, api: new FakeServer(state, { latencyMs: 0, persistSession: () => undefined }) };
  }

  it("돌파 V에서 같은 조작이 공명을 한 단계 올리고 파편·만능 파편·치즈케이크를 쓴다", async () => {
    const { state, api } = setup();
    state.relicFragments.torika = 1;
    state.itemInventory = [...state.itemInventory.filter(({ itemId }) => itemId !== "universal-fragment-sr"), { itemId: "universal-fragment-sr", quantity: 3 }];
    state.wallet.cheesecake = RESONANCE_CHEESECAKE + 10;
    const response = await api.breakThroughRelic("torika");
    expect(response).toMatchObject({ breakthrough: BREAKTHROUGH_CAP, resonance: 1, fragments: 0, universalFragmentsUsed: 1 });
    expect(state.relicProgress.torika?.resonance).toBe(1);
    expect(state.wallet.cheesecake).toBe(10);
    expect(state.itemInventory.find(({ itemId }) => itemId === "universal-fragment-sr")?.quantity).toBe(2);
    await expect(api.breakThroughRelic("torika")).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
  });

  it("공명 V면 더 오르지 않는다", async () => {
    const { state, api } = setup();
    state.relicProgress.torika = { ...state.relicProgress.torika!, resonance: RESONANCE_CAP };
    state.relicFragments.torika = 99; state.wallet.cheesecake = 99_999;
    await expect(api.breakThroughRelic("torika")).rejects.toMatchObject({ code: "RELIC_MAX_LEVEL" });
  });

  it("저장은 돌파 V 아래의 공명과 범위 밖 값을 거절하고 정상 값은 그대로 오간다", () => {
    const { state } = setup();
    const saves = new SaveManager(undefined);
    state.relicProgress.torika = { ...state.relicProgress.torika!, resonance: 3 };
    expect(saves.parse(JSON.parse(JSON.stringify(saves.exportData(state)))).relicProgress.torika?.resonance).toBe(3);
    state.relicProgress.torika = { ...state.relicProgress.torika!, resonance: 6 };
    expect(() => saves.parse(JSON.parse(JSON.stringify(saves.exportData(state))))).toThrow();
    state.relicProgress.torika = { ...state.relicProgress.torika!, breakthrough: 1, resonance: 1 };
    expect(() => saves.parse(JSON.parse(JSON.stringify(saves.exportData(state))))).toThrow();
  });
});
