import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameCallError, StateConflictError, handleGameCall, type StateStore, type StoredState } from "../../src/server/gameHandler";
import { SERVER_GAME_METHODS } from "../../src/server/gameMethods";

function memoryStore() {
  const saves = new Map<string, StoredState>();
  const receipts = new Map<string, unknown>();
  let commits = 0;
  const store: StateStore = {
    async load(id) { return saves.get(id) ?? null; },
    async findReceipt(id, req) { return receipts.get(`${id}:${req}`); },
    async commit(i) {
      const cur = saves.get(i.playerId);
      if ((cur?.revision ?? null) !== i.expectedRevision) throw new StateConflictError();
      const revision = String(Number(cur?.revision ?? 0) + 1);
      saves.set(i.playerId, { revision, data: i.data });
      commits += 1;
      if (i.requestId) receipts.set(`${i.playerId}:${i.requestId}`, { ...(i.response as object), revision });
      return { revision };
    },
  };
  return { store, saves, commits: () => commits };
}
const P = "00000000-0000-0000-0000-000000000001";
const fixed = { now: () => new Date("2026-10-16T00:00:00Z"), random: () => 0.5 };

describe("서버 호출 처리기", () => {
  it("메서드 목록이 GameApi 인터페이스와 같다", () => {
    const src = readFileSync("src/api/contracts.ts", "utf8");
    const body = src.slice(src.indexOf("export interface GameApi"));
    const names = [...body.slice(0, body.indexOf("\n}\n")).matchAll(/^  ([a-zA-Z]+)\(/gm)].map((m) => m[1]);
    names.push("getAsyncArenaServerState");
    expect([...SERVER_GAME_METHODS].sort()).toEqual([...new Set(names)].sort());
    for (const name of SERVER_GAME_METHODS) expect(typeof (FakeServer.prototype as unknown as Record<string, unknown>)[name]).toBe("function");
  });

  it("처음 호출하면 기본 상태를 만들어 저장한다", async () => {
    const m = memoryStore();
    const out = await handleGameCall(P, { method: "getInventory" }, { store: m.store, ...fixed });
    expect(out.revision).toBe("1");
    expect(m.saves.get(P)?.revision).toBe("1");
  });

  it("규칙이 거절하면 상태를 바꾸지 않고 사유를 돌려준다", async () => {
    const m = memoryStore();
    await handleGameCall(P, { method: "getInventory" }, { store: m.store, ...fixed });
    const before = JSON.stringify(m.saves.get(P));
    const err = await handleGameCall(P, { method: "rechargeStamina", args: [{ method: "gems", requestId: "req-aaaaaaaa" }] }, { store: m.store, ...fixed }).catch((e) => e);
    expect(err).toBeInstanceOf(GameCallError);
    expect(JSON.stringify(m.saves.get(P))).toBe(before);
  });

  it("목록에 없는 메서드와 잘못된 요청 키를 거절한다", () => {
    const m = memoryStore();
    expect(() => handleGameCall(P, { method: "constructor" }, { store: m.store })).toThrow(GameCallError);
    expect(() => handleGameCall(P, { method: "getInventory", requestId: "x" }, { store: m.store })).toThrow(GameCallError);
  });

  it("같은 requestId 재전송은 저장된 응답을 그대로 돌려준다", async () => {
    const m = memoryStore();
    const req = { method: "markAttendanceAutoShown", requestId: "call-0001" };
    const first = await handleGameCall(P, req, { store: m.store, ...fixed });
    const again = await handleGameCall(P, req, { store: m.store, ...fixed });
    expect(again.state).toEqual(first.state);
    expect(again.revision).toBe(first.revision);
    expect(m.commits()).toBe(1);
  });

  it("프로필·편성 변경은 서버 상태에 남고 같은 요청 재전송은 한 번만 반영한다", async () => {
    const m = memoryStore();
    const opts = { store: m.store, ...fixed };
    const call = (method: string, args: unknown[], requestId: string) => handleGameCall(P, { method, args, requestId }, opts);
    const party = await call("setParty", [{ relicIds: ["torika", "rex", "dodo"] }], "call-party-01");
    expect((party.result as { ok: boolean }).ok).toBe(true);
    // 보유하지 않은 개체를 편성에 넣는 요청은 사유만 돌려주고 상태를 건드리지 않는다.
    const rejected = await call("setParty", [{ relicIds: ["torika", "rex", "pontos"] }], "call-party-02");
    expect(rejected.result).toMatchObject({ ok: false, reason: "not-owned", relicId: "pontos" });
    const mark = await call("setRelicBookmark", [{ relicId: "rex", bookmarked: true }], "call-mark-01");
    const again = await call("setRelicBookmark", [{ relicId: "rex", bookmarked: true }], "call-mark-01");
    expect(again.revision).toBe(mark.revision);
    const card = await call("updatePlayerCard", [{ kind: "identity" }], "call-card-01");
    expect(card.result).toMatchObject({ ok: true, card: { createdAt: "2026-10-16T00:00:00.000Z" } });
    const saved = m.saves.get(P)?.data as { party: string[]; bookmarkedRelicIds: string[]; playerCard: { uid: string } };
    expect(saved.party).toEqual(["torika", "rex", "dodo"]);
    expect(saved.bookmarkedRelicIds).toEqual(["rex"]);
    expect(saved.playerCard.uid).toMatch(/^[1-9]\d{8}$/);
  });

  it("이야기 선택·완료와 고고학 선택은 서버 상태에 남고 재전송은 한 번만 반영한다", async () => {
    const m = memoryStore();
    const opts = { store: m.store, ...fixed };
    const call = (method: string, args: unknown[], requestId: string) => handleGameCall(P, { method, args, requestId }, opts);
    const effect = await call("applyStoryEffect", [{ storyId: "opening-train", effect: { type: "bondXp", relicId: "torika", amount: 5 } }], "call-story-01");
    expect((effect.result as { xpGained: number }).xpGained).toBe(5);
    const again = await call("applyStoryEffect", [{ storyId: "opening-train", effect: { type: "bondXp", relicId: "torika", amount: 5 } }], "call-story-01");
    expect(again.revision).toBe(effect.revision);
    const done = await call("completeStory", [{ storyId: "opening-train" }], "call-story-02");
    expect((done.result as { firstCompletion: boolean }).firstCompletion).toBe(true);
    // 완료한 이야기의 선택은 재관람이라 보상이 없다.
    const replay = await call("applyStoryEffect", [{ storyId: "opening-train", effect: { type: "bondXp", relicId: "torika", amount: 5 } }], "call-story-03");
    expect((replay.result as { xpGained: number }).xpGained).toBe(0);
    await call("selectArchaeologySite", [{ siteId: "sunken-archive" }], "call-site-01");
    const saved = m.saves.get(P)?.data as { completedStoryIds: string[]; archaeology: { lastSelectedSiteId?: string } };
    expect(saved.completedStoryIds).toEqual(["opening-train"]);
    expect(saved.archaeology.lastSelectedSiteId).toBe("sunken-archive");
  });

  it("원정 출발과 증강·휴식·보스 준비는 서버가 런을 소유하고 재전송은 한 번만 반영한다", async () => {
    const m = memoryStore();
    const opts = { store: m.store, ...fixed };
    const call = (method: string, args: unknown[], requestId: string) => handleGameCall(P, { method, args, requestId }, opts);
    const bad = await call("startExpeditionRun", [{ relicIds: ["torika", "torika", "rex"] }], "call-exp-00");
    expect(bad.result).toMatchObject({ ok: false, reason: "duplicate" });
    const start = await call("startExpeditionRun", [{ relicIds: ["torika", "rex", "dodo"] }], "call-exp-01");
    expect(start.result).toMatchObject({ ok: true });
    const again = await call("startExpeditionRun", [{ relicIds: ["torika", "rex", "dodo"] }], "call-exp-01");
    expect(again.revision).toBe(start.revision);
    const second = await call("startExpeditionRun", [{ relicIds: ["torika", "rex", "dodo"] }], "call-exp-02");
    expect(second.result).toMatchObject({ ok: false, reason: "alreadyActive" });
    const saved = () => m.saves.get(P)?.data as { expedition: { run: { nodes: { id: string; type: string; floor: number }[]; relics: { snapshot?: unknown }[]; pendingAugmentReward: unknown; bossSubmissionId: string | null } } };
    const run = saved().expedition.run;
    // 떠나는 순간 성장 스냅샷이 서버 상태에 굳는다.
    expect(run.relics.every(({ snapshot }) => snapshot !== undefined)).toBe(true);
    // 노드 종류는 클라이언트가 아니라 서버의 지도에서 읽는다 — 모르는 노드와 보스 아닌 노드는 열리지 않는다.
    expect((await call("beginExpeditionAugment", [{ nodeId: "missing" }], "call-exp-03")).result).toEqual({ pending: null });
    const battle = run.nodes.find(({ type }) => type === "normal" || type === "elite")!;
    const pending = (await call("beginExpeditionAugment", [{ nodeId: battle.id }], "call-exp-04")).result as { pending: { offers: { augmentId: string }[] } | null };
    expect(pending.pending?.offers.length ?? 0).toBeGreaterThan(0);
    expect(saved().expedition.run.pendingAugmentReward).not.toBeNull();
    expect((await call("chooseExpeditionAugment", [{ selection: { augmentId: "not-offered" } }], "call-exp-05")).result).toEqual({ ok: false });
    expect((await call("prepareExpeditionBoss", [{ nodeId: battle.id }], "call-exp-06")).result).toEqual({ ids: null });
    const boss = run.nodes.find(({ type }) => type === "boss")!;
    const ids = (await call("prepareExpeditionBoss", [{ nodeId: boss.id }], "call-exp-07")).result as { ids: { requestId: string } | null };
    expect(ids.ids?.requestId).toBe(saved().expedition.run.bossSubmissionId);
  });

  it("동시 충돌은 다시 읽고 재시도한다", async () => {
    const m = memoryStore();
    await handleGameCall(P, { method: "getInventory" }, { store: m.store, ...fixed });
    let once = true;
    const flaky: StateStore = { ...m.store, async commit(i) {
      if (once) { once = false; throw new StateConflictError(); }
      return m.store.commit(i);
    } };
    const out = await handleGameCall(P, { method: "markAttendanceAutoShown" }, { store: flaky, ...fixed });
    expect(out.ok).toBe(true);
  });
});

describe("서버 함수 묶음", () => {
  it("package.json이 type=module이라 api/game.js는 ESM이어야 한다", () => {
    const text = readFileSync("api/game.js", "utf8");
    expect(text).toMatch(/\nexport \{[^}]*as default[^}]*\}|\nexport default /);
    expect(text).not.toMatch(/\nmodule\.exports\s*=/);
  });
});
