import { describe, expect, it, vi } from "vitest";

// 일반 빌드처럼 QA 결제 우회를 끈다 — 결제 검증이 없으면 특가 버튼이 꺼진다.
vi.mock("../../src/core/buildFlavor", async (importOriginal) => ({ ...(await importOriginal<typeof import("../../src/core/buildFlavor")>()), QA_TOOLS_ENABLED: false }));

const { FakeServer } = await import("../../src/api/FakeServer");
const { createDefaultSession } = await import("../../src/state/session");

const NOW = new Date("2026-11-09T12:00:00Z");

describe("「한정」 탭 붉은 점 — 살 수 있는 특가만 센다", () => {
  it("결제 검증이 없어 살 수 없는 특가는 목록에 서도 점을 켜지 않는다 (SSR을 뽑아도 남던 점)", async () => {
    const state = createDefaultSession();
    state.itemInventory = [];
    // 천장 열 번 앞 → 확정 직전 특가가 선다.
    state.gachaPityByGroup = Object.fromEntries(Object.entries(state.gachaPityByGroup).map(([id, pity]) => [id, { ...pity, pullsSinceSsr: 115 }]));
    const api = new FakeServer(state, { latencyMs: 0, now: () => NOW, persistSession: () => undefined });
    const offer = (await api.getProducts("premium")).products.find(({ id }) => id === "offer-pity");
    expect(offer).toMatchObject({ purchasable: false });
    expect((await api.getNotificationSignals()).situationalOfferCount).toBe(0);
    // SSR을 뽑아 천장이 돌아가도 특가는 남은 기간 동안 서 있고, 점은 여전히 꺼져 있다.
    state.gachaPityByGroup = Object.fromEntries(Object.entries(state.gachaPityByGroup).map(([id, pity]) => [id, { ...pity, pullsSinceSsr: 0 }]));
    expect((await api.getProducts("premium")).products.some(({ id }) => id === "offer-pity")).toBe(true);
    expect((await api.getNotificationSignals()).situationalOfferCount).toBe(0);
  });

  it("결제 검증이 붙으면 같은 특가가 점을 켠다", async () => {
    const state = createDefaultSession();
    state.playerResearch = { ...state.playerResearch, level: 23 };
    const api = new FakeServer(state, { latencyMs: 0, now: () => NOW, persistSession: () => undefined, verifyPurchaseReceipt: async () => ({ ok: false }) } as never);
    expect((await api.getProducts("premium")).products.find(({ id }) => id === "offer-level-20")).toMatchObject({ purchasable: true });
    expect((await api.getNotificationSignals()).situationalOfferCount).toBe(1);
  });
});
