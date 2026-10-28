import { describe, expect, it, vi } from "vitest";
import { pressResultAction } from "../../src/core/stageCompleteAction";
import { sourceClass } from "../helpers/sourceClass";

describe("결과판 충전 후 재입장", () => {
  it.each(["next", "replay"])("%s는 같은 결과판에서 충전 후 즉시 현재 에너지를 읽는다", async (kind) => {
    let options: any;
    const session = { wallet: { stamina: 0 } };
    const blocked = vi.fn(), route = vi.fn(), retry = vi.fn(), close = vi.fn();
    const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
      Phaser: { Scene: class {} }, session,
      gameApi: { completeStage: async () => ({ firstClearRewards: [] }) },
      battleStageStaminaCost: (stage: any) => stage.id === "ancient:11" ? 8 : 6,
      rememberPlayerExp: vi.fn(), PopupLayer: class {}, StageCompletePopup: class { open(value: any) { options = value; } },
      tutorialManager: { lobbyStep: () => undefined }, t: (key: string) => key,
      storyDifficultyOf: () => "easy", storyStages: () => [], isStageUnlocked: () => true,
      nextBattleStage: () => ({ id: "ancient:11", kind: "battle" }), goRoute: route,
      victoryRoute: (_: string, next: any) => next, partyRoute: (id: string) => ({ scene: "party", id }),
    });
    const scene = Object.assign(Object.create(Battle.prototype), {
      scene: { isActive: () => true }, battleInput: { mode: "stage" }, openingBattle: () => false,
      stageExit: () => "stageMap", stageCompleteFighters: () => [], featureOpen: () => true,
      openStaminaCharge: blocked, retryBattle: retry,
    });
    await scene.finishStageVictory({ id: "1-2" });
    const action = options.clearActions[kind === "next" ? 0 : 1];
    pressResultAction(action, close);
    expect(blocked).toHaveBeenCalledOnce();
    expect(close).not.toHaveBeenCalled();
    session.wallet.stamina = 6;
    if (kind === "next") {
      pressResultAction(action, close);
      expect(route).not.toHaveBeenCalled(); // 다음 층의 더 높은 비용도 다시 확인한다.
    }
    session.wallet.stamina = 60;
    pressResultAction(action, close);
    expect(kind === "next" ? route : retry).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });
});
