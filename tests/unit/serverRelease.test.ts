import { STARTING_STAMINA } from "../../src/core/playerLevel";
import { describe, it, expect } from "vitest";
import { createDefaultSession } from "../../src/state/session";
import {
  prepareCombat,
  finishCombat,
  combatJournal,
} from "../../src/server/combatAuthority";
import {
  authoritativeArgs,
  recordBoundaryResult,
} from "../../src/server/releaseBoundary";
import {
  stepSkirmish,
  fireUltimate,
  canFireUltimate,
} from "../../src/core/skirmish";
import { bossBattleRandom } from "../../src/core/bossSimulation";
import { combatState } from "../../src/core/combatProtocol";
import { emptyServerJournal } from "../../src/core/serverJournal";
import {
  validCall,
  isReadMethod,
  MAX_BODY_BYTES,
} from "../../src/server/requestPolicy";
import { saveManager } from "../../src/state/SaveManager";

const now = new Date("2026-10-18T00:00:00Z");
function admitted() {
  const state = createDefaultSession();
  state.serverJournal = emptyServerJournal();
  recordBoundaryResult(state, "enterStage", [
    { stageId: "1-1", requestId: "admission-1" },
  ]);
  return state;
}
function fight(lease: ReturnType<typeof prepareCombat>, auto = false) {
  const state = combatState(lease),
    rng = bossBattleRandom(lease.seed),
    actions: { tick: number; actorId: string }[] = [];
  let ticks = 0;
  while (state.phase === "fight" && ticks < 18000) {
    if (auto)
      for (const actor of state.fighters.filter((f) => f.side === "player")) {
        if (canFireUltimate(state, actor)) {
          actions.push({ tick: ticks, actorId: actor.id });
          fireUltimate(state, actor.id, rng);
        }
      }
    if (state.phase !== "fight") break;
    stepSkirmish(state, 0.02, rng);
    ticks++;
  }
  return { state, proof: { id: lease.id, ticks, actions } };
}

describe("출시 서버 전투 검증", () => {
  it("입장 없이 전투 발급·완료·보상을 요청할 수 없다", () => {
    const state = createDefaultSession();
    expect(() =>
      prepareCombat(
        state,
        { input: { mode: "stage" }, stageId: "1-1" },
        now,
        "lease-1",
      ),
    ).toThrow();
    expect(() =>
      authoritativeArgs(state, "completeStage", ["1-1", true]),
    ).toThrow("COMBAT_NOT_VERIFIED");
  });
  it.each([false, true])(
    "같은 시드·20ms 틱·궁극기 입력으로 서버가 승패와 HP를 재현한다: %s",
    (auto) => {
      const state = admitted(),
        lease = prepareCombat(
          state,
          { input: { mode: "stage" }, stageId: "1-1" },
          now,
          "lease-replay",
        );
      const client = fight(lease, auto);
      const verdict = finishCombat(
        state,
        client.proof,
        new Date(now.getTime() + 600000),
      );
      expect(verdict.victory).toBe(client.state.phase === "victory");
      expect(
        authoritativeArgs(state, "completeStage", ["1-1", !verdict.victory]),
      ).toEqual(["1-1", verdict.victory]);
      expect(
        finishCombat(state, client.proof, new Date(now.getTime() + 600000)),
      ).toEqual(verdict);
    },
  );
  it("새 인스턴스와 저장 직렬화를 지나도 입장과 검증 결과가 유지된다", () => {
    const state = admitted(),
      lease = prepareCombat(
        state,
        { input: { mode: "stage" }, stageId: "1-1" },
        now,
        "lease-serialized",
      );
    const restored = saveManager.parse(
      JSON.parse(JSON.stringify(saveManager.exportData(state))),
    );
    const client = fight(lease);
    const verdict = finishCombat(
      restored,
      client.proof,
      new Date(now.getTime() + 600000),
    );
    expect(verdict.victory).toBe(client.state.phase === "victory");
    recordBoundaryResult(restored, "completeStage", ["1-1", verdict.victory]);
    expect(() =>
      authoritativeArgs(restored, "completeStage", ["1-1", true]),
    ).toThrow();
  });
  it("시계보다 빠른 제출·과도한 틱·임의 궁극기·미완료 판 승리를 거절한다", () => {
    const state = admitted(),
      lease = prepareCombat(
        state,
        { input: { mode: "stage" }, stageId: "1-1" },
        now,
        "lease-bad",
      );
    expect(() =>
      finishCombat(state, { id: lease.id, ticks: 500, actions: [] }, now),
    ).toThrow();
    expect(() =>
      finishCombat(
        state,
        { id: lease.id, ticks: 18001, actions: [] },
        new Date(now.getTime() + 600000),
      ),
    ).toThrow();
    expect(() =>
      finishCombat(
        state,
        {
          id: lease.id,
          ticks: 0,
          actions: [{ tick: 0, actorId: "non-existent" }],
        },
        now,
      ),
    ).toThrow();
    expect(() =>
      finishCombat(state, { id: lease.id, ticks: 0, actions: [] }, now),
    ).toThrow();
    expect(
      finishCombat(
        state,
        { id: lease.id, ticks: 0, actions: [], abandoned: true },
        now,
      ).victory,
    ).toBe(false);
  });
  it("현상수배는 앞 라운드 승리 없이 다음 라운드를 발급하지 않는다", () => {
    const state = createDefaultSession();
    recordBoundaryResult(state, "enterBounty", [
      { tierId: "bounty-1", requestId: "bounty-run" },
    ]);
    expect(() =>
      prepareCombat(
        state,
        {
          input: {
            mode: "bounty",
            tierId: "bounty-1",
            requestId: "bounty-run",
            round: 1,
          },
        },
        now,
        "lease-bounty",
      ),
    ).toThrow();
    expect(Object.values(combatJournal(state).records)).toHaveLength(0);
  });
  it("구형 보스 리플레이 우회와 임의 대량 행동을 거절한다", () => {
    const state = createDefaultSession();
    expect(() => authoritativeArgs(state, "prepareExpeditionBoss", [{nodeId:"not-reached"}])).toThrow("COMBAT_NOT_VERIFIED");
    expect(() =>
      authoritativeArgs(state, "submitRaidDamage", [
        { requestId: "x", actions: [] },
      ]),
    ).toThrow("REPLAY_VERSION_REQUIRED");
    expect(() =>
      authoritativeArgs(state, "submitRaidDamage", [
        { replayVersion: 2, actions: Array(4097).fill({}) },
      ]),
    ).toThrow();
  });
});

