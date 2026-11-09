import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { normalizeMissions } from "../../src/core/missions";
import { SEASON_TIER_POINTS, SEASON_TIERS, addSeasonPoints, rollSeasonPassState, seasonEndsAt, seasonKey } from "../../src/core/seasonPass";
import { SEASON_PASS } from "../../src/data/progressPasses";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { productsForPremiumCategory } from "../../src/ui/premiumModel";
import { createDefaultSession } from "../../src/state/session";

function total(kind: "free" | "paid", match: (grant: { kind: string; currency?: string; itemId?: string; decorationId?: string }) => boolean, field: "amount" | "quantity" = "amount"): number {
  let sum = 0;
  for (const milestone of SEASON_PASS.milestones) {
    for (const grant of kind === "free" ? milestone.free ?? [] : milestone.rewards) {
      if (match(grant as never)) sum += (grant as unknown as Record<string, number>)[field] ?? 1;
    }
  }
  return sum;
}

describe("시즌 패스 정의", () => {
  it("30단계 · 단계마다 연구도 180이고 유료 길의 합이 승인한 표와 같다", () => {
    expect(SEASON_PASS.milestones).toHaveLength(SEASON_TIERS);
    expect(SEASON_PASS.milestones.map(({ threshold }) => threshold)).toEqual(Array.from({ length: 30 }, (_, i) => (i + 1) * SEASON_TIER_POINTS));
    expect(total("paid", (g) => g.kind === "currency" && g.currency === "gems")).toBe(3_000);
    expect(total("paid", (g) => g.kind === "currency" && g.currency === "fossil")).toBe(8);
    expect(total("paid", (g) => g.kind === "currency" && g.currency === "amber")).toBe(2);
    expect(total("paid", (g) => g.kind === "item" && g.itemId === "universal-fragment-sr", "quantity")).toBe(1);
    expect(total("paid", (g) => g.kind === "item" && g.itemId === "stamina-tonic-large", "quantity")).toBe(6);
    const last = SEASON_PASS.milestones[SEASON_TIERS - 1]!.rewards;
    expect(last.some((g) => g.kind === "profile_decoration" && g.decorationId === "season")).toBe(true);
    expect(total("free", (g) => g.kind === "currency" && g.currency === "fossil")).toBe(3);
  });

  it("상품은 ₩9,900 시즌 주기이고 프리미엄 패스 칸 목록에는 따로 서지 않는다", () => {
    const product = PREMIUM_PRODUCTS.find(({ id }) => id === SEASON_PASS.productId)!;
    expect(product).toMatchObject({ refresh: "season", purchaseLimit: 1 });
    expect(product.acquisition).toMatchObject({ kind: "platform_payment" })
    expect(JSON.stringify(product.acquisition)).toContain("9900");
    expect(productsForPremiumCategory(PREMIUM_PRODUCTS as never, "pass").some(({ id }) => id === product.id)).toBe(false);
  });
});

describe("시즌 시계", () => {
  it("2026-11-02 월요일부터 28일씩 끊는다", () => {
    expect(seasonKey(new Date("2026-11-09T00:00:00Z"))).toBe("S1");
    expect(seasonEndsAt(new Date("2026-11-09T00:00:00Z"))).toBe("2026-11-30T00:00:00.000Z");
    expect(seasonKey(new Date("2026-11-30T00:00:00Z"))).toBe("S2");
  });

  it("연구도는 길 끝에서 멈추고, 시즌이 바뀌면 진행과 받은 칸이 함께 비워진다", () => {
    const now = new Date("2026-11-09T00:00:00Z");
    expect(addSeasonPoints(undefined, 99_999, now)).toEqual({ key: "S1", points: SEASON_TIER_POINTS * SEASON_TIERS });
    const passes = { claimed: { season: [180], level: [2] }, freeClaimed: { season: [180] }, season: { key: "S1", points: 400 } };
    expect(rollSeasonPassState(passes, now)).toBe(passes);
    const rolled = rollSeasonPassState(passes, new Date("2026-12-01T00:00:00Z"));
    expect(rolled).toEqual({ claimed: { level: [2] }, freeClaimed: {}, season: { key: "S2", points: 0 } });
  });
});

describe("FakeServer 시즌 패스", () => {
  function setup() {
    let clock = new Date("2026-11-09T12:00:00Z");
    const state = createDefaultSession();
    const api = new FakeServer(state, { latencyMs: 0, now: () => clock, persistSession: () => undefined });
    return { state, api, setClock: (at: string) => { clock = new Date(at); } };
  }

  it("임무를 받으면 그 연구도가 시즌 진행에도 오른다", async () => {
    const { state, api } = setup();
    state.missions = normalizeMissions(state.missions, new Date("2026-11-09T12:00:00Z"));
    state.missions.progress = { ...state.missions.progress, "daily-battle": 1 };
    await api.claimMissionRewards(["daily-battle"]);
    expect(state.progressPasses?.season).toEqual({ key: "S1", points: 20 });
    const listed = (await api.getProgressPasses()).passes.find(({ id }) => id === "season")!;
    expect(listed).toMatchObject({ metric: "seasonPoints", progress: 20, owned: false, season: { key: "S1", endsAt: "2026-11-30T00:00:00.000Z" } });
  });

  it("이번 시즌에 산 패스만 열리고, 30단계에서 시즌 테두리를 준다", async () => {
    const { state, api, setClock } = setup();
    state.progressPasses = { claimed: {}, freeClaimed: {}, raidRuns: 0, season: { key: "S1", points: SEASON_TIER_POINTS * SEASON_TIERS } };
    state.productPurchases["premium-season-pass"] = { periodKey: "S1", count: 1 };
    const gems = state.wallet.gems;
    const result = await api.claimProgressPass({ passId: "season", requestId: "season-all" });
    expect(result.claimedThresholds).toHaveLength(30);
    expect(result.claimedFreeThresholds).toHaveLength(30);
    expect(state.wallet.gems).toBe(gems + 3_000);
    expect(state.achievements?.giftFrames).toContain("season");

    // 다음 시즌 — 지난 시즌의 구매는 열지 않고 받은 칸·진행은 처음부터다.
    setClock("2026-12-01T00:00:00Z");
    const next = (await api.getProgressPasses()).passes.find(({ id }) => id === "season")!;
    expect(next).toMatchObject({ owned: false, progress: 0 });
    expect(next.milestones.every(({ state: s }) => s !== "claimed")).toBe(true);
  });
});
