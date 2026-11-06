import { describe, expect, it } from "vitest";
import { applyOpsAdjustments, applyOpsProfileActions, containsBannedWord, drainOpsNotices, isValidOpsJournal, noticeOpsBanners, opsBannerText, opsJournalOf, opsMailToDto, opsPatchNoteToDto, type OpsNotice } from "../../src/core/opsInbox";
import { FakeServer } from "../../src/api/FakeServer";
import { handleGameCall, StateConflictError, type StateStore, type StoredState } from "../../src/server/gameHandler";
import type { OpsInbox } from "../../src/core/opsInbox";
import { createDefaultSession } from "../../src/state/session";
import { mailTabOf } from "../../src/ui/mailPopupLayout";
import { opsNoticeLines, opsNoticeMessages, opsNoticeReceipt } from "../../src/ui/opsNoticeText";

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

describe("어드민 패치노트 우편", () => {
  it("첨부 없는 패치노트 탭의 안내로 바뀌고 항목 표기를 붙인다", () => {
    const dto = opsPatchNoteToDto({ id: "p1", version: "1.0.1", title: "", releasedAt: "2026-10-27T00:00:00Z", items: [{ kind: "fix", text: "우편 삭제 수정" }, { kind: "zzz", text: "기타" }], note: "감사합니다" }, { sender: "운영팀", title: "v1.0.1", kinds: { fix: "[수정]", etc: "[기타]" } }, new Set());
    expect(dto.id).toBe("ops:patch:p1");
    expect(dto.rewards).toEqual([]);
    expect(dto.body).toBe("[수정] 우편 삭제 수정\n[기타] 기타\n\n감사합니다");
    expect(mailTabOf(dto)).toBe("patch");
  });
});

describe("운영 제재·공지 배너", () => {
  it("닉네임 강제 초기화는 저장을 비우고 한 번 알리며 이미 빈 이름이면 알리지 않는다", () => {
    const s = createDefaultSession();
    s.playerCard = { ...s.playerCard, nickname: "나쁜이름", bio: "소개" };
    const done = applyOpsProfileActions(s, [{ id: "p1", kind: "nickname_reset", reason: "부적절한 닉네임", createdAt: now.toISOString() }], now);
    expect(done).toEqual(["p1"]);
    expect(s.playerCard.nickname).toBe("");
    expect(s.playerCard.bio).toBe("소개");
    expect(applyOpsProfileActions(s, [{ id: "p2", kind: "nickname_reset", createdAt: now.toISOString() }], now)).toEqual(["p2"]);
    const notices = drainOpsNotices(s);
    expect(notices).toEqual([{ kind: "profile", field: "nickname", note: "부적절한 닉네임", at: now.toISOString() }]);
    expect(isValidOpsJournal(opsJournalOf(s))).toBe(true);
    expect(opsNoticeMessages(notices)).toHaveLength(1);
  });

  it("공지 배너는 기간 안에서 한 번만 띄우고 지금 언어의 번역을 고른다", () => {
    const s = createDefaultSession();
    const banner = { id: "b1", title: "점검 안내", body: "오늘 점검", translations: { en: { title: "Maintenance", body: "" } }, startsAt: "2026-10-17T00:00:00Z", endsAt: "2026-10-19T00:00:00Z" };
    const ended = { ...banner, id: "b2", endsAt: "2026-10-17T12:00:00Z" };
    noticeOpsBanners(s, [banner, ended], now);
    noticeOpsBanners(s, [banner], now);
    const notices = drainOpsNotices(s);
    expect(notices).toHaveLength(1);
    expect(isValidOpsJournal({ ...opsJournalOf(s), notices })).toBe(true);
    const notice = notices[0] as Extract<OpsNotice, { kind: "banner" }>;
    expect(opsBannerText(notice, "en")).toEqual({ title: "Maintenance", body: "오늘 점검" });
    expect(opsBannerText(notice, "ja")).toEqual({ title: "점검 안내", body: "오늘 점검" });
  });

  it("금칙어는 공백·대소문자를 무시한 부분 일치로 거른다", () => {
    expect(containsBannedWord("Bad Word12", ["badword"])).toBe(true);
    expect(containsBannedWord("착한이름", ["badword", " "])).toBe(false);
  });

  it("닉네임 변경은 서버가 주입한 금칙어를 거절한다", async () => {
    const s = createDefaultSession();
    const server = new FakeServer(s, { latencyMs: 0, bannedWords: ["운영자"], persistSession: () => undefined, now: () => now });
    expect(await server.updatePlayerCard({ kind: "nickname", value: "가짜운영자" })).toEqual({ ok: false, reason: "banned" });
    expect((await server.updatePlayerCard({ kind: "nickname", value: "연구원" })).ok).toBe(true);
  });
});
