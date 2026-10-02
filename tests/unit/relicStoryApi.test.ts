import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { GameApiError } from "../../src/api/contracts";
import { BOND_STORY_GEM_REWARD, DIARY_QUESTION_GEM_REWARD, diaryQuestionUnlockAt } from "../../src/core/relicStory";
import { RelicStoryManager } from "../../src/managers/RelicStoryManager";
import { createDefaultSession } from "../../src/state/session";
import { RELIC_STORIES } from "../../src/data/relicStories";

const story = RELIC_STORIES.torika;
const met = "2026-09-19T20:00:00Z";

function setup(now: () => Date) {
  const state = createDefaultSession();
  state.owned.add("torika");
  state.relicStory.metAt = { torika: met };
  state.wallet.gems = 0;
  const api = new FakeServer(state, { latencyMs: 0, now });
  return { state, api, manager: new RelicStoryManager(state, api) };
}

describe("렐릭 이야기 — 관찰 질문과 애착 스토리 해금 젬", () => {
  it("질문은 만난 날부터 하루에 하나씩 열리고, 답은 기록만 남고 젬은 보상 아이콘으로 한 번만 받는다", async () => {
    let now = new Date("2026-09-19T23:00:00Z");
    const { state, api, manager } = setup(() => now);
    expect(manager.questionViews("torika", now.getTime()).map(({ status }) => status)).toEqual(["open", "locked", "locked"]);
    await expect(api.answerRelicQuestion({ relicId: "torika", questionId: story.questions[1].id, choiceId: story.questions[1].choices[0].id })).rejects.toMatchObject({ code: "RELIC_STORY_LOCKED" });

    const first = story.questions[0];
    await manager.answer("torika", first.id, first.choices[0].id);
    // 답만으로는 젬이 오르지 않고, 고른 답은 저장에 남지 않는다.
    expect(state.wallet.gems).toBe(0);
    expect(state.relicStory.answers[0]).not.toHaveProperty("choiceId");
    expect(manager.questionViews("torika", now.getTime())[0]).toMatchObject({ status: "answered", rewardClaimed: false });
    await expect(api.answerRelicQuestion({ relicId: "torika", questionId: first.id, choiceId: first.choices[1].id })).rejects.toBeInstanceOf(GameApiError);

    expect(await manager.claimQuestionReward("torika", first.id)).toBe(DIARY_QUESTION_GEM_REWARD);
    expect(state.wallet.gems).toBe(DIARY_QUESTION_GEM_REWARD);
    await expect(api.claimRelicQuestionReward({ relicId: "torika", questionId: first.id })).rejects.toMatchObject({ code: "RELIC_STORY_ALREADY_CLAIMED" });
    await expect(api.claimRelicQuestionReward({ relicId: "torika", questionId: story.questions[1].id })).rejects.toMatchObject({ code: "RELIC_STORY_LOCKED" });

    now = new Date("2026-09-20T00:00:01Z");
    expect(manager.questionViews("torika", now.getTime()).map(({ status }) => status)).toEqual(["answered", "open", "locked"]);
    now = new Date("2026-09-21T00:00:01Z");
    for (const question of story.questions.slice(1)) { await manager.answer("torika", question.id, question.choices[0].id); await manager.claimQuestionReward("torika", question.id); }
    expect(state.wallet.gems).toBe(DIARY_QUESTION_GEM_REWARD * 3);
    expect(manager.questionViews("torika", now.getTime()).every(({ status, rewardClaimed }) => status === "answered" && rewardClaimed)).toBe(true);
  });

  it("처음 만난 날이 없는 개체는 질문이 모두 열려 있고 없는 선택지·질문은 거절한다", async () => {
    expect([0, 1, 2].map((index) => diaryQuestionUnlockAt(undefined, index))).toEqual([0, 0, 0]);
    const { state, api } = setup(() => new Date("2026-09-19T23:00:00Z"));
    await expect(api.answerRelicQuestion({ relicId: "torika", questionId: story.questions[0].id, choiceId: "nope" })).rejects.toMatchObject({ code: "RELIC_STORY_NOT_FOUND" });
    state.owned.delete("torika");
    await expect(api.answerRelicQuestion({ relicId: "torika", questionId: story.questions[0].id, choiceId: story.questions[0].choices[0].id })).rejects.toMatchObject({ code: "RELIC_STORY_LOCKED" });
  });

  it("애착 스토리는 유대 레벨이 닿아야 열리고 장마다 해금 젬을 한 번만 준다", async () => {
    const { state, api, manager } = setup(() => new Date("2026-09-19T23:00:00Z"));
    state.relicProgress.torika = { ...state.relicProgress.torika, bondLevel: 6 };
    expect(manager.chapterViews("torika").map(({ unlocked }) => unlocked)).toEqual([true, true, false, false]);
    await expect(api.claimRelicChapter({ relicId: "torika", level: 8 })).rejects.toMatchObject({ code: "RELIC_STORY_LOCKED" });
    await expect(api.claimRelicChapter({ relicId: "torika", level: 5 })).rejects.toMatchObject({ code: "RELIC_STORY_NOT_FOUND" });
    expect(await manager.claimChapter("torika", 4)).toBe(BOND_STORY_GEM_REWARD[4]);
    await expect(api.claimRelicChapter({ relicId: "torika", level: 4 })).rejects.toMatchObject({ code: "RELIC_STORY_ALREADY_CLAIMED" });
    expect(await manager.claimChapter("torika", 6)).toBe(BOND_STORY_GEM_REWARD[6]);
    expect(state.wallet.gems).toBe(BOND_STORY_GEM_REWARD[4] + BOND_STORY_GEM_REWARD[6]);
    expect(manager.chapterViews("torika").map(({ claimed }) => claimed)).toEqual([true, true, false, false]);
  });
});
