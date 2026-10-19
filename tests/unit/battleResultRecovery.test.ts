import { describe, expect, it, vi } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
describe("전투 결과 UI 복구", () => {
    it("클리어 저장 성공 뒤 결과판 생성이 실패해도 지급 API를 다시 호출하지 않는다", async () => {
        const receipt = { firstClear: true, firstClearRewards: [], cheesecakeEarned: 50 };
        const completeStage = vi.fn().mockResolvedValueOnce(receipt).mockRejectedValue(Error("COMBAT_NOT_VERIFIED"));
        const open = vi.fn().mockImplementationOnce(() => { throw Error("render interrupted"); }).mockImplementation(() => undefined);
        const showResultFailure = vi.fn();
        const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
            Phaser: { Scene: class {
                } }, gameApi: { completeStage }, session: { wallet: { stamina: 100 } }, CONTENT_STAMINA_COSTS: { normalStage: 5 },
            rememberPlayerExp: vi.fn(), PopupLayer: class {
            }, StageCompletePopup: class {
                open = open;
            },
            nextBattleStage: () => undefined, STAGES: [], isStageUnlocked: () => true, t: (key: string) => key,
        });
        const scene = Object.assign(Object.create(Battle.prototype), {
            scene: { isActive: () => true }, openingBattle: () => false, stageCompleteFighters: () => [], battleInput: { mode: "stage" }, featureOpen: () => true, showResultFailure,
        });
        await scene.finishStageVictory({ id: "3-10" });
        expect(showResultFailure).toHaveBeenCalledOnce();
        showResultFailure.mock.calls[0][0]();
        await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));
        expect(completeStage).toHaveBeenCalledTimes(1);
    });
    it("늦은 전투 검증 응답이 재입장한 전투의 발급표를 지우지 않는다", async () => {
        let resolve!: (value: unknown) => void;
        const promise = new Promise(r => { resolve = r; });
        const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", { Phaser: { Scene: class {
                } }, gameApi: { finishCombat: () => promise }, session: { selectedStageId: "3-10" }, getBattleStage: () => ({ id: "3-10" }) });
        const finishStageVictory = vi.fn();
        const scene = Object.assign(Object.create(Battle.prototype), { combatLease: { id: "old" }, combatGeneration: 1, combatTicks: 100, combatActions: [], state: { phase: "victory" }, scene: { isActive: () => true }, battleInput: { mode: "stage" }, finishStageVictory });
        scene.openBattleResult("victory");
        scene.combatGeneration = 2;
        const current = { id: "new" };
        scene.combatLease = current;
        resolve({ victory: true });
        await promise;
        await Promise.resolve();
        expect(scene.combatLease).toBe(current);
        expect(finishStageVictory).not.toHaveBeenCalled();
    });
    it.each(["raid", "expeditionBoss"])("이전 %s의 늦은 정산 응답은 새 전투 결과창을 열지 않는다", async (mode) => {
        let resolve!: (value: unknown) => void;
        const pending = new Promise(r => { resolve = r; });
        const complete = vi.fn();
        const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", { Phaser: { Scene: class {
                } }, gameApi: { submitRaidDamage: () => pending }, beginBossSettlementAttempt: () => true, completeBossSettlementAttempt: complete });
        const show = vi.fn();
        const scene = Object.assign(Object.create(Battle.prototype), { combatGeneration: 1, battleInput: { mode, raidId: "raid", requestId: "entry", replayVersion: 2 }, scene: { isActive: () => true }, showRaidResult: show, showBossResult: show, bossSettlement: { finish: () => pending } });
        const operation = mode === "raid" ? scene.submitRaidRun([]) : scene.submitAndSettleBoss(scene.battleInput, []);
        scene.combatGeneration = 2;
        resolve({ score: {}, settlement: {} });
        await operation;
        expect(show).not.toHaveBeenCalled();
        expect(complete).not.toHaveBeenCalled();
    });
});
