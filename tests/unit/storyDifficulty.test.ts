import { prepareCombat, combatJournal } from "../../src/server/combatAuthority";
import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { STORY_DIFFICULTIES, difficultyStageRewards, isStoryDifficultyUnlocked, newlyUnlockedStoryDifficulty, storyDifficultyGrowth, storyStageId } from "../../src/core/storyDifficulty";
import { nextBattleStage } from "../../src/core/stageProgress";
import { stageClearAdvancesTutorial } from "../../src/core/tutorial";
import { getBattleStage, getStageEnemies, STAGES, storyStages } from "../../src/data/stages";
import { createDefaultSession } from "../../src/state/session";
import { SaveManager } from "../../src/state/SaveManager";

describe("스토리 확장 난이도", () => {
  it("서버 전투 발급도 같은 난이도 적을 쓰고 잠긴 진행은 발급하지 않는다", () => {
    const state = createDefaultSession();
    state.cleared = new Set(["4-10", ...Array.from({ length: 9 }, (_, i) => `normal:1-${i + 1}`)]);
    combatJournal(state).tickets["stage:normal:1-10"] = { kind: "stage", target: "normal:1-10", requestId: "admission" };
    const request = { input: { mode: "stage" as const }, stageId: "normal:1-10" };
    const lease = prepareCombat(state, request, new Date("2026-10-22"), "normal-test");
    expect(lease.setup.enemies).toEqual(getStageEnemies(getBattleStage("normal:1-10")));
    const locked = createDefaultSession();
    combatJournal(locked).tickets["stage:normal:1-10"] = { kind: "stage", target: "normal:1-10", requestId: "admission" };
    expect(() => prepareCombat(locked, request, new Date("2026-10-22"), "locked")).toThrow("COMBAT_REJECTED");
  });

  it("이전 난이도 4-10을 고정 해금 조건으로 쓰며 3-10만 깨서는 열리지 않는다", () => {
    expect(isStoryDifficultyUnlocked("easy", new Set())).toBe(true);
    expect(isStoryDifficultyUnlocked("normal", new Set(["3-10"]))).toBe(false);
    expect(isStoryDifficultyUnlocked("normal", new Set(["4-10"]))).toBe(true);
    expect(isStoryDifficultyUnlocked("hard", new Set(["4-10"]))).toBe(false);
    expect(isStoryDifficultyUnlocked("hard", new Set(["4-10", "normal:4-10"]))).toBe(true);
    expect(newlyUnlockedStoryDifficulty("4-10", true)).toBe("normal");
    expect(newlyUnlockedStoryDifficulty("normal:4-10", true)).toBe("hard");
    expect(newlyUnlockedStoryDifficulty("4-10", false)).toBeUndefined();
  });
  it("모든 원본 전투의 개체·인원·정예·배치를 유지하며 이야기 SUB만 제외한다", () => {
    for (const difficulty of ["normal", "hard"] as const) {
      expect(storyStages(difficulty).every(stage => stage.kind === "battle")).toBe(true);
      for (const base of STAGES.filter(stage => stage.kind === "battle")) {
        const stage = getBattleStage(storyStageId(difficulty, base.id));
        expect(stage.elite).toBe(base.elite);
        expect(stage.sub).toBe(base.sub);
        expect(stage.enemies.map(({ relicId, formationSlot, elite }) => ({ relicId, formationSlot, elite }))).toEqual(base.enemies.map(({ relicId, formationSlot, elite }) => ({ relicId, formationSlot, elite })));
        expect(stageClearAdvancesTutorial(stage)).toBe(false);
      }
      expect(getBattleStage(`${difficulty}:1-10`).enemies.map(enemy => enemy.relicId)).toEqual(["koma"]);
    }
  });
  it("보상과 진행을 분리하고 다음 단계는 같은 난이도 안에서만 찾는다", async () => {
    const state = createDefaultSession();
    const api = new FakeServer(state, { latencyMs: 0 });
    await expect(api.enterStage({ stageId: "normal:1-1", requestId: "locked" })).rejects.toMatchObject({ code: "STAGE_LOCKED" });
    await expect(api.completeStage("normal:1-1", true)).rejects.toMatchObject({ code: "STAGE_LOCKED" });
    state.cleared.add("4-10");
    const reward = await api.completeStage("normal:1-1", true);
    expect(reward.firstClear).toBe(true);
    expect(state.cleared.has("normal:1-1")).toBe(true);
    expect(state.cleared.has("1-1")).toBe(false);
    expect((await api.completeStage("normal:1-1", true)).firstClear).toBe(false);
    expect(nextBattleStage(storyStages("normal"), "normal:1-1", id => id === "normal:1-2")?.id).toBe("normal:1-2");
    expect(nextBattleStage(storyStages("normal"), "normal:4-10", () => true)).toBeUndefined();
  });
  it("반복·초회 재화만 25%·50% 올리고 화석과 룬 수량은 유지한다", () => {
    const rewards = getBattleStage("1-10").rewards;
    for (const difficulty of STORY_DIFFICULTIES) {
      const next = difficultyStageRewards(rewards, difficulty);
      expect(next).toEqual(getBattleStage(storyStageId(difficulty, "1-10")).rewards);
      expect(next.firstClearBonus?.filter(row => row.kind === "rune" || row.currency === "fossil")).toEqual(rewards.firstClearBonus?.filter(row => row.kind === "rune" || row.currency === "fossil"));
    }
  });
  it("새 난이도 기록과 선택을 기존 저장 장부로 왕복하고 기존 쉬움 기록을 보존한다", () => {
    let raw: string | null = null;
    const manager = new SaveManager({ getItem: () => raw, setItem: (_key, value) => { raw = value; }, removeItem: () => {} });
    const state = createDefaultSession(); state.cleared = new Set(["4-10", "normal:1-1"]); state.selectedStageId = "normal:1-2";
    manager.save(state);
    expect(manager.load()?.cleared).toEqual(state.cleared);
    expect(manager.load()?.selectedStageId).toBe("normal:1-2");
  });
  it("전환부의 성장 기준을 맞추고 강화는 공속·치명타를 변경하지 않는다", () => {
    expect(storyDifficultyGrowth("normal", 1, 10)).toEqual({ level: 56, multiplier: 1 });
    expect(storyDifficultyGrowth("normal", 4, 10)).toEqual({ level: 60, multiplier: 1.2 });
    expect(storyDifficultyGrowth("hard", 1, 10)).toEqual({ level: 60, multiplier: 1.2 });
    for (const id of ["1-10", "4-10"]) {
      const easy = getStageEnemies(getBattleStage(id)), normal = getStageEnemies(getBattleStage(`normal:${id}`)), hard = getStageEnemies(getBattleStage(`hard:${id}`));
      normal.forEach((enemy, index) => {
        expect(enemy.stats.hp).toBeGreaterThan(easy[index].stats.hp);
        expect(hard[index].stats.hp).toBeGreaterThan(enemy.stats.hp);
        expect(hard[index].stats.attackSpeed).toBe(easy[index].stats.attackSpeed);
      });
    }
  });
});
