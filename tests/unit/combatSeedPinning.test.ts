import { describe, expect, it } from "vitest";
import { combatJournal, consumeCombat, finishCombat, prepareCombat } from "../../src/server/combatAuthority";
import { createDefaultSession } from "../../src/state/session";

const HOUR = 3_600_000;

function entered() {
  const state = createDefaultSession();
  combatJournal(state).tickets["stage:1-1"] = { kind: "stage", target: "1-1", requestId: "enter-1" };
  return state;
}
const request = { input: { mode: "stage" as const }, stageId: "1-1" };

describe("전투 시드는 입장에 묶인다", () => {
  it("임대가 만료된 뒤 다시 발급받아도 같은 판의 시드는 그대로다", () => {
    const state = entered(), now = new Date("2026-10-06T12:00:00Z");
    const first = prepareCombat(state, request as never, now, "lease-1");
    const later = prepareCombat(state, request as never, new Date(now.getTime() + HOUR + 1), "lease-2");
    expect(later.id).toBe("lease-2");
    expect(later.seed).toBe(first.seed);
  });

  it("그 입장이 끝나면 다음 입장은 새 시드를 받는다", () => {
    const state = entered(), now = new Date("2026-10-06T12:00:00Z");
    const first = prepareCombat(state, request as never, now, "lease-1");
    consumeCombat(state, "stage:1-1");
    combatJournal(state).tickets["stage:1-1"] = { kind: "stage", target: "1-1", requestId: "enter-2" };
    expect(prepareCombat(state, request as never, now, "lease-2").seed).not.toBe(first.seed);
  });

  it("이미 난 판정은 임대가 만료된 뒤에도 그대로 돌려준다", () => {
    const state = entered(), now = new Date("2026-10-06T12:00:00Z");
    const lease = prepareCombat(state, request as never, now, "lease-1");
    const verdict = { victory: false, relicHp: [0, 0, 0], elapsedMs: 20_000 };
    combatJournal(state).records[lease.id].verdict = verdict;
    expect(finishCombat(state, { id: lease.id, actions: [], ticks: 10 }, new Date(now.getTime() + HOUR + 1))).toEqual(verdict);
  });
});
