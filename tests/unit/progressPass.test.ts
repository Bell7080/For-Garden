import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { claimableProgressPassThresholds, progressPassGoal, progressPassMilestoneStates } from "../../src/core/progressPass";
import { PROGRESS_PASSES, findProgressPass } from "../../src/data/progressPasses";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { CURRENT_SAVE_VERSION, SAVE_STORAGE_KEY, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type SaveData } from "../../src/state/session";
import { progressPassAction } from "../../src/ui/premiumModel";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const story = findProgressPass("story")!;

describe("진행 패스 규칙", () => {
  it("열기 전에 닿은 마디는 '열면 받음', 연 뒤에는 받을 수 있음이 된다", () => {
    expect(progressPassMilestoneStates(story, 3, false, []).slice(0, 3)).toEqual(["reached", "reached", "locked"]);
    expect(progressPassMilestoneStates(story, 3, true, [1]).slice(0, 3)).toEqual(["claimed", "claimable", "locked"]);
    expect(claimableProgressPassThresholds(story, 5, true, [1])).toEqual([3, 5]);
    expect(claimableProgressPassThresholds(story, 5, false, [])).toEqual([]);
  });

  it("의 길은 오름차순이고 패스마다 여는 상품이 프리미엄 '패스' 칸에 있다", () => {
    for (const pass of PROGRESS_PASSES) {
      const thresholds = pass.milestones.map(({ threshold }) => threshold);
      expect([...thresholds].sort((a, b) => a - b)).toEqual(thresholds);
      expect(new Set(thresholds).size).toBe(thresholds.length);
      expect(progressPassGoal(pass)).toBe(thresholds[thresholds.length - 1]);
      const product = PREMIUM_PRODUCTS.find(({ id }) => id === pass.productId)!;
      expect(product.premiumCategory).toBe("pass");
      // 패스는 사는 순간 쏟아 주지 않는다 — 보상은 길의 마디가 준다.
      expect(product.grants ?? []).toEqual([]);
    }
  });

  it("화면의 버튼은 열기 → 받기 → 진행 중 → 완료 순으로 바뀐다", () => {
    const milestones = (states: string[]) => states.map((state, index) => ({ threshold: index + 1, rewards: [], state })) as never;
    expect(progressPassAction({ owned: false, milestones: milestones(["reached", "locked"]) })).toBe("buy");
    expect(progressPassAction({ owned: true, milestones: milestones(["claimable", "locked"]) })).toBe("claim");
    expect(progressPassAction({ owned: true, milestones: milestones(["claimed", "locked"]) })).toBe("progress");
    expect(progressPassAction({ owned: true, milestones: milestones(["claimed", "claimed"]) })).toBe("complete");
  });
});

describe("FakeServer 진행 패스", () => {
  it("열지 않은 패스는 받지 못하고, 연 뒤에는 지나온 마디를 한꺼번에 한 번만 준다", async () => {
    const state = createDefaultSession();
    state.playerResearch = { ...state.playerResearch, level: 12 };
    const server = new FakeServer(state, { latencyMs: 0 });
    await expect(server.claimProgressPass({ passId: "level", requestId: "early" })).rejects.toMatchObject({ code: "PASS_NOT_FOUND" });

    state.productPurchases["premium-level-pass"] = { periodKey: "once", count: 1 };
    const gems = state.wallet.gems;
    const first = await server.claimProgressPass({ passId: "level", requestId: "claim-1" });
    expect(first.claimedThresholds).toEqual([5, 10]);
    expect(state.wallet.gems).toBe(gems + 200);
    // 같은 요청을 다시 보내도 두 번 주지 않는다.
    await expect(server.claimProgressPass({ passId: "level", requestId: "claim-1" })).resolves.toEqual(first);
    expect(state.wallet.gems).toBe(gems + 200);
    await expect(server.claimProgressPass({ passId: "level", requestId: "claim-2" })).rejects.toMatchObject({ code: "NOTHING_TO_CLAIM" });

    const listed = (await server.getProgressPasses()).passes.find(({ id }) => id === "level")!;
    expect(listed).toMatchObject({ owned: true, progress: 12 });
    expect(listed.milestones.slice(0, 3).map(({ state: s }) => s)).toEqual(["claimed", "claimed", "locked"]);
  });
});

describe("저장 v45 진행 패스", () => {
  it("v44 저장은 빈 진행 패스로 올라오고 받은 마디는 왕복한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const session = createDefaultSession();
    session.progressPasses = { raidRuns: 4, claimed: { raid: [1, 3] } };
    manager.save(session);
    const saved = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    expect(manager.load()!.progressPasses).toEqual({ raidRuns: 4, claimed: { raid: [1, 3] } });

    const legacy = { ...saved, saveVersion: 44 } as Record<string, unknown>;
    delete legacy.progressPasses;
    expect(manager.migrate(legacy)).toMatchObject({ saveVersion: CURRENT_SAVE_VERSION, progressPasses: { raidRuns: 0, claimed: {} } });
  });
});
