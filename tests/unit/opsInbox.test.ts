import { describe, expect, it } from "vitest";
import { applyOpsAdjustments, drainOpsNotices, isValidOpsJournal, opsJournalOf, opsMailToDto } from "../../src/core/opsInbox";
import { handleGameCall, StateConflictError, type StateStore, type StoredState } from "../../src/server/gameHandler";
import type { OpsInbox } from "../../src/core/opsInbox";
import { createDefaultSession } from "../../src/state/session";
import { opsNoticeLines, opsNoticeReceipt } from "../../src/ui/opsNoticeText";

const now = new Date("2026-10-18T00:00:00Z");
const adj = (id: string, asset: string, delta: number) => ({ id, asset, delta, createdAt: now.toISOString() });

describe("운영 재화 조정", () => {
  it("지갑에 더하고 같은 ID는 두 번 더하지 않는다", () => {
    const s = createDefaultSession();
    const before = s.wallet.gems;
    const first = applyOpsAdjustments(s, [adj("a1", "gems", 3000)], now);
    expect(s.wallet.gems).toBe(before + 3000);
    expect(first[0]).toMatchObject({ id: "a1", applied: 3000 });
    applyOpsAdjustments(s, [adj("a1", "gems", 3000)], now);
    expect(s.wallet.gems).toBe(before + 3000);
  });

  it("0 아래로는 깎아서 적용하고 알 수 없는 재화는 건드리지 않는다", () => {
    const s = createDefaultSession();
    s.wallet.gold = 100;
    const out = applyOpsAdjustments(s, [adj("a2", "gold", -500), adj("a3", "nope", 5)], now);
    expect(s.wallet.gold).toBe(0);
    expect(out[0].applied).toBe(-100);
    expect(out[1].applied).toBe(0);
  });

  it("안내는 한 번만 내려가고 비운다", () => {
    const s = createDefaultSession();
    applyOpsAdjustments(s, [adj("a4", "gems", 10)], now);
    expect(drainOpsNotices(s)).toHaveLength(1);
    expect(drainOpsNotices(s)).toHaveLength(0);
    expect(isValidOpsJournal(opsJournalOf(s))).toBe(true);
  });

  it("안내 문장은 같은 재화를 합친다", () => {
    const lines = opsNoticeLines([{ kind: "asset", asset: "gems", delta: 100, at: "" }, { kind: "asset", asset: "gems", delta: -40, at: "" }, { kind: "mail", title: "x", at: "" }]);
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("60");
  });
});

describe("운영 우편 변환", () => {
  it("지갑 키가 아닌 첨부는 버린다", () => {
    const dto = opsMailToDto({ id: "u1", title: "t", body: "b", rewards: [{ asset: "gems", amount: 5 }, { asset: "x", amount: 1 }], sentAt: now.toISOString(), expiresAt: null }, "운영팀", new Set());
    expect(dto.id).toBe("ops:u1");
    expect(dto.rewards).toHaveLength(1);
  });
});

describe("서버 호출과 운영 연동", () => {
  const P = "00000000-0000-0000-0000-000000000009";
  it("접속 중 호출에서 재화·우편이 반영되고 확인 응답이 한 번 나간다", async () => {
    const saves = new Map<string, StoredState>();
    const acks: unknown[] = [];
    let pending: OpsInbox = { mails: [{ id: "11111111-1111-1111-1111-111111111111", title: "점검 보상", body: "b", rewards: [{ asset: "gems", amount: 50 }], sentAt: now.toISOString(), expiresAt: null }], adjustments: [adj("22222222-2222-2222-2222-222222222222", "gems", 700)] };
    const store: StateStore = {
      async load(id) { return saves.get(id) ?? null; },
      async findReceipt() { return undefined; },
      async commit(i) {
        const cur = saves.get(i.playerId);
        if ((cur?.revision ?? null) !== i.expectedRevision) throw new StateConflictError();
        const revision = String(Number(cur?.revision ?? 0) + 1);
        saves.set(i.playerId, { revision, data: i.data });
        return { revision };
      },
      async opsInbox() { return pending; },
      async opsAck(_p: string, applied: unknown, claimed: unknown) { acks.push({ applied, claimed }); pending = { mails: pending.mails, adjustments: [] }; },
    } as StateStore;
    const deps = { store, now: () => now, random: () => 0.5 };
    await handleGameCall(P, { method: "getInventory" }, deps);
    const first = await handleGameCall(P, { method: "getNotificationSignals" }, deps);
    const notices = (first.result as { opsNotices?: unknown[] }).opsNotices ?? [];
    expect(notices.length).toBeGreaterThan(0);
    expect(acks).toHaveLength(1);
    const mails = await handleGameCall(P, { method: "getMails" }, deps);
    expect(JSON.stringify(mails.result)).toContain("ops:11111111");
    const second = await handleGameCall(P, { method: "getNotificationSignals" }, deps);
    expect((second.result as { opsNotices?: unknown[] }).opsNotices ?? []).toHaveLength(0);
  });
});

describe("운영 아이템 조정·안내 영수증", () => {
  it("아이템을 가방에 넣고 빼며 사유를 영수증에 싣는다", () => {
    const s = createDefaultSession();
    const before = s.itemInventory.find((e) => e.itemId === "sweep-ticket")?.quantity ?? 0;
    const out = applyOpsAdjustments(s, [{ ...adj("i1", "item:sweep-ticket", 5), note: "보상" }, adj("i2", "item:nope", 1)], now);
    expect(out[0].applied).toBe(5);
    expect(out[1].applied).toBe(0);
    expect(s.itemInventory.find((e) => e.itemId === "sweep-ticket")?.quantity).toBe(before + 5);
    const back = applyOpsAdjustments(s, [adj("i3", "item:sweep-ticket", -999)], now);
    expect(back[0].applied).toBe(-(before + 5));
    const receipt = opsNoticeReceipt([{ kind: "asset", asset: "gems", delta: 10, note: "테스트", at: "" }, { kind: "item", itemId: "sweep-ticket", delta: 2, note: "테스트", at: "" }]);
    expect(receipt.items).toHaveLength(2);
    expect(receipt.reason).toContain("테스트");
  });

  it("우편의 아이템 첨부는 아이템 보상으로 옮긴다", () => {
    const dto = opsMailToDto({ id: "u2", title: "t", body: "b", rewards: [{ asset: "item:sweep-ticket", amount: 3 }, { asset: "item:nope", amount: 1 }], sentAt: now.toISOString(), expiresAt: null }, "운영팀", new Set());
    expect(dto.rewards).toEqual([{ kind: "item", itemId: "sweep-ticket", amount: 3 }]);
  });
});
