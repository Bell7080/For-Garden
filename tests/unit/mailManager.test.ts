import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { MailManager } from "../../src/managers/MailManager";
import { createDefaultSession } from "../../src/state/session";
import { ManagerEvents } from "../../src/managers/ManagerEvents";

/** 고정 서버 시각으로 만료와 기본 결정론적 우편을 매 테스트 똑같이 재현한다. */
function setup() { const state = createDefaultSession(); const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-30T00:00:00.000Z") }); return { state, server, manager: new MailManager(server, state) }; }

describe("MailManager", () => {
  it("만료 우편은 일괄 수령 대상과 지급 결과에서 제외한다", async () => { const { manager, state } = setup(); const list = await manager.list(); expect(manager.claimableIds(list)).not.toContain("expired-supply"); const fossil = state.wallet.fossil; const result = await manager.claim(["expired-supply"], "expired"); expect(result.claimedMailIds).toEqual([]); expect(state.wallet.fossil).toBe(fossil); });

  it("보상 없는 안내 우편은 읽음만 바꾸고 수령 대상에는 넣지 않는다", async () => { const { manager } = setup(); const before = await manager.list(); expect(manager.claimableIds(before)).not.toContain("field-notice"); const after = await manager.read("field-notice"); expect(after.mails.find(({ id }) => id === "field-notice")?.read).toBe(true); expect(after.mails.find(({ id }) => id === "field-notice")?.claimed).toBe(false); });

  it("이미 수령한 우편은 다시 지급하지 않는다", async () => { const { manager, state } = setup(); const gems = state.wallet.gems; const result = await manager.claim(["archive-gift"], "claimed"); expect(result.claimedMailIds).toEqual([]); expect(state.wallet.gems).toBe(gems); });

  it("일괄 수령 요청을 같은 멱등 키로 반복해도 지갑은 한 번만 증가한다", async () => { const { manager, state } = setup(); const list = await manager.list(); const gold = state.wallet.gold; const first = await manager.claim(manager.claimableIds(list), "all-idempotent"); const repeated = await manager.claim(manager.claimableIds(list), "all-idempotent"); expect(first.claimedMailIds).toEqual(["welcome-supply"]); expect(repeated).toEqual(first); expect(state.wallet.gold).toBe(gold + 1200); });

  it("한 수령 확정 응답으로 TopBar·가방·우편 알림 구독을 함께 한 번 갱신한다", async () => {
    const state = createDefaultSession(); const server = new FakeServer(state, { latencyMs: 0, now: () => new Date("2026-08-30T00:00:00.000Z") });
    const events = new ManagerEvents(); const manager = new MailManager(server, state, events);
    // UI 대역은 API 응답을 받지 않고 각 manager 이벤트의 공개 읽기 모델만 기록한다.
    const walletValues: number[] = []; const inventoryRevisions: number[] = []; const mailDots: boolean[] = []; const claimableCounts: number[] = [];
    const unsubscribes = [
      events.subscribe("wallet", ({ wallet }) => walletValues.push(wallet.gold)),
      events.subscribe("inventory", ({ revision }) => inventoryRevisions.push(revision)),
      events.subscribe("notification", ({ state: notification }) => mailDots.push(notification.mail)),
      events.subscribe("mail", ({ list }) => claimableCounts.push(list.claimableCount)),
    ];
    await manager.claim(["welcome-supply"], "one-confirmed-response");
    expect(walletValues).toEqual([state.wallet.gold]); expect(inventoryRevisions).toEqual([1]);
    // 보상 우편은 사라져도 아직 읽지 않은 안내 우편이 있으므로 점은 확정 응답대로 유지된다.
    expect(mailDots).toEqual([true]); expect(claimableCounts).toEqual([0]);
    // 팝업/씬 종료 대역이 해제한 뒤에는 재발행되어도 중복 refresh가 생기지 않는다.
    unsubscribes.forEach((unsubscribe) => unsubscribe()); events.publishInventory();
    expect(inventoryRevisions).toEqual([1]);
  });
});