describe("요청 경계", () => {
  it("null·배열·잘못된 requestId를 거절하고 정확한 읽기 목록만 재전송 키를 생략한다", () => {
    expect(
      [
        null,
        [],
        { method: "getInventory", args: {} },
        { method: "getInventory", requestId: 42 },
      ].map(validCall),
    ).toEqual([false, false, false, false]);
    expect(validCall({ method: "getInventory" })).toBe(true);
    expect(isReadMethod("getAnythingThatMutates")).toBe(false);
    expect(isReadMethod("social.searchUsers")).toBe(true);
    expect(MAX_BODY_BYTES).toBe(131072);
  });
});

import {
  handleGameCall,
  StateConflictError,
  type StateStore,
  type StoredState,
} from "../../src/server/gameHandler";
function storeInMemory() {
  let saved: StoredState | null = null;
  const receipts = new Map<string, unknown>();
  const store: StateStore = {
    async load() {
      return saved;
    },
    async findReceipt(_player, key) {
      return receipts.get(key);
    },
    async commit(input) {
      if ((saved?.revision ?? null) !== input.expectedRevision)
        throw new StateConflictError();
      const revision = String(Number(saved?.revision ?? 0) + 1);
      saved = { revision, data: JSON.parse(JSON.stringify(input.data)) };
      if (input.requestId)
        receipts.set(input.requestId, {
          ...(input.response as object),
          revision,
        });
      return { revision };
    },
  };
  return { store, snapshot: () => saved };
}
describe("운영 HTTP 처리기의 전투·멱등 경계", () => {
  it("입장→발급→검증→승리 정산이 새 FakeServer 인스턴스마다 이어지고 비용은 한 번만 든다", async () => {
    const memory = storeInMemory();
    let clock = now;
    const deps = {
      store: memory.store,
      strict: true,
      now: () => clock,
      random: () => 0.5,
    };
    let sequence = 0;
    const call = (method: string, args: unknown[] = [], requestId?: string) =>
      handleGameCall(
        "player",
        { method, args, requestId: requestId ?? `request-${++sequence}-test` },
        deps,
      );
    await call("getPlayerState");
    await expect(call("completeStage", ["1-1", true])).rejects.toThrow(
      "COMBAT_NOT_VERIFIED",
    );
    await call("enterStage", [{ stageId: "1-1", requestId: "stage-entry-1" }]);
    const lease = (
      await call("prepareCombat", [
        { input: { mode: "stage" }, stageId: "1-1" },
      ])
    ).result as ReturnType<typeof prepareCombat>;
    const client = fight(lease, true);
    clock = new Date(now.getTime() + 600000);
    await call("finishCombat", [client.proof]);
    const result = await call(
      "completeStage",
      ["1-1", true],
      "stage-complete-1",
    );
    const duplicate = await call(
      "completeStage",
      ["1-1", true],
      "stage-complete-1",
    );
    expect(duplicate.revision).toBe(result.revision);
    expect(
      (result.state as { clearedStageIds: string[] }).clearedStageIds.includes(
        "1-1",
      ),
    ).toBe(client.state.phase === "victory");
    expect(
      (result.state as { wallet: { stamina: number } }).wallet.stamina,
    ).toBeLessThan(STARTING_STAMINA);
    await expect(call("completeStage", ["1-1", true])).rejects.toThrow();
  });
  it("쓰기 키 누락·다른 메서드/본문에 같은 키 재사용을 거절한다", async () => {
    const memory = storeInMemory(),
      deps = { store: memory.store, strict: true, now: () => now };
    expect(() =>
      handleGameCall("player", { method: "markAttendanceAutoShown" }, deps),
    ).toThrow("request_id_required");
    await handleGameCall(
      "player",
      { method: "markAttendanceAutoShown", requestId: "binding-test" },
      deps,
    );
    await expect(
      handleGameCall(
        "player",
        {
          method: "setFavorite",
          args: [{ relicId: "torika" }],
          requestId: "binding-test",
        },
        deps,
      ),
    ).rejects.toThrow("request_id_conflict");
  });
});
