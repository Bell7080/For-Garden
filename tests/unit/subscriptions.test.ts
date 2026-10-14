import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession, type Session } from "../../src/state/session";
import { SaveManager } from "../../src/state/SaveManager";
import { PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import { productsForPremiumCategory, premiumGrantTiles } from "../../src/ui/premiumModel";
import type { ProductDto } from "../../src/api/contracts";

function harness() {
  let raw: string | null = null; let fail = false;
  const saves = new SaveManager({ getItem: () => raw, setItem: (_key, value) => { if (fail) throw new Error("quota"); raw = value; }, removeItem: () => { raw = null; } });
  let now = new Date("2026-10-14T12:00:00Z");
  const state = createDefaultSession(); state.itemInventory = [];
  const api = (target: Session = state) => new FakeServer(target, { latencyMs: 0, now: () => now, persistSession: (next) => saves.save(next) });
  return { state, api, reload: () => saves.load()!, clock: (date: string) => { now = new Date(date); }, fail: (value: boolean) => { fail = value; } };
}
async function buy(server: FakeServer, id: string, tx = id) {
  const verified = await server.verifyPurchaseReceipt({ productId: id, platform: "test", receipt: `verified-receipt:${id}:${tx}`, requestId: `verify-${tx}` });
  return server.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: `fulfill-${tx}` });
}
const product = (id: string) => PREMIUM_PRODUCTS.find((entry) => entry.id === id)!;

