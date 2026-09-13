import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { createDefaultSession } from "../../src/state/session";
import { INTERACTION_EXCHANGE_RENDER_MODEL } from "../../src/ui/interactionExchangeModel";
import { INTERACTION_CITIES } from "../../src/data/interactionCities";

/** 교류 교환의 원자성·서버 권한·멱등성과 팝업 외곽 보존을 한 계약으로 고정한다. */
describe("interaction exchange", () => {
  const unlocked = () => { const state = createDefaultSession(); state.playerResearch.level = 3; state.itemInventory.push({ itemId: "sr-psychic-sample", quantity: 8 }); return state; };
  it("표본을 차감하고 보상과 제한을 한 영수증으로 반환하며 중복 요청은 한 번만 지급한다", async () => { const state = unlocked(); const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-09-04T00:00:00Z") }); const request = { offerId: "night-sr-psychic-sample-cheesecake", quantity: 2, requestId: "same-request" }; const first = await server.exchangeInteractionOffer(request); const duplicate = await server.exchangeInteractionOffer(request); expect(duplicate).toEqual(first); expect(state.itemInventory.find((item) => item.itemId === "sr-psychic-sample")?.quantity).toBe(6); expect(state.wallet.cheesecake).toBe(200); expect(first.remaining).toBe(3); });
  it("부족 수량, 잠긴 도시, 제한 초과를 상태 변경 없이 거절한다", async () => {
    // 해금은 **클리어한 관문**이 연다. 교환소가 붙은 나이트 시티는 처음부터 열려 있으므로,
    // 잠긴 도시의 거절은 선행 관문이 걸린 도시로 확인한다 — 서버가 같은 규칙 하나를 읽는다.
    const gated = INTERACTION_CITIES.find((city) => city.unlock.stageId !== undefined)!;
    const locked = unlocked(); locked.cleared = new Set();
    await expect(new FakeServer(locked, { latencyMs: 0 }).startInteractionDispatch({ cityId: gated.id, party: ["anky"] })).rejects.toThrow("개방되지 않은"); const state = unlocked(); const server = new FakeServer(state, { latencyMs: 0 }); await expect(server.exchangeInteractionOffer({ offerId: "night-sr-psychic-sample-cheesecake", quantity: 9, requestId: "limit" })).rejects.toThrow("횟수"); state.itemInventory.find((item) => item.itemId === "sr-psychic-sample")!.quantity = 1; const before = state.wallet.cheesecake; await expect(server.exchangeInteractionOffer({ offerId: "night-sr-psychic-sample-cheesecake", quantity: 2, requestId: "short" })).rejects.toThrow("수량"); expect(state.wallet.cheesecake).toBe(before); });
  it("동적 행 갱신이 팝업 외곽을 파괴하지 않는다", () => { expect(INTERACTION_EXCHANGE_RENDER_MODEL).toEqual({ destroysPopupChrome: false, refreshesContentContainerOnly: true }); });
  it("동시에 연타해도 같은 멱등 요청은 한 번만 반영한다", async () => { const state = unlocked(); const server = new FakeServer(state, { latencyMs: 1 }); const request = { offerId: "night-sr-psychic-sample-cheesecake", quantity: 1, requestId: "rapid" }; await Promise.all([server.exchangeInteractionOffer(request), server.exchangeInteractionOffer(request)]); expect(state.wallet.cheesecake).toBe(100); });
});
