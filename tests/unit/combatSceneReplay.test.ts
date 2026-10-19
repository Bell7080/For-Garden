import { describe, expect, it } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import * as skirmish from "../../src/core/skirmish";
import * as ultimate from "../../src/core/ultimateSequence";
import { createDefaultSession, createInitialRelicProgress } from "../../src/state/session";
import { prepareCombat, finishCombat } from "../../src/server/combatAuthority";
import { recordBoundaryResult } from "../../src/server/releaseBoundary";
import { combatState } from "../../src/core/combatProtocol";
import { bossBattleRandom } from "../../src/core/bossSimulation";
import { saveManager } from "../../src/state/SaveManager";
let clock = 0;
const noop = () => undefined;
const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
    Phaser: { Scene: class {
        } }, ...skirmish, ...ultimate,
    performance: { now: () => clock }, BOSS_STEP_MS: 20, formatBattleClock: () => "", hasMergedBattleHit: () => false,
    ultimatePresentationFor: () => ({}), ultimatePresentationTiming: () => ({ rate: 1 }), shouldWaitForUltimatePresentation: () => false,
});
function sceneFight(lease: ReturnType<typeof prepareCombat>, speed: number) {
    clock = 0;
    const scene = Object.assign(Object.create(Battle.prototype), {
        state: combatState(lease), combatLease: lease, combatTicks: 0, combatActions: [], bossActions: [],
        battleInput: { mode: "stage" }, spawned: true, finished: false, lastStepAt: 0, fightStartsAt: 0, battleSpeed: speed,
        bossStepRemainder: 0, rng: bossBattleRandom(lease.seed), autoUltimate: true, ultimateSequence: ultimate.createUltimateSequenceState(),
        ultimateSequenceActive: false, scene: { isActive: () => true }, views: new Map(), tweens: { killTweensOf: noop },
        stepMeters: noop, refreshContribution: noop, syncCombatEffects: noop, syncGroundSurfaces: noop, refreshProfiles: noop,
        refreshDebug: noop, syncViews: noop, paintDeathClock: noop, simulationPaused: () => false, pressProfileCard: noop,
        ultimatePresentationSkipped: () => true,
        playEvent(event: skirmish.SkirmishEvent) { if (event.kind === "finish")
            this.finished = true; },
    });
    for (const fighter of scene.state.fighters)
        scene.views.set(fighter.id, { fighter, creature: { scaleX: 1 }, hpBar: { setValue: noop, setShield: noop } });
    let frame = 0;
    while (!scene.finished && frame++ < 20000) {
        clock += frame % 13 === 0 ? 200 : 17;
        scene.update();
    }
    expect(scene.finished).toBe(true);
    return { scene, proof: { id: lease.id, ticks: scene.combatTicks, actions: scene.combatActions } };
}
describe("실제 전투 씬 기록 → 서버 재현", () => {
    for (const party of [["rex", "mette", "torika"], ["rex", "torika", "mette"]])
        for (const speed of [1, 2, 3])
            for (const seed of [1, 7, 42])
                for (const breakthrough of [0, 1, 2, 3, 4]) {
                    it(`3-10 ${party.join("/")} ${speed}x seed${seed} bt${breakthrough}`, () => {
                        const state = createDefaultSession();
                        state.party = party;
                        for (const id of party) {
                            state.owned.add(id);
                            state.relicProgress[id] = { ...createInitialRelicProgress(), level: breakthrough === 0 ? 20 : 30, breakthrough };
                        }
                        const now = new Date("2026-10-20T00:00:00Z");
                        recordBoundaryResult(state, "enterStage", [{ stageId: "3-10", requestId: "admission" }]);
                        const lease = prepareCombat(state, { input: { mode: "stage" }, stageId: "3-10" }, now, `scene-lease-${seed}`);
                        const { scene, proof } = sceneFight(JSON.parse(JSON.stringify(lease)), speed);
                        const restored = saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
                        const verdict = finishCombat(restored, proof, new Date(now.getTime() + 600000));
                        expect(verdict.victory).toBe(scene.state.phase === "victory");
                    });
                }
});
