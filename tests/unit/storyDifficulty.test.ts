import { combatState } from "../../src/core/combatProtocol";
import { combatPower } from "../../src/core/combatPower";
import { ENCOUNTER_ROLE } from "../../src/core/levelDesign";
import { partyPreview } from "../../src/data/partyContent";
import { prepareCombat, combatJournal } from "../../src/server/combatAuthority";
import { describe, expect, it } from "vitest";
import { FakeServer } from "../../src/api/FakeServer";
import { STORY_DIFFICULTIES, difficultyStageRewards, isStoryDifficultyUnlocked, newlyUnlockedStoryDifficulty, STORY_DIFFICULTY, storyStageId } from "../../src/core/storyDifficulty";
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
    expect(nextBattleStage(storyStages("normal"), "normal:7-10", () => true)).toBeUndefined();
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
  it("난이도 전환은 이전 4-10과 다음 1-1의 표시 전투력을 챌린지 배율(보통 2·어려움 4)만큼 벌어지되 20% 안에서 이어 간다", () => {
    const power = (id: string) => getStageEnemies(getBattleStage(id)).reduce((sum, enemy) => sum + combatPower(enemy.stats), 0);
    for (const [end, start] of [["4-10", "normal:1-1"], ["normal:4-10", "hard:1-1"]]) expect(Math.abs(power(start) / power(end) - 1)).toBeLessThan(.21);
    expect(power("hard:4-10")).toBeGreaterThan(power("normal:4-10"));
  });

  it("젬은 10개 단위이고 스토리 골드는 종전의 약 1/10 규모다", async () => {
    for (const difficulty of STORY_DIFFICULTIES) for (const stage of storyStages(difficulty)) {
      if (stage.kind !== "battle") continue;
      for (const reward of stage.rewards.firstClearBonus ?? []) {
        if (reward.kind !== "currency") continue;
        if (reward.currency === "gems") expect(reward.amount % 10).toBe(0);
        // 7-10 보통 난이도(정예 ×2 · 보통 ×1.5)가 가장 크다 — (300 + 69 × 100) × 2 × 1.5.
        if (reward.currency === "gold") expect(reward.amount).toBeLessThanOrEqual(21_600);
      }
    }
    const state = createDefaultSession(); state.cleared = new Set(["4-10", "normal:4-5"]);
    state.wallet.gold = 0; state.wallet.gems = 0;
    const receipt = await new FakeServer(state, { latencyMs: 0 }).completeStage("normal:4-6", true);
    expect(receipt.firstClearRewards).toContainEqual({kind:"currency", currency:"gold", amount:4_800});
    expect(receipt.firstClearRewards).toContainEqual({kind:"currency", currency:"gems", amount:60});
    expect(state.wallet.gold).toBe(4_800);
    expect(state.wallet.gems).toBe(60);
  });

  it.each(["3-5", "3-10", "4-4", "4-5", "4-6", "4-9", "4-10"])("%s 정예와 혼합 편성의 크기가 서버 발급·전투 복원·편성에 일치한다", id => {
    for (const difficulty of STORY_DIFFICULTIES) {
      const stage = getBattleStage(storyStageId(difficulty, id));
      const state = createDefaultSession(); state.cleared = new Set(["4-10", "normal:4-10", ...stage.prerequisiteStageIds]);
      combatJournal(state).tickets[`stage:${stage.id}`] = {kind:"stage", target:stage.id, requestId:"elite"};
      const lease = prepareCombat(state, {input:{mode:"stage"}, stageId:stage.id}, new Date("2026-10-23"), "elite-test");
      const saves = new SaveManager();
      const restored = saves.parse(saves.exportData(state));
      const fighters = combatState(combatJournal(restored).records[lease.id].lease).fighters.filter(f => f.side === "enemy");
      const preview = partyPreview({content:"stage"}, stage);
      expect(fighters.map(f=>f.bodyScale)).toEqual(preview.shown.map(e=>ENCOUNTER_ROLE[e.def!.encounterRole!].bodyScale));
      expect(fighters.some(f=>f.def.encounterRole === "elite" && f.bodyScale > 1)).toBe(true);
      if (id === "4-6" || id === "4-9") {
        expect(fighters.filter(f=>f.bodyScale > 1).map(f=>f.def.id)).toEqual(["koma"]);
        expect(fighters.filter(f=>f.def.id !== "koma").every(f=>f.bodyScale === 1)).toBe(true);
      }
    }
  });

  it("장 배율은 장마다 하나다", () => {
    const factor = (id: string) => getBattleStage(id).difficultyStatMultiplier ?? 1;
    expect(["1-1", "1-10", "2-1", "3-10", "4-1", "4-10", "5-1", "5-10", "6-1", "7-10"].map(factor)).toEqual([1, 1, 1.05, 1.1, 1.15, 1.15, 1.2, 1.2, 1.25, 1.3]);
    expect(getBattleStage(storyStageId("normal", "7-10")).difficultyStatMultiplier).toBeCloseTo(STORY_DIFFICULTY.normal.statFactor * 1.3);
  });

  it("쉬움의 편성·레벨·돌파·정예를 그대로 상속하고 오각형에만 난이도 종족값을 적용한다", () => {
    for (const difficulty of ["normal", "hard"] as const) {
      for (const base of STAGES.filter(stage => stage.kind === "battle")) {
        const stage = getBattleStage(storyStageId(difficulty, base.id));
        expect(stage.enemies).toEqual(base.enemies);
        expect(stage.enemies).not.toBe(base.enemies);
        const easy = getStageEnemies(base), grown = getStageEnemies(stage);
        grown.forEach((enemy, i) => {
          for (const key of ["hp", "atk", "ap", "def", "res"] as const) {
            // 장 배율이 붙은 관문은 쉬움 값이 이미 한 번 반올림되어 있어 1~2만큼 어긋날 수 있다.
            const factor = STORY_DIFFICULTY[difficulty].statFactor;
            expect(Math.abs(enemy.stats[key] - easy[i].stats[key] * factor)).toBeLessThanOrEqual(base.difficultyStatMultiplier ? factor : 0.5);
          }
          for (const key of ["attackSpeed", "moveSpeed", "critChance", "critDamage", "energyGain"] as const) expect(enemy.stats[key]).toBe(easy[i].stats[key]);
          expect(enemy.encounterRole).toBe(easy[i].encounterRole);
        });
      }
    }
  });
});