describe("구독 상품과 일일 우편", () => {
  it("광고 제거는 9,900원·3,500젬이며 순수 젬 구독은 9,900원·매일 3배 젬을 준다", () => {
    expect(product("premium-adfree").acquisition).toMatchObject({ basePriceKrw: 9_900 });
    expect(product("premium-adfree").grants).toContainEqual({ kind: "currency", currency: "gems", amount: 3_500 });
    expect(product("premium-monthly").acquisition).toMatchObject({ basePriceKrw: 9_900 });
    expect(product("premium-monthly").grants).toEqual([{ kind: "currency", currency: "gems", amount: 3_000 }]);
    expect(product("premium-monthly").grants.every((grant) => grant.kind === "currency" && grant.currency === "gems")).toBe(true);
    expect(product("premium-monthly").passBenefit).toEqual({ durationDays: 30, autoRenew: true, dailyBonus: { currency: "gems", amount: 300 } });
    expect(product("premium-monthly").acquisition).toEqual(product("premium-story-pass").acquisition.kind === "platform_payment" ? { ...product("premium-story-pass").acquisition, platformProductId: "premium-monthly" } : {});
    const packGems = product("premium-gems-large").grants.find((grant) => grant.kind === "currency" && grant.currency === "gems")!;
    expect(packGems).toMatchObject({ amount: 3_500 });

  });
  it("패스 상품에는 즉시 구성품과 일일 티켓만 표시하고 진행 보상 합계는 숨긴다", () => {
    for (const id of ["premium-story-pass", "premium-level-pass", "premium-raid-pass", "premium-archaeology-pass"]) {
      const tiles = premiumGrantTiles(product(id));
      expect(tiles.some((tile) => tile.badge === "pass")).toBe(false);
      expect(tiles.filter((tile) => tile.badge === "instant")).toHaveLength(3);
      expect(tiles.length).toBeLessThanOrEqual(4);
    }
  });
  it("두 패스는 같은 ID로 양쪽 탭에 있고 구독 맨 위·맨 아래 순서가 일정하다", () => {
    const dtos = PREMIUM_PRODUCTS as unknown as ProductDto[];
    for (const tab of ["pass", "subscription"] as const) {
      const ids = productsForPremiumCategory(dtos, tab).map((entry) => entry.id);
      expect(ids).toContain("premium-raid-pass"); expect(ids).toContain("premium-archaeology-pass"); expect(new Set(ids).size).toBe(ids.length);
    }
    const list = productsForPremiumCategory(dtos, "subscription");
    expect(list[0].id).toBe("premium-adfree"); expect(list.at(-1)?.id).toBe("premium-monthly");
    expect(premiumGrantTiles(product("premium-archaeology-pass"))).toContainEqual({ icon: "item-strata-ticket", amount: 1, daily: true });
  });
  it.each([["premium-raid-pass", "raid-select-ticket"], ["premium-archaeology-pass", "strata-ticket"]])("%s의 접속 우편은 재접속·다른 탭 수령에서도 하루 한 번만 지급된다", async (id, ticket) => {
    const h = harness(); const api = h.api(); await buy(api, id);
    const mail = (await api.getMails()).mails.filter((entry) => entry.id.startsWith("subscription:"));
    expect(mail).toHaveLength(1); expect(mail[0].rewards).toEqual([{ kind: "item", itemId: ticket, amount: 1 }]);
    const reloaded = h.reload(); const recovered = h.api(reloaded);
    expect((await recovered.getMails()).mails.filter((entry) => entry.id.startsWith("subscription:"))).toHaveLength(1);
    await recovered.claimMailRewards({ mailIds: [mail[0].id], requestId: "mail" });
    const count = reloaded.itemInventory.find((entry) => entry.itemId === ticket)!.quantity;
    await expect(recovered.claimPassDailyBonus({ productId: id, requestId: "from-other-tab" })).rejects.toMatchObject({ code: "PASS_BONUS_CLAIMED" });
    expect(reloaded.itemInventory.find((entry) => entry.itemId === ticket)!.quantity).toBe(count);
    h.clock("2026-10-15T00:00:00Z");
    await recovered.claimPassDailyBonus({ productId: id, requestId: "tomorrow" });
    expect(reloaded.itemInventory.find((entry) => entry.itemId === ticket)!.quantity).toBe(count + 1);
    h.clock("2026-11-14T12:00:00Z");
    expect((await recovered.getMails()).mails.some((entry) => entry.id.endsWith("2026-11-14"))).toBe(false);
  });
  it("자동 갱신 상품만 검증된 갱신 거래로 기간을 연장하고 같은 날 일일 젬은 중복하지 않는다", async () => {
    const h = harness(); const api = h.api();
    const first = await buy(api, "premium-monthly", "first");
    await api.claimPassDailyBonus({ productId: "premium-monthly", requestId: "today" });
    const renewed = await buy(api, "premium-monthly", "renewed");
    expect(Date.parse(renewed.entitlement!.expiresAt!) - Date.parse(first.entitlement!.expiresAt!)).toBe(30 * 86_400_000);
    await expect(api.claimPassDailyBonus({ productId: "premium-monthly", requestId: "today-renewed" })).rejects.toMatchObject({ code: "PASS_BONUS_CLAIMED" });
    expect(Object.values(h.state.serverJournal!.subscriptionEntitlements!).filter((entry) => entry.active)).toHaveLength(1);
  });
  it.each(["premium-raid-pass", "premium-archaeology-pass"])("%s는 자동 갱신이 없고 30일 경계부터 일일 지급을 중단한다", async (id) => {
    const h = harness(); const api = h.api(); const bought = await buy(api, id);
    expect(product(id).passBenefit?.autoRenew).toBeUndefined();
    await expect(buy(api, id, "not-a-renewal")).rejects.toMatchObject({ code: "PURCHASE_LIMIT_REACHED" });
    h.clock(bought.entitlement!.expiresAt!);
    await expect(api.claimPassDailyBonus({ productId: id, requestId: "expired" })).rejects.toMatchObject({ code: "PASS_NOT_FOUND" });
    expect((await api.getMails()).mails.some((entry) => entry.id.startsWith("subscription:"))).toBe(false);
    expect((await buy(api, id, "new-season")).entitlement!.active).toBe(true);
  });
  it("지난 접속의 미수령 우편도 7일 안에 재접속하면 남아 있다", async () => {
    const h = harness(); const api = h.api(); await buy(api, "premium-archaeology-pass");
    await api.getMails(); h.clock("2026-10-16T12:00:00Z");
    const recovered = h.api(h.reload());
    expect((await recovered.getMails()).mails.filter((entry) => entry.id.startsWith("subscription:")).map((entry) => entry.id.split(":").at(-1))).toEqual(["2026-10-16", "2026-10-14"]);
  });
  it("광고 제거 권리와 일일 젬 수령은 재실행 후 복원되고 결제 재전송은 추가 지급하지 않는다", async () => {
    const h = harness(); const api = h.api(); const bought = await buy(api, "premium-adfree", "transaction");
    expect(bought.adFreeMembership).toBe(true);
    await api.claimPassDailyBonus({ productId: "premium-adfree", requestId: "daily" });
    const state = h.reload(); const recovered = h.api(state); const gems = state.wallet.gems;
    expect((await recovered.getPlayerState()).adFreeMembership).toBe(true);
    await expect(recovered.claimPassDailyBonus({ productId: "premium-adfree", requestId: "daily-again" })).rejects.toMatchObject({ code: "PASS_BONUS_CLAIMED" });
    await buy(recovered, "premium-adfree", "transaction"); expect(state.wallet.gems).toBe(gems);
    h.clock("2026-11-14T12:00:00Z"); expect((await recovered.getPlayerState()).adFreeMembership).toBe(false);
  });
  it("월간 젬 구독으로 광고 혜택을 요청하면 거절한다", async () => {
    const h = harness(); const api = h.api(); const bought = await buy(api, "premium-monthly");
    await expect(api.claimInstantAdReward({ entitlementId: bought.entitlement!.entitlementId, slotId: "daily-stamina", requestId: "ad" })).rejects.toMatchObject({ code: "PASS_NOT_FOUND" });
  });
  it("결제 저장 실패는 재화와 구독 권리를 바꾸지 않으며 같은 영수증으로 재시도할 수 있다", async () => {
    const h = harness(); const api = h.api(); const before = structuredClone(h.state);
    h.fail(true); await expect(buy(api, "premium-adfree")).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(h.state).toEqual(before); h.fail(false); expect((await buy(api, "premium-adfree")).adFreeMembership).toBe(true);
  });
});
