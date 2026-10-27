import { describe, expect, it, vi } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { StoryManager } from "../../src/managers/StoryManager";
import { createDefaultSession, type Session } from "../../src/state/session";
import { saveManager } from "../../src/state/SaveManager";
import { STAGES } from "../../src/data/stages";
import { RECOLLECTION_STORIES } from "../../src/data/dialogues/recollections";
import { OPENING_TRAIN } from "../../src/data/dialogues/openingTrain";
import { PLAYABLE_RELICS } from "../../src/data/relics";
import { mileageWeeklyClerkId } from "../../src/data/mileageClerk";

const now = new Date("2026-10-20T00:00:00Z");
const apiFor = (state: Session) => new FakeServer(state, { latencyMs: 0, now: () => now, random: () => 0, persistSession: () => undefined });
function unlocked() {
  const state = createDefaultSession();
  state.cleared = new Set(STAGES.filter(stage => stage.kind === "battle").map(stage => stage.id));
  state.staminaUpdatedAt = now.toISOString();
  return state;
}
async function deferredRex() {
  const state = unlocked(); state.owned.delete("rex"); delete state.relicProgress.rex;
  const api = apiFor(state);
  expect(await api.applyStoryEffect({ storyId: "stage-2-6-same-line", nodeId: "choose", choiceId: "return" })).toEqual({ xpGained: 0, xpDeferred: 3 });
  await api.completeStory({ storyId: "stage-2-6-same-line" });
  return saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
}

