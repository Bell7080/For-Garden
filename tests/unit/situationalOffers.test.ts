import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { premiumValueMultiple } from "../../src/core/premiumValue";
import {
  SITUATIONAL_OFFER_RULES, createEmptySituationalOfferState, forgetSituationalOfferKey, isValidSituationalOfferState, issueSituationalOffer,
  normalizeSituationalOfferState, recordStoryResult, situationalWeekKey, storyStageChapter, type SituationalOfferCandidate,
} from "../../src/core/situationalOffers";
import { relicLevelCap } from "../../src/core/relicProgression";
import { PREMIUM_GEM_PER_KRW, PREMIUM_PRODUCTS } from "../../src/data/premiumProducts";
import type { ProductDto } from "../../src/api/contracts";
import { createDefaultSession } from "../../src/state/session";
import { SaveManager } from "../../src/state/SaveManager";

const NOW = new Date("2026-11-09T12:00:00Z");
const at = (hours: number) => new Date(NOW.getTime() + hours * 3_600_000);
const candidate = (trigger: SituationalOfferCandidate["trigger"], key: string, productId: string): SituationalOfferCandidate => ({ trigger, key, productId });

describe("상황 특가 규칙", () => {
  it("동시에 셋까지 · 하루 하나 · 같은 종류 7일 · 같은 키 한 번", () => {
    let state = issueSituationalOffer(createEmptySituationalOfferState(), candidate("pityNear", "pity:a", "offer-pity"), NOW).state;
    expect(state.active).toHaveLength(1);
    expect(state.active[0]!.expiresAt).toBe(at(SITUATIONAL_OFFER_RULES.durationHours).toISOString());
    // 같은 날 두 번째는 서지 않는다.
    expect(issueSituationalOffer(state, candidate("staminaOut", "stamina:w", "offer-stamina"), at(1)).issued).toBe(false);
    // 다음 날 다른 종류는 선다.
    state = issueSituationalOffer(state, candidate("staminaOut", "stamina:w", "offer-stamina"), at(24)).state;
    expect(state.active).toHaveLength(2);
    // 같은 종류는 7일 안에 다시 서지 않는다.
    expect(issueSituationalOffer(state, candidate("pityNear", "pity:b", "offer-pity"), at(48)).issued).toBe(false);
    state = issueSituationalOffer(state, candidate("playerLevel", "level:10", "offer-level-10"), at(48)).state;
    expect(state.active).toHaveLength(3);
    // 셋이 열려 있으면 넷째는 서지 않는다.
    expect(issueSituationalOffer(state, candidate("ancientBest", "ancient:2026-11", "offer-ancient"), at(60)).issued).toBe(false);
    // 72시간이 지나면 첫 특가가 걷힌다. 같은 키는 다시 내지 않는다.
    const later = issueSituationalOffer(state, candidate("ancientBest", "ancient:2026-11", "offer-ancient"), at(73));
    expect(later.issued).toBe(true);
    expect(later.state.active.map(({ productId }) => productId)).not.toContain("offer-pity");
    expect(issueSituationalOffer(later.state, candidate("pityNear", "pity:a", "offer-pity"), at(24 * 9)).issued).toBe(false);
    // 천장이 한 바퀴 돌면 키를 지워 다시 설 수 있다.
    expect(issueSituationalOffer(forgetSituationalOfferKey(later.state, "pity:a"), candidate("pityNear", "pity:a", "offer-pity"), at(24 * 9)).issued).toBe(true);
  });

  it("연패 줄은 같은 관문을 내리 진 수만 센다", () => {
    let state = createEmptySituationalOfferState();
    state = recordStoryResult(state, "1-5", false);
    state = recordStoryResult(state, "1-5", false);
    expect(state.storyLoss).toEqual({ stageId: "1-5", count: 2 });
    expect(recordStoryResult(state, "1-6", false).storyLoss).toEqual({ stageId: "1-6", count: 1 });
    expect(recordStoryResult(state, "1-5", true).storyLoss).toBeUndefined();
    expect(storyStageChapter("normal:2-3")).toBe(2);
    expect(storyStageChapter("ancient:4")).toBeUndefined();
    expect(situationalWeekKey(NOW)).toBe("2026-11-09");
  });

  it("저장값은 모양이 맞을 때만 받는다", () => {
    const state = issueSituationalOffer(createEmptySituationalOfferState(), candidate("pityNear", "pity:a", "offer-pity"), NOW).state;
    expect(isValidSituationalOfferState(undefined)).toBe(true);
    expect(isValidSituationalOfferState(state)).toBe(true);
    expect(isValidSituationalOfferState({ ...state, active: [{ productId: 1 }] })).toBe(false);
    expect(normalizeSituationalOfferState(null)).toEqual(createEmptySituationalOfferState());
  });
});

