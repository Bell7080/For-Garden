import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { combatJournal, prepareCombat } from "../../src/server/combatAuthority";
import type { PlayerDuelContext } from "../../src/server/playerDuels";
import { createDefaultSession, type Session } from "../../src/state/session";
import { saveManager } from "../../src/state/SaveManager";
import { DUEL_FORFEIT_AFTER_MS } from "../../src/core/duelState";

let clock = new Date("2026-10-06T12:00:00Z");
const NOW = () => clock;

/** 실제 이용자 결투 맥락 — 기본 저장의 상대 여섯. */
function context(): PlayerDuelContext {
  const data = saveManager.exportData(createDefaultSession()) as unknown as Record<string, unknown>;
  const records = Array.from({ length: 6 }, (_, index) => ({ id: `00000000-0000-4000-8000-00000000000${index}`, revision: "1", data: structuredClone(data) }));
  return { playerId: "me", records, rank: 1, ranking: [], changes: [] };
}
function server(state: Session, duelContext = context()): FakeServer {
  return new FakeServer(state, { latencyMs: 0, now: NOW, random: () => 0.5, duelContext });
}
const team = (state: Session) => [...state.owned].slice(0, 3);

describe("끝내지 않고 버린 결투", () => {
  it("결과를 확정하지 않고 다음 판에 들어가면 앞 판은 패배로 정산된다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const state = createDefaultSession();
    const api = server(state);
    const before = await api.getDuelStatus();
    await api.enterDuel({ requestId: "duel-a", opponentId: before.opponents[0].id, relicIds: team(state) });
    expect(state.duel!.losses).toBe(0);
    // 서버는 호출마다 저장에서 다시 선다 — 버린 판의 입장권만 장부에 남아 있다.
    const again = server(state);
    await again.enterDuel({ requestId: "duel-b", opponentId: before.opponents[1].id, relicIds: team(state) });
    expect(state.duel!.losses).toBe(1);
    expect(state.duel!.winStreak).toBe(0);
    expect(state.duel!.history[0]).toMatchObject({ won: false });
    expect(Object.keys(combatJournal(state).tickets)).toEqual(["duel:duel-b"]);
  });

  it("기한이 지난 판은 다른 결투 조작에서도 패배로 정산되고, 기한 안의 판은 그대로 둔다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const state = createDefaultSession();
    const before = await server(state).getDuelStatus();
    await server(state).enterDuel({ requestId: "duel-a", opponentId: before.opponents[0].id, relicIds: team(state) });
    await server(state).setDuelDefense({ relicIds: team(state), blindChoice: [] });
    expect(state.duel!.losses).toBe(0);
    clock = new Date(clock.getTime() + DUEL_FORFEIT_AFTER_MS);
    await server(state).setDuelDefense({ relicIds: team(state), blindChoice: [] });
    expect(state.duel!.losses).toBe(1);
    expect(combatJournal(state).tickets).toEqual({});
  });

  it("서버가 이미 판정한 판은 버려도 그 판정대로 정산된다", async () => {
    clock = new Date("2026-10-06T12:00:00Z");
    const state = createDefaultSession();
    const before = await server(state).getDuelStatus();
    await server(state).enterDuel({ requestId: "duel-a", opponentId: before.opponents[0].id, relicIds: team(state) });
    const lease = prepareCombat(state, { automaticUltimates: true, input: { mode: "duel", requestId: "duel-a" } } as never, clock, "lease-a");
    combatJournal(state).records[lease.id].verdict = { victory: true, relicHp: [1, 1, 1], elapsedMs: 30_000 };
    await server(state).enterDuel({ requestId: "duel-b", opponentId: before.opponents[1].id, relicIds: team(state) });
    expect(state.duel).toMatchObject({ wins: 1, losses: 0, winStreak: 1 });
  });
});
