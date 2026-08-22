import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { EVENTS } from "../../src/data/events";
import { PRODUCTS } from "../../src/data/products";
import { getRecollectionStory } from "../../src/data/dialogues/recollections";
import { createDefaultSession } from "../../src/state/session";

describe("이벤트 정적 정의", () => {
  it("기존 스토리·StageDef·상품 카탈로그를 ID로 일관되게 묶는다", () => {
    const event = EVENTS[0];
    // 회상 레지스트리와 이벤트 완료 ID가 같은 DialogueStory 객체를 가리킨다.
    expect(getRecollectionStory(event.recollectionStoryId)).toBe(event.story);
    expect(event.missions.map(({ objective }) => objective.targetId)).toEqual(expect.arrayContaining([event.story.id, event.stages[0].id]));
    expect(event.exchangeProductIds.every((id) => PRODUCTS.some((product) => product.id === id))).toBe(true);
  });
});

describe("이벤트 서버 시간 경계", () => {
  it("API 서버 시각으로 상태를 알리고 활성 기간에만 전투 입장을 허가한다", async () => {
    const event = EVENTS[0];
    const active = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => new Date("2026-08-22T12:00:00Z") });
    await expect(active.getEvents()).resolves.toMatchObject({ serverTime: "2026-08-22T12:00:00.000Z", events: [{ id: event.id, status: "active" }] });
    await expect(active.enterEventStage(event.id, event.stages[0].id)).resolves.toMatchObject({ eventId: event.id, stage: { id: event.stages[0].id } });

    const ended = new FakeServer(createDefaultSession(), { latencyMs: 0, now: () => new Date(event.endsAt) });
    await expect(ended.enterEventStage(event.id, event.stages[0].id)).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
  });

  it("종료 시각부터 전투 결과 확정과 이벤트 상품 구매를 모두 거부한다", async () => {
    const event = EVENTS[0];
    const state = createDefaultSession();
    state.wallet.weeds = 100;
    const server = new FakeServer(state, { latencyMs: 0, now: () => new Date(event.endsAt) });

    await expect(server.completeStage(event.stages[0].id)).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
    await expect(server.purchaseProduct(event.exchangeProductIds[0])).rejects.toMatchObject({ code: "EVENT_NOT_ACTIVE" });
    // 거부된 요청은 재화·클리어·구매 기록 어느 것도 변경하지 않는다.
    expect(state.wallet.weeds).toBe(100);
    expect(state.cleared.has(event.stages[0].id)).toBe(false);
    expect(state.productPurchases).toEqual({});
  });
});

