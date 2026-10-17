import { describe, expect, it } from "vitest";
import { resolveJournalDiscovery } from "../../src/core/interactionJournals";
import { journalsForCity } from "../../src/data/interactionJournals";
import { FakeServer } from "../../src/api/FakeServer";
import { InteractionManager } from "../../src/managers/InteractionManager";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";

/** 신규·중복·읽음과 JSON 왕복을 한 manager/순수 규칙 계약으로 고정한다. */
describe("interaction journals", () => {
  it("최초 표본은 그대로 발견하고 중복은 다음 미발견 표본으로 바꾼 뒤 소진한다", () => {
    const ids = ["interaction-doppel-01", "interaction-doppel-02"];
    expect(resolveJournalDiscovery(ids[0], ids, new Set())).toEqual({ kind: "new", journalId: ids[0] });
    expect(resolveJournalDiscovery(ids[0], ids, new Set([ids[0]]))).toEqual({ kind: "replacement", journalId: ids[1] });
    expect(resolveJournalDiscovery(ids[0], ids, new Set(ids))).toEqual({ kind: "exhausted", journalId: null });
  });

  it("읽음은 서버가 확정하고 미발견 표본의 읽음을 거부한다", async () => {
    const state = createDefaultSession();
    const server = new FakeServer(state, { latencyMs: 0, persistSession: () => undefined });
    const manager = new InteractionManager(server, state);
    state.discoveredInteractionJournalIds.add("interaction-doppel-01");
    expect(await manager.markJournalRead("interaction-doppel-01")).toBe(true);
    expect(await manager.markJournalRead("interaction-doppel-01")).toBe(false);
    await expect(manager.markJournalRead("interaction-doppel-lab-01")).rejects.toThrow();
  });

  it("저장 후 Set을 복원한다", () => {
    const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
    const manager = new SaveManager(storage); const state = createDefaultSession();
    state.discoveredInteractionJournalIds.add("interaction-doppel-lab-01"); state.readInteractionJournalIds.add("interaction-doppel-lab-01"); manager.save(state);
    expect(manager.load()?.discoveredInteractionJournalIds).toEqual(new Set(["interaction-doppel-lab-01"]));
    expect(manager.load()?.readInteractionJournalIds).toEqual(new Set(["interaction-doppel-lab-01"]));
  });

  it("v30 저장은 일지 목록을 빈 배열로 마이그레이션한다", () => {
    const source = createDefaultSession(); const memory = new Map<string, string>();
    const storage = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => { memory.set(key, value); }, removeItem: (key: string) => { memory.delete(key); } };
    const manager = new SaveManager(storage); manager.save(source);
    const legacy = JSON.parse([...memory.values()][0]) as Record<string, unknown>; legacy.saveVersion = 30; delete legacy.discoveredInteractionJournalIds; delete legacy.readInteractionJournalIds;
    expect(manager.migrate(legacy)).toMatchObject({ discoveredInteractionJournalIds: [], readInteractionJournalIds: [] });
  });

  it("도시별 발견 순서로 정렬한다", () => { expect(journalsForCity("doppel-parlor").map(({ discoveryOrder }) => discoveryOrder)).toEqual([1, 2]); });
});
