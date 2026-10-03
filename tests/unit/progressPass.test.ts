import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { claimableProgressPassFreeThresholds, claimableProgressPassThresholds, progressPassFreeStates, progressPassGoal, progressPassLevel, progressPassMilestoneStates } from "../../src/core/progressPass";
import { PROGRESS_PASSES, findProgressPass } from "../../src/data/progressPasses";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { CURRENT_SAVE_VERSION, SAVE_STORAGE_KEY, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type SaveData } from "../../src/state/session";
import { passLevelOf, passReadyCount, passToOpen } from "../../src/ui/passPopupModel";
import { PASS_POPUP, passPopupListBottom, passPopupRowY } from "../../src/ui/passPopupLayout";

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

  it("무료 칸은 열지 않아도 닿으면 받고, 따로 센다", () => {
    expect(progressPassFreeStates(story, 3, [1]).slice(0, 3)).toEqual(["claimed", "claimable", "locked"]);
    expect(claimableProgressPassFreeThresholds(story, 5, [1])).toEqual([3, 5]);
    for (const pass of PROGRESS_PASSES) for (const { free } of pass.milestones) expect(free.length).toBeGreaterThan(0);
  });

  it("패스 레벨은 닿은 마디 수이고 게이지는 마디 한 칸씩 끊긴다", () => {
    expect(progressPassLevel(story, 0)).toEqual({ level: 0, max: 10, fill: 0 });
    expect(progressPassLevel(story, 1)).toEqual({ level: 1, max: 10, fill: 0.1 });
    // 1 → 3 사이의 절반이면 두 번째 칸의 절반이 찬다.
    expect(progressPassLevel(story, 2).fill).toBeCloseTo(0.15);
    expect(progressPassLevel(story, 999)).toEqual({ level: 10, max: 10, fill: 1 });
  });
});

describe("로비 패스 창 모델", () => {
  const dto = (id: "story" | "level", freeStates: string[], states: string[], progress = 0) => ({
    id, progress, owned: false,
    milestones: freeStates.map((freeState, index) => ({ threshold: index + 1, free: [], rewards: [], freeState, state: states[index] })),
  }) as never;

  it("받을 수는 무료 칸과 유료 칸을 함께 세고, 받을 것이 있는 패스를 먼저 연다", () => {
    const quiet = dto("story", ["claimed", "locked"], ["claimed", "locked"]);
    const ready = dto("level", ["claimable", "locked"], ["claimable", "locked"], 1);
    expect(passReadyCount(quiet)).toBe(0);
    expect(passReadyCount(ready)).toBe(2);
    expect(passToOpen([quiet, ready])).toBe(ready);
    expect(passToOpen([quiet])).toBe(quiet);
    expect(passLevelOf(ready)).toMatchObject({ level: 1, max: 2 });
  });

  it("마디 열 줄이 탭 줄 위에서 끝난다", () => {
    const rows = Math.max(...PROGRESS_PASSES.map(({ milestones }) => milestones.length));
    expect(passPopupRowY(rows - 1) + PASS_POPUP.list.rowPlate / 2).toBeLessThanOrEqual(passPopupListBottom());
  });
});

describe("FakeServer 진행 패스", () => {
  it("열지 않아도 무료 칸은 받고, 연 뒤에는 지나온 유료 칸을 한꺼번에 한 번만 준다", async () => {
    const state = createDefaultSession();
    state.playerResearch = { ...state.playerResearch, level: 12 };
    const server = new FakeServer(state, { latencyMs: 0 });
    const free = await server.claimProgressPass({ passId: "level", requestId: "early" });
    expect(free.claimedFreeThresholds).toEqual([5, 10]);
    expect(free.claimedThresholds).toEqual([]);
    expect(state.progressPasses?.freeClaimed.level).toEqual([5, 10]);

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

describe("저장 v46 진행 패스", () => {
  it("v44 저장은 빈 진행 패스로 올라오고 받은 마디(무료 포함)는 왕복한다", () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    const session = createDefaultSession();
    session.progressPasses = { raidRuns: 4, claimed: { raid: [1, 3] }, freeClaimed: { raid: [1] } };
    manager.save(session);
    const saved = JSON.parse(storage.getItem(SAVE_STORAGE_KEY)!) as SaveData;
    expect(manager.load()!.progressPasses).toEqual({ raidRuns: 4, claimed: { raid: [1, 3] }, freeClaimed: { raid: [1] } });

    const legacy = { ...saved, saveVersion: 44 } as Record<string, unknown>;
    delete legacy.progressPasses;
    expect(manager.migrate(legacy)).toMatchObject({ saveVersion: CURRENT_SAVE_VERSION, progressPasses: { raidRuns: 0, claimed: {}, freeClaimed: {} } });

    const v45 = { ...saved, saveVersion: 45, progressPasses: { raidRuns: 2, claimed: {} } } as Record<string, unknown>;
    expect(manager.migrate(v45)).toMatchObject({ progressPasses: { raidRuns: 2, claimed: {}, freeClaimed: {} } });
  });
});
