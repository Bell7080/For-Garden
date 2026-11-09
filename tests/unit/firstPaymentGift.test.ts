import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession, createInitialRelicProgress } from "../../src/state/session";
import { STANDARD_POOLS } from "../../src/data/banners";
import { FIRST_PAYMENT_GIFT } from "../../src/data/firstPaymentGift";
import { findProfileFrame, isProfileFrameUnlocked, PROFILE_FRAMES } from "../../src/data/profileFrames";
import { GIFT_FRAME_IDS, normalizeAchievementState } from "../../src/core/achievementState";

function server() {
  const state = createDefaultSession(); state.itemInventory = [];
  const api = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-11-09T12:00:00Z"), persistSession: () => undefined });
  return { state, api };
}
async function buy(api: FakeServer, id: string, tx: string) {
  const verified = await api.verifyPurchaseReceipt({ productId: id, platform: "test", receipt: `verified-receipt:${id}:${tx}`, requestId: `verify-${tx}` });
  return api.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: `fulfill-${tx}` });
}

describe("계정 첫 결제 선물", () => {
  it("첫 플랫폼 결제에 선택권·화석 5·한정 테두리를 함께 주고, 두 번째 결제에는 주지 않는다", async () => {
    const { state, api } = server();
    const before = state.wallet.fossil;
    const first = await buy(api, "premium-starter", "tx-1");
    expect(first.firstPaymentGift).toBe(true);
    expect(state.itemInventory.find(({ itemId }) => itemId === "sr-select-ticket")?.quantity).toBe(1);
    expect(state.wallet.fossil).toBe(before + 5);
    expect(state.achievements?.firstPaymentGift).toBe(true);
    expect(state.achievements?.giftFrames).toEqual([FIRST_PAYMENT_GIFT.frameId]);
    expect((await api.getProducts("premium")).firstPaymentGift?.available).toBe(false);
    const second = await buy(api, "premium-gems-large", "tx-2");
    expect(second.firstPaymentGift).toBeUndefined();
    expect(state.itemInventory.find(({ itemId }) => itemId === "sr-select-ticket")?.quantity).toBe(1);
  });

  it("상점 목록은 받기 전까지 선물을 말한다", async () => {
    const { api } = server();
    const list = await api.getProducts("premium");
    expect(list.firstPaymentGift).toMatchObject({ available: true, frameId: "patron" });
    expect((await api.getProducts("shop")).firstPaymentGift).toBeUndefined();
  });

  it("선물 테두리는 받은 계정에서만 열리고 레벨로는 열리지 않는다", () => {
    const patron = findProfileFrame("patron")!;
    expect(isProfileFrameUnlocked(patron, 60, {})).toBe(false);
    expect(isProfileFrameUnlocked(patron, 1, {}, ["patron"])).toBe(true);
    expect(new Set(PROFILE_FRAMES.filter((frame) => frame.unlockGift).map(({ id }) => id))).toEqual(GIFT_FRAME_IDS);
    expect(normalizeAchievementState({ claimed: {}, goldPeak: 0, giftFrames: ["patron", "bogus"], firstPaymentGift: true })).toMatchObject({ giftFrames: ["patron"], firstPaymentGift: true });
  });
});

describe("SR 렐릭 선택권", () => {
  const ticket = (state: ReturnType<typeof server>["state"]) => { state.itemInventory = [{ itemId: "sr-select-ticket", quantity: 1 }]; };
  it("처음 만난 SR 렐릭을 데려오고 장을 쓴다", async () => {
    const { state, api } = server(); ticket(state);
    const relicId = STANDARD_POOLS.SR.find((id) => !state.owned.has(id))!;
    const result = await api.useConsumable({ itemId: "sr-select-ticket", quantity: 1, relicId });
    expect(result.newRelicIds).toEqual([relicId]);
    expect(state.owned.has(relicId)).toBe(true);
    expect(state.itemInventory.find(({ itemId }) => itemId === "sr-select-ticket")).toBeUndefined();
  });
  it("이미 있는 렐릭은 파편 한 장이고, 공명까지 끝낸 렐릭·풀 밖 렐릭·렐릭 없음은 장을 쓰기 전에 거절한다", async () => {
    const { state, api } = server(); ticket(state);
    const relicId = STANDARD_POOLS.SR[0];
    state.owned.add(relicId); state.relicProgress[relicId] = createInitialRelicProgress();
    const before = state.relicFragments[relicId] ?? 0;
    await expect(api.useConsumable({ itemId: "sr-select-ticket", quantity: 1 })).rejects.toMatchObject({ code: "RELIC_NOT_FOUND" });
    await expect(api.useConsumable({ itemId: "sr-select-ticket", quantity: 1, relicId: STANDARD_POOLS.SSR[0] })).rejects.toMatchObject({ code: "RELIC_NOT_FOUND" });
    state.relicProgress[relicId] = { ...createInitialRelicProgress(), breakthrough: 4, resonance: 5 };
    await expect(api.useConsumable({ itemId: "sr-select-ticket", quantity: 1, relicId })).rejects.toMatchObject({ code: "RELIC_MAX_BREAKTHROUGH" });
    expect(state.itemInventory[0].quantity).toBe(1);
    state.relicProgress[relicId] = createInitialRelicProgress();
    const result = await api.useConsumable({ itemId: "sr-select-ticket", quantity: 1, relicId });
    expect(result.fragmentRelicId).toBe(relicId);
    expect(state.relicFragments[relicId]).toBe(before + 1);
  });
});
