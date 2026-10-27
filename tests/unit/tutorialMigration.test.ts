import { describe, expect, it } from "vitest";
import { SaveManager } from "../../src/state/SaveManager";
import { createDefaultSession } from "../../src/state/session";
import { TUTORIAL_STEPS } from "../../src/core/tutorial";
import { FakeServer } from "../../src/api/FakeServer";

const oldOrder = ["ultimate", "auto", "presentation", "speed", "contribution", "feed", "gift", "pull"];
describe("저장 v50 튜토리얼 이전과 지원품 지급", () => {
  it("받은 연구 지원품과 뽑기 완료를 보존하며 다시 호출해도 추가 화석을 주지 않는다", async () => {
    const saves = new SaveManager();
    const old = saves.exportData(createDefaultSession());
    old.saveVersion = 50;
    old.tutorial = { completedStepIds: oldOrder as never };
    old.wallet.fossil = 123;
    const state = saves.parse(old);
    expect(state.tutorial?.completedStepIds).toEqual(TUTORIAL_STEPS);
    const server = new FakeServer(state, { latencyMs: 0 });
    const response = await server.completeTutorialStep({ stepId: "gift" });
    expect(response.granted).toBeUndefined();
    expect(response.wallet.fossil).toBe(123);
  });
  it("1-2 이후 재접속은 일반 강화에서 시작하고 이후 단계도 저장을 왕복한다", () => {
    const saves = new SaveManager();
    const old = saves.exportData(createDefaultSession());
    old.saveVersion = 50; old.tutorial = { completedStepIds: ["ultimate", "auto"] };
    const state = saves.parse(old);
    expect(state.tutorial?.completedStepIds).toEqual(["ultimate", "auto"]);
    state.tutorial!.completedStepIds.push("feed");
    expect(saves.parse(saves.exportData(state)).tutorial?.completedStepIds).toEqual(["ultimate", "auto", "feed"]);
  });
  it("첫 연구 완료는 비용·획득 결과와 함께 저장되어 추가 완료 요청이 필요 없다", async () => {
    const state = createDefaultSession(); state.wallet.fossil = 8; state.cleared.add("1-5");
    state.tutorial = { completedStepIds: [...TUTORIAL_STEPS.slice(0, -1)] };
    const server = new FakeServer(state, { latencyMs: 0, random: () => .5 });
    await server.pullRelics({ bannerId: "welcome", count: 10 });
    expect(state.tutorial?.completedStepIds).toEqual(TUTORIAL_STEPS);
    expect(state.wallet.fossil).toBe(0);
    const saved = new SaveManager().exportData(state);
    expect(new SaveManager().parse(saved).tutorial?.completedStepIds).toEqual(TUTORIAL_STEPS);
  });
  it("연구 저장이 실패하면 튜토리얼·지갑·획득을 모두 이전 상태로 둔다", async () => {
    const state = createDefaultSession(); state.wallet.fossil = 8; state.cleared.add("1-5");
    state.tutorial = { completedStepIds: [...TUTORIAL_STEPS.slice(0, -1)] };
    const server = new FakeServer(state, { latencyMs: 0, random: () => .5 });
    (server as any).persist = () => { throw Error("save failed"); };
    await expect(server.pullRelics({ bannerId: "welcome", count: 10 })).rejects.toThrow("save failed");
    expect(state.tutorial.completedStepIds).toEqual(TUTORIAL_STEPS.slice(0, -1));
    expect(state.wallet.fossil).toBe(8);
  });
});