describe("스토리 검증과 선택 보상 복구", () => {
  it("새 계정은 미해금 서브·후속 대사와 존재하지 않는 이야기의 보상을 만들 수 없다", async () => {
    const state = createDefaultSession(), api = apiFor(state);
    const before = saveManager.exportData(state);
    for (const storyId of ["stage-3-8-apology", "stage-1-2-post", "audit-nonexistent-story"]) {
      await expect(api.completeStory({ storyId })).rejects.toMatchObject({ code: "INVALID_STATE" });
    }
    await expect(api.applyStoryEffect({ storyId: "audit-nonexistent-story", effect: { type: "bondXp", relicId: "torika", amount: 20 } })).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(saveManager.exportData(state)).toEqual(before);
  });

  it("정적 원고의 모든 유대 대상은 실제 플레이 가능 ID이며 선택 ID로 지급된다", async () => {
    let checked = 0;
    for (const story of RECOLLECTION_STORIES) for (const node of story.nodes) for (const choice of node.choices ?? []) {
      if (!choice.effect) continue;
      checked++;
      expect(PLAYABLE_RELICS.some(relic => relic.id === choice.effect!.relicId)).toBe(true);
      const state = unlocked();
      // 실제 원고의 앞선 선택을 따라가며 표적 노드에 도착한다.
      const api = apiFor(state);
      let id: string | undefined = story.startNodeId;
      while (id && id !== node.id) {
        const previous = story.nodes.find(entry => entry.id === id)!;
        if (previous.choices?.length) {
          await api.applyStoryEffect({ storyId: story.id, nodeId: previous.id, choiceId: previous.choices[0].id });
          id = previous.choices[0].nextId;
        } else id = previous.nextId;
      }
      if (id !== node.id) continue; // 선택한 다른 가지의 노드는 그 가지를 읽을 때 검사한다.
      await expect(api.applyStoryEffect({ storyId: story.id, nodeId: node.id, choiceId: choice.id })).resolves.toHaveProperty("xpGained");
    }
    expect(checked).toBeGreaterThanOrEqual(9);
  });

  it("카탈로그의 선택 ID와 다른 보상 수치를 보내면 거절한다", async () => {
    const state = unlocked(), api = apiFor(state);
    await expect(api.applyStoryEffect({ storyId: OPENING_TRAIN.id, nodeId: "answer", choiceId: "promise", effect: { type: "bondXp", relicId: "torika", amount: 20 } })).rejects.toMatchObject({ code: "INVALID_STATE" });
    expect(state.serverJournal?.storyChoices).toBeUndefined();
  });

  it("완료 전에도 재접속·다른 선택 재전송으로 같은 노드의 보상이 늘지 않는다", async () => {
    const state = unlocked(), before = state.relicProgress.torika.bondXp;
    await apiFor(state).applyStoryEffect({ storyId: OPENING_TRAIN.id, nodeId: "answer", choiceId: "promise" });
    const restored = saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
    const api = apiFor(restored);
    await api.applyStoryEffect({ storyId: OPENING_TRAIN.id, nodeId: "answer", choiceId: "promise" });
    await api.applyStoryEffect({ storyId: OPENING_TRAIN.id, nodeId: "answer", choiceId: "work" });
    expect(restored.relicProgress.torika.bondXp).toBe(before + 5);
    await api.completeStory({ storyId: OPENING_TRAIN.id });
    expect(await api.applyStoryEffect({ storyId: OPENING_TRAIN.id, nodeId: "answer", choiceId: "promise" })).toEqual({ xpGained: 0 });
  });

  it("효과 통신 실패가 지속되면 완료를 기록하지 않고, 복구 후 같은 선택을 한 번 지급한다", async () => {
    const state = createDefaultSession(), api = apiFor(state), manager = new StoryManager(state, api);
    const before = state.relicProgress.torika.bondXp;
    const fail = vi.spyOn(api, "applyStoryEffect").mockRejectedValue(Error("offline"));
    await expect(manager.applyChoice(OPENING_TRAIN.id, "answer", "promise")).rejects.toThrow("offline");
    await expect(manager.complete(OPENING_TRAIN.id)).rejects.toThrow("offline");
    expect(state.completedStoryIds.has(OPENING_TRAIN.id)).toBe(false);
    fail.mockRestore();
    expect(await manager.complete(OPENING_TRAIN.id)).toBe(true);
    expect(await manager.complete(OPENING_TRAIN.id)).toBe(false);
    expect(state.relicProgress.torika.bondXp).toBe(before + 5);
  });

  it("계정이 바뀌면 이전 계정의 미확인 선택을 다음 계정에서 재전송하지 않는다", async () => {
    const state = createDefaultSession(), api = apiFor(state), manager = new StoryManager(state, api);
    const fail = vi.spyOn(api, "applyStoryEffect").mockRejectedValue(Error("offline"));
    await expect(manager.applyChoice(OPENING_TRAIN.id, "answer", "promise")).rejects.toThrow();
    const next = createDefaultSession(); next.playerCard.uid = "next-account";
    Object.assign(state, next); fail.mockRestore();
    const before = state.relicProgress.torika.bondXp;
    await manager.complete(OPENING_TRAIN.id);
    expect(state.relicProgress.torika.bondXp).toBe(before);
  });

  it("미보유 유대 적립은 JSON 저장을 지나 실제 뽑기 최초 획득 때 한 번만 지급한다", async () => {
    const state = await deferredRex(); state.wallet.fossil = 100;
    expect(state.serverJournal?.pendingStoryBondXp?.rex).toBe(3);
    const api = apiFor(state);
    await api.pullRelics({ bannerId: "fossil", count: 10 });
    expect(state.owned.has("rex")).toBe(true); expect(state.relicProgress.rex.bondXp).toBe(23);
    expect(state.serverJournal?.pendingStoryBondXp?.rex).toBeUndefined();
    await api.pullRelics({ bannerId: "fossil", count: 10 });
    expect(state.relicProgress.rex.bondXp).toBe(23);
  });

  it("파편 상점으로 처음 획득해도 같은 저장에서 적립분을 지급·제거한다", async () => {
    const state = unlocked(), clerk = mileageWeeklyClerkId(now)!;
    state.owned.delete(clerk); delete state.relicProgress[clerk]; state.wallet.dnaFragments = 200;
    state.serverJournal = { ...state.serverJournal!, pendingStoryBondXp: { [clerk]: 3 } };
    await apiFor(state).purchaseProduct({ storefront: "mileage", productId: "mileage-weekly-ssr", quantity: 1 });
    expect(state.relicProgress[clerk].bondXp).toBe(23);
    expect(state.serverJournal?.pendingStoryBondXp?.[clerk]).toBeUndefined();
  });

  it("획득 저장 실패 때 적립분도 소진하지 않고 재시도할 수 있다", async () => {
    const state = await deferredRex(); state.wallet.fossil = 100;
    let fail = true;
    const api = new FakeServer(state, { latencyMs: 0, now: () => now, random: () => 0, persistSession: () => { if (fail) throw Error("disk full"); } });
    await expect(api.pullRelics({ bannerId: "fossil", count: 10 })).rejects.toMatchObject({ code: "PERSISTENCE_FAILED" });
    expect(state.wallet.fossil).toBe(100); expect(state.owned.has("rex")).toBe(false); expect(state.serverJournal?.pendingStoryBondXp?.rex).toBe(3);
    fail = false; await api.pullRelics({ bannerId: "fossil", count: 10 });
    expect(state.relicProgress.rex.bondXp).toBe(23); expect(state.serverJournal?.pendingStoryBondXp?.rex).toBeUndefined();
  });
});
