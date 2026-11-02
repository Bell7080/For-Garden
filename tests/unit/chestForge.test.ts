import { describe, expect, it } from "vitest";
import { SettingsManager } from "../../src/managers/SettingsManager";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { applyMissionEvent } from "../../src/core/missions";
import {
  CHEST_FORGE, CHEST_FORGE_MAX_STAGE, CHEST_FORGE_STAGES, chestForgeGemValue, chestForgeReachRate, chestForgeStatus, createEmptyChestForgeState,
} from "../../src/core/chestForge";

void SettingsManager;
const MONDAY = new Date("2026-11-02T03:00:00Z");

function serverWithCoins(coins: number, random: () => number, now = MONDAY) {
  const state = createDefaultSession();
  state.missions = applyMissionEvent(state.missions, { type: "stamina_spent", amount: coins }, now);
  return { state, api: new FakeServer(state, { latencyMs: 0, now: () => now, random, persistSession: () => undefined }) };
}

describe("보물상자 규칙", () => {
  it("어느 단계에서 멈춰도 기대값이 젬 환산 15~25 안이고 최종 보상은 1,000이다", () => {
    const expected = CHEST_FORGE_STAGES.map((stage, index) => chestForgeReachRate(index) * chestForgeGemValue(stage.reward));
    for (const value of expected) { expect(value).toBeGreaterThanOrEqual(15); expect(value).toBeLessThanOrEqual(25); }
    expect(chestForgeGemValue(CHEST_FORGE_STAGES[CHEST_FORGE_MAX_STAGE].reward)).toBe(1000);
    // 보상은 단계가 오를수록 커지고 확률은 줄어든다.
    for (let index = 1; index < CHEST_FORGE_STAGES.length; index += 1) {
      expect(chestForgeGemValue(CHEST_FORGE_STAGES[index].reward)).toBeGreaterThan(chestForgeGemValue(CHEST_FORGE_STAGES[index - 1].reward));
      if (index > 1) expect(CHEST_FORGE_STAGES[index].chance).toBeLessThan(CHEST_FORGE_STAGES[index - 1].chance);
    }
    // 한 판 최선 기대값이 코인 100(= 스테미나 100 ≈ 젬 83)의 35%를 넘지 않는다.
    expect(Math.max(...expected)).toBeLessThan(CHEST_FORGE.entryCost * 0.83 * 0.35);
  });

  it("코인은 이번 주에 쓴 스테미나와 같고, 주가 바뀌면 사라진다", () => {
    const state = createDefaultSession();
    const missions = applyMissionEvent(applyMissionEvent(state.missions, { type: "stamina_spent", amount: 700 }, MONDAY), { type: "stamina_spent", amount: 800 }, MONDAY);
    // 주간 임무 진행(목표 600)에서 잘리지 않는다.
    expect(chestForgeStatus(missions, createEmptyChestForgeState(), MONDAY).coins).toBe(1500);
    expect(chestForgeStatus(missions, { weekKey: "2026-11-02", spent: 300, stage: null }, MONDAY).coins).toBe(1200);
    expect(chestForgeStatus(missions, { weekKey: "2026-11-02", spent: 300, stage: 2 }, new Date("2026-11-09T00:00:01Z"))).toMatchObject({ coins: 0, stage: 2, weekKey: "2026-11-09" });
  });
});

describe("보물상자 서버", () => {
  it("받기 → 강화 → 보상 받기가 코인을 쓰고 지급을 확정한다", async () => {
    const { api, state } = serverWithCoins(250, () => 0);
    const entered = await api.enterChestForge({ requestId: "a" });
    expect(entered.status).toMatchObject({ coins: 150, stage: 0, nextChance: 100 });
    const upgraded = await api.upgradeChestForge({ requestId: "b" });
    expect(upgraded.success).toBe(true);
    expect(upgraded.status.stage).toBe(1);
    const goldBefore = state.wallet.gold;
    const claimed = await api.claimChestForge({ requestId: "c" });
    expect(claimed.granted).toEqual({ gold: 4000, cheesecake: 4, gems: 2 });
    expect(state.wallet.gold).toBe(goldBefore + 4000);
    expect(claimed.status.stage).toBeNull();
  });

  it("실패하면 상자가 깨지고, 같은 처리 ID는 다시 굴리지 않는다", async () => {
    let roll = 0;
    const { api } = serverWithCoins(100, () => roll);
    await api.enterChestForge({ requestId: "a" });
    await api.upgradeChestForge({ requestId: "b" });
    roll = 0.95; // 2단계 90%는 0.95에서 실패한다.
    const failed = await api.upgradeChestForge({ requestId: "c" });
    expect(failed.success).toBe(false);
    expect(failed.status.stage).toBeNull();
    roll = 0;
    const replay = await api.upgradeChestForge({ requestId: "c" });
    expect(replay.success).toBe(false);
    await expect(api.claimChestForge({ requestId: "d" })).rejects.toMatchObject({ code: "INVALID_STATE" });
  });

  it("코인이 모자라면 받지 못한다", async () => {
    const { api } = serverWithCoins(99, () => 0);
    await expect(api.enterChestForge({ requestId: "a" })).rejects.toMatchObject({ code: "INSUFFICIENT_CURRENCY" });
  });
});
