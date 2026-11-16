import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import {
  addPatronFund, createEmptyPatronState, fundForPriceKrw, isValidPatronState, normalizePatronState, PATRON_FRAME_IDS, PATRON_SETTLE_MS,
  PATRON_TIERS, patronDailyAvailable, patronHasClaimable, patronRewardStatus, patronTierOf, refundPatronFund,
} from "../../src/core/patronStrata";
import { GIFT_FRAME_IDS } from "../../src/core/achievementState";
import { PROFILE_FRAMES } from "../../src/data/profileFrames";
import { PROFILE_MODIFIERS } from "../../src/data/profileModifiers";

const NOW = new Date("2026-11-16T12:00:00Z");

describe("후원 지층 — 규칙", () => {
  it("지층은 일곱이고 문턱이 오르막이며, 표토만 기념품이 없다", () => {
    expect(PATRON_TIERS.map(({ id }) => id)).toEqual(["topsoil", "sediment", "fossil", "amber", "bedrock", "deep", "core"]);
    PATRON_TIERS.slice(1).forEach((tier, i) => expect(tier.threshold).toBeGreaterThan(PATRON_TIERS[i].threshold));
    expect(PATRON_TIERS[0].reward).toEqual([]);
    for (const tier of PATRON_TIERS.slice(1)) expect(tier.reward.length).toBeGreaterThan(0);
  });

  it("결제 ₩100마다 기금 1이고 끝자리는 버린다", () => {
    expect(fundForPriceKrw(1_200)).toBe(12);
    expect(fundForPriceKrw(59_900)).toBe(599);
    expect(fundForPriceKrw(99)).toBe(0);
    expect(fundForPriceKrw(Number.NaN)).toBe(0);
  });

  it("무료 몫으로 닿은 지층은 곧바로, 결제 몫으로 닿은 지층은 7일 뒤에 기념품을 준다", () => {
    let state = addPatronFund(createEmptyPatronState(), "free", 30, NOW);
    expect(patronTierOf(state).id).toBe("sediment");
    expect(patronRewardStatus(state, "sediment", NOW)).toBe("ready");
    state = addPatronFund(state, "paid", 300, NOW);
    expect(patronTierOf(state).id).toBe("fossil");
    expect(patronRewardStatus(state, "fossil", NOW)).toBe("settling");
    expect(patronRewardStatus(state, "fossil", new Date(NOW.getTime() + PATRON_SETTLE_MS))).toBe("ready");
    expect(patronRewardStatus(state, "amber", NOW)).toBe("locked");
  });

  it("환불은 결제 몫만 깎고, 내려간 지층의 기념품은 다시 닿을 때까지 잠긴다", () => {
    const state = refundPatronFund(addPatronFund(createEmptyPatronState(), "paid", 1_000, NOW), 900);
    expect(state.paid).toBe(100);
    expect(patronTierOf(state).id).toBe("sediment");
    expect(patronRewardStatus(state, "amber", new Date(NOW.getTime() + PATRON_SETTLE_MS))).toBe("locked");
  });

  it("매일 보급은 UTC 하루에 한 번이고, 받을 것이 있으면 붉은 점이 선다", () => {
    const state = { ...createEmptyPatronState(), dailyDate: "2026-11-16" };
    expect(patronDailyAvailable(state, NOW)).toBe(false);
    expect(patronDailyAvailable(state, new Date("2026-11-17T00:00:00Z"))).toBe(true);
    expect(patronHasClaimable(state, NOW)).toBe(false);
    expect(patronHasClaimable(createEmptyPatronState(), NOW)).toBe(true);
  });

  it("저장 정규화는 깨진 값을 걷고, 검증과 맞물린다", () => {
    const broken = normalizePatronState({ free: -3, paid: 2.5, dailyDate: "어제", claimed: ["topsoil", "fossil", "fossil", "nope"], reachedAt: { fossil: "x", amber: NOW.toISOString() } });
    expect(broken).toEqual({ free: 0, paid: 0, claimed: ["fossil"], reachedAt: { amber: NOW.toISOString() } });
    expect(isValidPatronState(broken)).toBe(true);
    expect(isValidPatronState({ free: 1, paid: 0, claimed: ["topsoil"] })).toBe(false);
  });

  it("지층이 여는 테두리·수식어는 실제 목록에 있고 선물 테두리로 잡힌다", () => {
    for (const id of PATRON_FRAME_IDS) {
      expect(PROFILE_FRAMES.find((frame) => frame.id === id)?.unlockGift).toBe("patronStrata");
      expect(GIFT_FRAME_IDS.has(id)).toBe(true);
    }
    for (const tier of PATRON_TIERS) if (tier.modifierId) expect(PROFILE_MODIFIERS.find(({ id }) => id === tier.modifierId)?.acquisitionConditionId).toBe(`patron:${tier.id}`);
  });
});

