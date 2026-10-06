import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { claimableProgressPassFreeThresholds, claimableProgressPassThresholds, progressPassFreeStates, progressPassGoal, progressPassLevel, progressPassMilestoneStates } from "../../src/core/progressPass";
import { PROGRESS_PASSES, findProgressPass } from "../../src/data/progressPasses";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { CURRENT_SAVE_VERSION, SAVE_STORAGE_KEY, SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession, type SaveData } from "../../src/state/session";
import { passLevelOf, passReadyCount, passToOpen, storyPassStageId } from "../../src/ui/passPopupModel";
import { CATEGORY_TAB } from "../../src/ui/categoryTabStyle";
import { passPopupContentHeight, passPopupMinScroll, passPopupPassMinScroll, passPopupPassStrip, passPopupPassTabs, passPopupRailFill, passPopupRowY, passPopupScrollFor, passPopupViewport, modeToPassTabGap, PASS_POPUP } from "../../src/ui/passPopupLayout";

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

const story = findProgressPass("story")!;

describe("진행 패스 규칙", () => {
  it("열기 전에 닿은 마디는 '열면 받음', 연 뒤에는 받을 수 있음이 된다", () => {
    expect(progressPassMilestoneStates(story, 2, false, []).slice(0, 3)).toEqual(["reached", "reached", "locked"]);
    expect(progressPassMilestoneStates(story, 2, true, [1]).slice(0, 3)).toEqual(["claimed", "claimable", "locked"]);
    expect(claimableProgressPassThresholds(story, 5, true, [1])).toEqual([2, 4]);
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
    expect(progressPassFreeStates(story, 2, [1]).slice(0, 3)).toEqual(["claimed", "claimable", "locked"]);
    expect(claimableProgressPassFreeThresholds(story, 5, [1])).toEqual([2, 4]);
    for (const pass of PROGRESS_PASSES) for (const { free } of pass.milestones) expect(free.length).toBeGreaterThan(0);
  });

  it("패스 레벨은 닿은 마디 수이고 게이지는 마디 한 칸씩 끊긴다", () => {
    expect(progressPassLevel(story, 0)).toEqual({ level: 0, max: 15, fill: 0 });
    expect(progressPassLevel(story, 1)).toMatchObject({ level: 1, max: 15 });
    expect(progressPassLevel(story, 1).fill).toBeCloseTo(1 / 15);
    // 2 → 4 사이의 절반이면 세 번째 칸의 절반이 찬다.
    expect(progressPassLevel(story, 3).fill).toBeCloseTo(2.5 / 15);
    expect(progressPassLevel(story, 999)).toEqual({ level: 15, max: 15, fill: 1 });
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

  it("열다섯 줄은 창 안에서 흐르고, 처음 여는 자리는 그 범위 안이다", () => {
    for (const pass of PROGRESS_PASSES) expect(pass.milestones).toHaveLength(15);
    const view = passPopupViewport();
    expect(passPopupContentHeight(15)).toBeGreaterThan(view.height);
    expect(passPopupMinScroll(15)).toBe(view.height - passPopupContentHeight(15));
    for (const index of [0, 7, 14]) {
      const scroll = passPopupScrollFor(index, 15);
      expect(scroll).toBeLessThanOrEqual(0);
      expect(scroll).toBeGreaterThanOrEqual(passPopupMinScroll(15));
    }
    // 첫 줄의 판이 창 윗변 안에서 시작한다.
    expect(passPopupRowY(0) - PASS_POPUP.list.rowPlate / 2).toBeGreaterThanOrEqual(0);
  });

  it("세로 게이지는 닿은 레벨의 줄까지 차고 다음 줄을 향해 온 만큼 더 내려간다", () => {
    expect(passPopupRailFill(0, 15, 0)).toBe(0);
    expect(passPopupRailFill(3, 15, 0)).toBe(passPopupRowY(2));
    expect(passPopupRailFill(3, 15, 0.5)).toBe(passPopupRowY(2) + PASS_POPUP.list.rowHeight / 2);
    expect(passPopupRailFill(15, 15, 0)).toBe(passPopupContentHeight(15));
  });

  it("패스 탭 줄은 고정 폭 칸이 옆으로 흐르고, 오른쪽 끝은 창의 깎인 모서리 안쪽에서 잘린다", () => {
    // 패스가 늘어도 칸 폭은 그대로다.
    expect(passPopupPassTabs(3).width).toBe(passPopupPassTabs(8).width);
    expect(passPopupPassMinScroll(8)).toBeLessThan(passPopupPassMinScroll(3));
    const strip = passPopupPassStrip();
    const bevel = Math.min(PASS_POPUP.width, PASS_POPUP.height) * 0.14;
    for (const y of [strip.top, strip.bottom]) {
      // 빗변 (w/2, h/2 - bevel) → (w/2 - bevel, h/2) 안쪽에 선다.
      const edge = PASS_POPUP.width / 2 - Math.max(0, y - (PASS_POPUP.height / 2 - bevel));
      expect(strip.right(y)).toBeLessThan(edge);
    }
    // 미션·보상 줄은 패스 탭 줄 위에 겹치지 않고 붙는다.
    const modeBottom = PASS_POPUP.height / 2 - PASS_POPUP.modeRow.fromBottom + PASS_POPUP.modeRow.tabHeight / 2;
    expect(modeBottom).toBeLessThanOrEqual(strip.top + 22);
  });

  it("스토리 패스는 문턱을 관문 이름으로 읽는다", () => {
    expect(storyPassStageId(1)).toBe("1-1");
    expect(storyPassStageId(10)).toBe("1-10");
    expect(storyPassStageId(12)).toBe("2-2");
    expect(storyPassStageId(30)).toBe("3-10");
  });

});

describe("FakeServer 진행 패스", () => {
  it("열지 않아도 무료 칸은 받고, 연 뒤에는 지나온 유료 칸을 한꺼번에 한 번만 준다", async () => {
    const state = createDefaultSession();
    state.playerResearch = { ...state.playerResearch, level: 12 };
    const server = new FakeServer(state, { latencyMs: 0 });
    const free = await server.claimProgressPass({ passId: "level", requestId: "early" });
    expect(free.claimedFreeThresholds).toEqual([3, 5, 8, 10]);
    expect(free.claimedThresholds).toEqual([]);
    expect(state.progressPasses?.freeClaimed.level).toEqual([3, 5, 8, 10]);

    state.productPurchases["premium-level-pass"] = { periodKey: "once", count: 1 };
    const gems = state.wallet.gems;
    const first = await server.claimProgressPass({ passId: "level", requestId: "claim-1" });
    expect(first.claimedThresholds).toEqual([3, 5, 8, 10]);
    expect(state.wallet.gems).toBe(gems + 650);
    // 같은 요청을 다시 보내도 두 번 주지 않는다.
    await expect(server.claimProgressPass({ passId: "level", requestId: "claim-1" })).resolves.toEqual(first);
    expect(state.wallet.gems).toBe(gems + 650);
    await expect(server.claimProgressPass({ passId: "level", requestId: "claim-2" })).rejects.toMatchObject({ code: "NOTHING_TO_CLAIM" });

    const listed = (await server.getProgressPasses()).passes.find(({ id }) => id === "level")!;
    expect(listed).toMatchObject({ owned: true, progress: 12 });
    expect(listed.milestones.slice(3, 6).map(({ state: s }) => s)).toEqual(["claimed", "locked", "locked"]);
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

    // 길을 다시 짜 사라진 문턱(스토리 3·5)은 걷히고 남는 문턱(1)만 남는다.
    const reshaped = { ...saved, progressPasses: { raidRuns: 0, claimed: { story: [1, 3, 5] }, freeClaimed: { story: [3] } } } as Record<string, unknown>;
    expect(manager.migrate(reshaped)).toMatchObject({ progressPasses: { claimed: { story: [1] }, freeClaimed: { story: [] } } });
    storage.setItem(SAVE_STORAGE_KEY, JSON.stringify(reshaped));
    expect(manager.load()!.progressPasses?.claimed.story).toEqual([1]);

    const v45 = { ...saved, saveVersion: 45, progressPasses: { raidRuns: 2, claimed: {} } } as Record<string, unknown>;
    expect(manager.migrate(v45)).toMatchObject({ progressPasses: { raidRuns: 2, claimed: {}, freeClaimed: {} } });
  });
});

describe("패스 창 탭 줄 간격", () => {
  it("켜진 패스 탭이 솟고 커져도 위의 미션·보상 탭을 가리지 않는다", () => {
    expect(modeToPassTabGap(CATEGORY_TAB)).toBeGreaterThanOrEqual(8);
  });
});

describe("패스 탭 줄의 오른쪽 잘림", () => {
  it("뒷 판 빗변과 평행하고, 빗변까지의 간격이 왼쪽 여백과 같다", () => {
    const strip = passPopupPassStrip();
    const { passRow, width, height, inner } = PASS_POPUP;
    // 평행: y가 1 내려갈 때 오른쪽 끝이 정확히 1 물러난다(45도 빗변).
    const y = height / 2 - passRow.fromBottom;
    expect(strip.right(y) - strip.right(y + 1)).toBeCloseTo(1);
    // 빗변까지의 수직 거리 = 가로 물러남 / √2.
    const bevelX = width / 2 - (y - (height / 2 - Math.min(width, height) * 0.14));
    expect((bevelX - strip.right(y)) / Math.SQRT2).toBeCloseTo((width - inner) / 2);
  });

  it("탭이 네 칸이어도 흐르는 줄은 보이는 창 안에서 끝까지 닿는다", () => {
    const four = passPopupPassMinScroll(4);
    expect(four).toBeLessThan(passPopupPassMinScroll(3));
    const visible = passPopupPassStrip().right(PASS_POPUP.height / 2 - PASS_POPUP.passRow.fromBottom) - passPopupPassStrip().left;
    expect(passPopupPassTabs(4).span + four).toBeCloseTo(visible);
  });
});

describe("패스 유료 칸의 짜임", () => {
  it("마디마다 다양한 보상 하나 + 다이아 고정이고, 길 끝의 다이아가 가장 크다", () => {
    for (const pass of PROGRESS_PASSES) {
      for (const { rewards } of pass.milestones) {
        expect(rewards, pass.id).toHaveLength(2);
        expect(rewards[0]!.kind === "currency" && rewards[0]!.currency === "gems", pass.id).toBe(false);
        expect(rewards[1]).toMatchObject({ kind: "currency", currency: "gems" });
      }
      const gems = pass.milestones.map(({ rewards }) => (rewards[1] as { amount: number }).amount);
      expect([...gems].sort((a, b) => a - b)).toEqual(gems);
      expect(gems[gems.length - 1]).toBeGreaterThanOrEqual(gems[gems.length - 2]! * 1.5);
    }
  });

  it("패스 카드는 프리미엄 탭에서도 같은 상품으로 팔리고, 값어치는 길 끝까지 걸었을 때의 합으로 센다", async () => {
    const { premiumGemValue, premiumValueMultiple } = await import("../../src/core/premiumValue");
    const { PREMIUM_GEM_PER_KRW } = await import("../../src/data/premiumProducts");
    for (const id of ["premium-story-pass", "premium-level-pass", "premium-raid-pass"]) {
      const product = PREMIUM_PRODUCTS.find((p) => p.id === id)! as never;
      expect(premiumGemValue(product)).toBeGreaterThan(4_000);
      const multiple = premiumValueMultiple(product, PREMIUM_GEM_PER_KRW)!;
      expect(multiple, id).toBeGreaterThanOrEqual(2.5);
      expect(multiple, id).toBeLessThanOrEqual(4);
    }
  });
});
