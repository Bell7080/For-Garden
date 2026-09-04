import { describe, expect, it, vi } from "vitest";
import { ExpeditionManager, expeditionWeekKey } from "../../src/managers/ExpeditionManager";
import { createDefaultSession } from "../../src/state/session";
import { validateExpeditionMap } from "../../src/core/expeditionMap";

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
    expect(state.expedition.run?.relics.map(({ relicId }) => relicId)).toEqual(["anky", "rex", "spino"]);
    expect(state.expedition.lastParty).toEqual(["anky", "rex", "spino"]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("preserves an active expedition across weekly rollover and blocks replacement", () => {
    const state = createDefaultSession();
    const setup = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-23T12:00:00Z"));
    setup.start(["anky", "rex", "spino"]);
    state.expedition = { ...state.expedition, weekKey: "2026-08-17", playsThisWeek: 4, bestScore: 9200 };
    if (state.expedition.run) state.expedition.run.bestScore = 300;
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));

    const status = manager.status();
    expect(status.playsThisWeek).toBe(0);
    expect(status.bestScore).toBe(0);
    expect(status.run?.bestScore).toBe(300);
    expect(manager.start(["anky", "rex", "spino"])).toEqual({ ok: false, reason: "alreadyActive" });
  });

  it("exposes quick expedition only after a weekly score and without active progress", () => {
    const state = createDefaultSession();
    state.expedition = { weekKey: "2026-08-24", playsThisWeek: 1, bestScore: 1200, allTimeBestScore: 1200, lastParty: [], run: null };
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));
    expect(manager.status().quickAvailable).toBe(true);
  });

  it("기존 settled 런을 비활성으로 정리해 재진입에서 새 편성을 허용한다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    state.expedition.run!.settled = true;
    state.expedition.run!.settlementId = "legacy-settlement";
    save.mockClear();

    const status = manager.status();
    expect(status.active).toBeNull();
    expect(status.run).toBeNull();
    expect(state.expedition.run).toBeNull();
    expect(save).toHaveBeenCalledTimes(1);
    expect(manager.start(["anky", "rex", "spino"]).ok).toBe(true);
  });

  it("이번 주 원정 기회를 2회 모두 쓰면 새 원정을 시작할 수 없다", () => {
    const state = createDefaultSession();
    const manager = new ExpeditionManager(state, { save: vi.fn() }, () => new Date("2026-08-25T12:00:00Z"));
    expect(manager.status().canStartRun).toBe(true);

    state.expedition.playsThisWeek = 1;
    expect(manager.status().canStartRun).toBe(true);
    expect(manager.start(["anky", "rex", "spino"]).ok).toBe(true);

    // 활성 런을 비워 다음 시도가 alreadyActive가 아니라 주간 한도로 막히는지 본다.
    state.expedition.run = null;
    state.expedition.playsThisWeek = 2;
    expect(manager.status().canStartRun).toBe(false);
    expect(manager.start(["anky", "rex", "spino"])).toEqual({ ok: false, reason: "weeklyLimitReached" });
  });

  it("heals and completes a rest node in one save so retry cannot heal twice", () => {
    const state = createDefaultSession();
    const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const node = state.expedition.run!.nodes.find(({ type }) => type === "rest")!;
    state.expedition.run!.relics[0].currentHp = 20;
    save.mockClear();

    expect(manager.completeRestNode(node.id)).toBe(true);
    const healed = state.expedition.run!.relics[0].currentHp;
    expect(state.expedition.run!.visitedNodeIds).toContain(node.id);
    expect(save).toHaveBeenCalledTimes(1);
    expect(manager.completeRestNode(node.id)).toBe(false);
    expect(state.expedition.run!.relics[0].currentHp).toBe(healed);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("전투 결과의 생존자만 전체 회복 증강 합계만큼 회복하고 100에서 제한한다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const node = state.expedition.run!.nodes.find(({ type }) => type === "normal")!;
    // SR 전체 회복과 SSR 전체 회복을 중복 선택한 저장 스냅샷을 구성한다.
    state.expedition.run!.selectedAugments = [
      { augmentId: "field-repair" }, { augmentId: "field-repair" }, { augmentId: "regrowth-protocol" },
      { augmentId: "predator-instinct", targetRelicId: "anky" },
    ];
    save.mockClear();

    expect(manager.completeBattle(node.id, [
      { relicId: "anky", currentHp: 90, alive: true },
      { relicId: "rex", currentHp: 40, alive: true },
      { relicId: "spino", currentHp: 0, alive: false },
    ])).toBe(true);
    expect(state.expedition.run!.relics).toEqual([
      { relicId: "anky", currentHp: 100, alive: true },
      { relicId: "rex", currentHp: 72, alive: true },
      { relicId: "spino", currentHp: 0, alive: false },
    ]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("중복 회복은 50% 상한이며 같은 전투 결과 재전송은 회복과 저장을 반복하지 않는다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const node = state.expedition.run!.nodes.find(({ type }) => type === "boss")!;
    // 16% 네 장은 64%지만 순수 누적 규칙의 전투당 상한 50%가 적용된다.
    state.expedition.run!.selectedAugments = Array.from({ length: 4 }, () => ({ augmentId: "regrowth-protocol" }));
    const results = [
      { relicId: "anky", currentHp: 10, alive: true },
      { relicId: "rex", currentHp: 0, alive: false },
      { relicId: "spino", currentHp: 25, alive: true },
    ] as const;
    save.mockClear();

    // 보스 시간 종료처럼 생존자가 남은 결과도 완료 DTO이면 회복 정책을 따른다.
    expect(manager.completeBattle(node.id, results)).toBe(true);
    expect(state.expedition.run!.relics.map(({ currentHp }) => currentHp)).toEqual([60, 0, 75]);
    expect(manager.completeBattle(node.id, results)).toBe(false);
    expect(state.expedition.run!.relics.map(({ currentHp }) => currentHp)).toEqual([60, 0, 75]);
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("전멸 결과에는 회복 증강이 발동해도 사망자를 자동 부활시키지 않는다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const node = state.expedition.run!.nodes.find(({ type }) => type === "elite")!;
    state.expedition.run!.selectedAugments = [{ augmentId: "regrowth-protocol" }];

    expect(manager.completeBattle(node.id, ["anky", "rex", "spino"].map((relicId) => ({ relicId, currentHp: 0, alive: false })))).toBe(true);
    expect(state.expedition.run!.relics.every(({ currentHp, alive }) => currentHp === 0 && !alive)).toBe(true);
  });

  it("보스 제출과 정산 ID를 전투 진입 전에 한 번만 저장한다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"));
    manager.start(["anky", "rex", "spino"]);
    const boss = state.expedition.run!.nodes.find(({ type }) => type === "boss")!;
    const first = manager.prepareBossRequests(boss.id); const repeated = manager.prepareBossRequests(boss.id);
    expect(repeated).toEqual(first);
    expect(state.expedition.run).toMatchObject({ bossSubmissionId: first?.requestId, bossSettlementId: first?.settlementId });
  });

  it("개발 바로가기가 유효한 지도와 선택한 3기 편성을 보스 직전까지 한 번에 보존한다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"), true);
    const result = manager.prepareDevelopmentBossShortcut(["spino", "anky", "rex"]);
    expect(result.ok).toBe(true);
    const run = state.expedition.run!;
    expect(validateExpeditionMap({ seed: run.mapSeed, nodes: run.nodes })).toEqual([]);
    expect(run.relics.map(({ relicId }) => relicId)).toEqual(["spino", "anky", "rex"]);
    expect(run.nodes.find(({ id }) => id === run.currentNodeId)).toMatchObject({ floor: 19 });
    expect(run.nodes.find(({ type }) => type === "boss")?.predecessorIds).toContain(run.currentNodeId);
    expect(save).toHaveBeenCalledTimes(2); // 주차 정규화와 완성된 바로가기 스냅샷만 각각 저장한다.
  });

  it("production 경계에서는 개발 바로가기를 상태 변경 없이 거부한다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"), false);
    expect(manager.prepareDevelopmentBossShortcut(["anky", "rex", "spino"])).toEqual({ ok: false, reason: "developmentOnly" });
    expect(state.expedition.run).toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it("개발 바로가기에서 선점한 보스 요청 ID를 재진입해도 중복 생성하지 않는다", () => {
    const state = createDefaultSession(); const save = vi.fn();
    const manager = new ExpeditionManager(state, { save }, () => new Date("2026-08-25T12:00:00Z"), true);
    const shortcut = manager.prepareDevelopmentBossShortcut(["anky", "rex", "spino"]);
    expect(shortcut.ok).toBe(true);
    const boss = state.expedition.run!.nodes.find(({ type }) => type === "boss")!;
    const before = { requestId: state.expedition.run!.bossSubmissionId, settlementId: state.expedition.run!.bossSettlementId };
    expect(manager.prepareBossRequests(boss.id)).toEqual(before);
    expect(manager.prepareBossRequests(boss.id)).toEqual(before);
    expect(new Set([state.expedition.run!.bossSubmissionId]).size).toBe(1);
  });
});
