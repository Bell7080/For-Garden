import { expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import { lobbyTutorialGateStage } from "../../src/core/tutorial";

it.each([["1-2", "feed"], ["1-5", "gift"]])("%s 튜토리얼 결과는 후 대사를 보존해 광장으로 돌아간다", async (id, step) => {
  let options: any;
  const goRoute = vi.fn();
  const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
    Phaser: { Scene: class {} }, gameApi: { completeStage: async () => ({ firstClear: true, firstClearRewards: [], cheesecakeEarned: 50 }) },
    session: { wallet: { stamina: 100 } }, battleStageStaminaCost: () => 5, rememberPlayerExp: vi.fn(),
    PopupLayer: class {}, StageCompletePopup: class { open(value: any) { options = value; } },
    tutorialManager: { lobbyStep: () => step }, lobbyTutorialGateStage, nextBattleStage: () => ({ id: "1-3" }), STAGES: [], storyStages: () => [], storyDifficultyOf: () => "easy",
    isStageUnlocked: () => true, t: (key: string) => key, goRoute,
    victoryRoute: (stage: string, then: unknown) => ({ scene: "stageStory", data: { stage, then } }),
  });
  const scene = Object.assign(Object.create(Battle.prototype), { scene: { isActive: () => true }, openingBattle: () => false,
    stageCompleteFighters: () => [], resultTheme: () => undefined, battleInput: { mode: "stage" }, featureOpen: () => true,
  });
  await scene.finishStageVictory({ id });
  expect(options.clearActions).toHaveLength(1);
  expect(options.clearActions[0].primary).toBe(true);
  expect(options.returnHint).toBe(step === "gift" ? "tutorial.result.research" : "tutorial.result.feed");
  options.onConfirm();
  expect(goRoute).toHaveBeenCalledWith(scene, { scene: "stageStory", data: { stage: id, then: { scene: "lobby" } } });
});


it.each([true, false])("패배 저장이 끝나야 재도전하며 떠난 화면에서는 시작하지 않는다: active=%s", async active => {
  let options: any, settle!: () => void;
  const saved = new Promise<void>(resolve => { settle = resolve; });
  const retryBattle = vi.fn();
  const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
    Phaser: { Scene: class {} }, gameApi: { completeStage: () => saved },
    session: { wallet: { stamina: 100 } }, battleStageStaminaCost: () => 5,
    PopupLayer: class {}, StageCompletePopup: class { open(value: any) { options = value; } },
    t: (key: string) => key,
  });
  const scene = Object.assign(Object.create(Battle.prototype), {
    scene: { isActive: () => active }, combatGeneration: 1, stageExit: () => "lobby", retryBattle,
    defeatGrowth: () => undefined, stageCompleteFighters: () => [], resultTheme: () => undefined, featureOpen: () => false,
  });
  scene.finishStageDefeat({ id: "1-1" });
  options.replay.onPress();
  expect(retryBattle).not.toHaveBeenCalled();
  settle();
  await saved; await Promise.resolve();
  expect(retryBattle).toHaveBeenCalledTimes(active ? 1 : 0);
});