describe("상황 특가 상품", () => {
  const offers = PREMIUM_PRODUCTS.filter((product) => product.situational);

  it("열한 개가 한정 탭에 서고 모두 같은 값의 다이아 팩보다 2.5배 이상이다", () => {
    expect(offers).toHaveLength(11);
    for (const product of offers) {
      expect(product.premiumCategory).toBe("limited");
      expect(product.acquisition.kind).toBe("platform_payment");
      expect(premiumValueMultiple(product as unknown as ProductDto, PREMIUM_GEM_PER_KRW) ?? 0, product.id).toBeGreaterThanOrEqual(2.5);
      expect(product.grants.some((grant) => grant.kind === "currency" && grant.currency === "rawStone"), product.id).toBe(false);
    }
  });
});

describe("FakeServer 상황 특가", () => {
  function setup(now = () => NOW) {
    const state = createDefaultSession(); state.itemInventory = [];
    const api = new FakeServer(state, { latencyMs: 0, now, persistSession: () => undefined });
    return { state, api };
  }
  async function buy(api: FakeServer, id: string, tx: string) {
    const verified = await api.verifyPurchaseReceipt({ productId: id, platform: "test", receipt: `verified-receipt:${id}:${tx}`, requestId: `verify-${tx}` });
    return api.fulfillPlatformPurchase({ verificationId: verified.verificationId, requestId: `fulfill-${tx}` });
  }
  const offerIds = async (api: FakeServer) => (await api.getProducts("premium")).products.filter((product) => product.id.startsWith("offer-")).map(({ id }) => id);

  it("상황이 없으면 아무 특가도 서지 않고 붉은 점도 없다", async () => {
    const { api } = setup();
    expect(await offerIds(api)).toEqual([]);
    expect((await api.getNotificationSignals()).situationalOfferCount).toBe(0);
  });

  it("연구원 레벨이 닿은 가장 높은 마디 하나만 서고, 사면 걷힌다", async () => {
    const { state, api } = setup();
    state.playerResearch = { ...state.playerResearch, level: 23 };
    expect((await api.getNotificationSignals()).situationalOfferCount).toBe(1);
    const list = await api.getProducts("premium");
    const offer = list.products.find(({ id }) => id === "offer-level-20")!;
    expect(offer.purchasable).toBe(true);
    expect(offer.visibleUntil).toBe(at(72).toISOString());
    expect(list.products.some(({ id }) => id === "offer-level-10")).toBe(false);
    const gems = state.wallet.gems;
    await buy(api, "offer-level-20", "tx-level");
    expect(state.wallet.gems).toBeGreaterThan(gems);
    expect(await offerIds(api)).toEqual([]);
    await expect(buy(api, "offer-level-20", "tx-level-2")).rejects.toBeTruthy();
    expect(state.situationalOffers?.issuedKeys).toEqual(expect.arrayContaining(["level:10", "level:20"]));
  });

  it("천장 열 번 앞에서 확정 직전 특가가 서고 72시간 뒤 사라진다", async () => {
    let clock = NOW;
    const { state, api } = setup(() => clock);
    state.gachaPityByGroup = Object.fromEntries(Object.entries(state.gachaPityByGroup).map(([id, pity]) => [id, { ...pity, pullsSinceSsr: 115 }]));
    expect(await offerIds(api)).toEqual(["offer-pity"]);
    clock = at(73);
    expect(await offerIds(api)).toEqual([]);
  });

  it("레벨 상한에서 파편이 모자라면 그 등급의 돌파 특가가 선다", async () => {
    const { state, api } = setup();
    const id = [...state.owned][0]!;
    state.relicProgress[id] = { ...state.relicProgress[id]!, level: relicLevelCap(0), breakthrough: 0 };
    state.relicFragments[id] = 0;
    const ids = await offerIds(api);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toMatch(/^offer-breakthrough-(ssr|sr|r)$/);
  });

  it("같은 스토리 관문을 세 번 내리 지면 재정비 특가가 선다", async () => {
    const { api } = setup();
    for (let i = 0; i < SITUATIONAL_OFFER_RULES.lossStreak; i += 1) await api.completeStage("1-1", false);
    expect(await offerIds(api)).toEqual(["offer-stage-loss"]);
  });

  it("저장을 거쳐도 열린 특가가 그대로 남는다", async () => {
    const { state, api } = setup();
    state.playerResearch = { ...state.playerResearch, level: 10 };
    await api.getProducts("premium");
    const saves = new SaveManager(undefined);
    const parsed = saves.parse(JSON.parse(JSON.stringify(saves.exportData(state))));
    expect(parsed.situationalOffers?.active.map(({ productId }) => productId)).toEqual(["offer-level-10"]);
  });
});
