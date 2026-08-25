import { describe, expect, it, vi } from "vitest";
import { ExpeditionManager, expeditionWeekKey } from "../../src/managers/ExpeditionManager";
import { createDefaultSession } from "../../src/state/session";

/** 원정 매니저 테스트는 브라우저 저장소 대신 호출 횟수만 기록하는 경계를 주입한다. */
describe("ExpeditionManager", () => {
  it("uses UTC Monday as the weekly key", () => {
    expect(expeditionWeekKey(new Date("2026-08-30T23:59:59Z"))).toBe("2026-08-24");
    expect(expeditionWeekKey(new Date("2026-08-31T00:00:00Z"))).toBe("2026-08-31");
  });

  it("requires exactly three distinct owned relics before persisting", () => {
    const state = createDefaultSession();
    const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));

    // 첫 상태 조회의 주차 정규화 저장은 시작 검증 저장과 구분해 제거한다.
    manager.status();
    save.mockClear();
    expect(manager.start(["anky", "rex"])).toEqual({ ok: false, reason: "exactlyThree" });
    expect(manager.start(["anky", "rex", "rex"])).toEqual({ ok: false, reason: "duplicate" });
    expect(manager.start(["anky", "rex", "unknown"])).toEqual({ ok: false, reason: "notOwned" });
    expect(save).not.toHaveBeenCalled();

    const result = manager.start(["anky", "rex", "spino"]);
    expect(result.ok).toBe(true);
    expect(state.expedition.active?.relicIds).toEqual(["anky", "rex", "spino"]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("preserves an active expedition across weekly rollover and blocks replacement", () => {
    const state = createDefaultSession();
    state.expedition = { weekKey: "2026-08-17", playsThisWeek: 4, bestScore: 9200, active: { relicIds: ["anky", "rex", "spino"], startedAt: "2026-08-23T12:00:00Z", score: 300 } };
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));

    const status = manager.status();
    expect(status.playsThisWeek).toBe(0);
    expect(status.bestScore).toBe(0);
    expect(status.active?.score).toBe(300);
    expect(manager.start(["anky", "rex", "spino"])).toEqual({ ok: false, reason: "alreadyActive" });
  });

  it("exposes quick expedition only after a weekly score and without active progress", () => {
    const state = createDefaultSession();
    state.expedition = { weekKey: "2026-08-24", playsThisWeek: 1, bestScore: 1200, active: null };
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));
    expect(manager.status().quickAvailable).toBe(true);
  });
});