function server(now = NOW) {
  const state = createDefaultSession(); state.itemInventory = [];
  let clock = now;
  const api = new FakeServer(state, { latencyMs: 0, now: () => clock, persistSession: () => undefined });
  return { state, api, advance: (ms: number) => { clock = new Date(clock.getTime() + ms); } };
}

describe("후원 지층 — 서버 경계", () => {
  it("매일 보급은 하루 한 번 지금 지층의 보급을 주고 무료 기금 1을 쌓는다", async () => {
    const { state, api, advance } = server();
    const gold = state.wallet.gold;
    expect((await api.getNotificationSignals()).patronClaimable).toBe(true);
    const first = await api.claimPatronDaily({ requestId: "d-1" });
    expect(state.wallet.gold).toBe(gold + 5_000);
    expect(first.patron).toMatchObject({ fund: 1, freeFund: 1, dailyAvailable: false });
    // 같은 요청은 영수증, 새 요청은 거절.
    await api.claimPatronDaily({ requestId: "d-1" });
    expect(state.wallet.gold).toBe(gold + 5_000);
    await expect(api.claimPatronDaily({ requestId: "d-2" })).rejects.toBeTruthy();
    expect((await api.getNotificationSignals()).patronClaimable).toBe(false);
    advance(86_400_000);
    await api.claimPatronDaily({ requestId: "d-3" });
    expect((await api.getPatronStatus()).fund).toBe(2);
  });

  it("결제는 값만큼 결제 기금을 쌓고, 정산이 끝난 기념품은 한 번만 받는다", async () => {
    const { state, api, advance } = server();
    const product = (await api.getProducts("premium")).products.find(({ id }) => id === "premium-gems-large")!;
    const price = product.acquisition.kind === "platform_payment" ? product.acquisition.basePriceKrw : 0;
    const verified = await api.verifyPurchaseReceipt({ productId: product.id, platform: "test", receipt: `verified-receipt:${product.id}:tx`, requestId: "v-1" });
    await api.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: "f-1" });
    const status = await api.getPatronStatus();
    expect(status.paidFund).toBe(fundForPriceKrw(price));
    const reached = status.rewards.filter(({ status: s }) => s !== "locked");
    expect(reached.length).toBeGreaterThan(0);
    for (const reward of reached) expect(reward.status).toBe("settling");
    await expect(api.claimPatronTierReward({ requestId: "r-0", tierId: reached[0].tierId })).rejects.toBeTruthy();
    advance(PATRON_SETTLE_MS);
    const gems = state.wallet.gems;
    const claimed = await api.claimPatronTierReward({ requestId: "r-1", tierId: "sediment" });
    expect(state.wallet.gems).toBe(gems + 100);
    expect(claimed.patron.rewards.find(({ tierId }) => tierId === "sediment")?.status).toBe("claimed");
    await expect(api.claimPatronTierReward({ requestId: "r-2", tierId: "sediment" })).rejects.toBeTruthy();
  });

  it("화석층 기념품은 테두리를, 호박층 기념품은 수식어를 연다", async () => {
    const { state, api } = server();
    state.achievements = { ...(state.achievements ?? {}), patron: addPatronFund(createEmptyPatronState(), "free", 1_000, NOW) } as typeof state.achievements;
    const fossil = await api.claimPatronTierReward({ requestId: "r-f", tierId: "fossil" });
    expect(fossil.frameId).toBe("patron-fossil");
    expect(state.achievements?.giftFrames).toContain("patron-fossil");
    const amber = await api.claimPatronTierReward({ requestId: "r-a", tierId: "amber" });
    expect(amber.modifierId).toBe("amber-bound");
  });
});
