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
import { combatJournal } from "../../src/server/combatAuthority";
import { duelCombatSetup } from "../../src/server/playerDuels";
import { normalizeDuelState } from "../../src/core/duelState";
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
    for (const automatic of [true,false]) for (const speed of [1,2,3]) for (const seed of [1,7,42]) {
        it(`PvP 양쪽 코어 자동 궁극기 지원=${automatic} ${speed}x seed${seed}`,()=>{
            const state=createDefaultSession(),defender=createDefaultSession();
            state.party=['rex','mette','stella'];
            for(const session of [state,defender]) for(const id of state.party){session.owned.add(id);session.relicProgress[id]={...createInitialRelicProgress(),level:30,breakthrough:2};}
            defender.duel=normalizeDuelState(undefined,[...defender.owned]);defender.duel.defense=[...state.party];
            const requestId='duel-regression',setup=duelCombatSetup(state,defender,state.party);
            combatJournal(state).tickets[`duel:${requestId}`]={kind:'duel',target:'defender',requestId,duel:{opponent:{} as never,setup}};
            const now=new Date('2026-10-22T00:00:00Z');
            const lease=prepareCombat(state,{...(automatic?{automaticUltimates:true as const}:{}),input:{mode:'duel',requestId,attack:state.party,opponentName:'defender',opponentScore:0,units:[]}},now,`duel-${seed}`);
            const {scene,proof}=sceneFight(JSON.parse(JSON.stringify(lease)),speed);
            expect(scene.state.automaticUltimates).toBe(automatic?true:undefined);
            if(automatic)expect(proof.actions).toEqual([]);
            const restored=saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
            if(automatic)expect(()=>finishCombat(structuredClone(restored),{...proof,actions:[{tick:0,actorId:scene.state.fighters[0].id}]},new Date(now.getTime()+600000))).toThrow('COMBAT_REJECTED');
            expect(finishCombat(restored,proof,new Date(now.getTime()+600000)).victory).toBe(scene.state.phase==='victory');
        });
    }
    for (const party of [["dodo", "maddy", "stella"], ["ella", "maki", "stella"], ["rex", "mette", "torika"]])
        for (const tier of [1, 2, 3, 4, 5, 6, 7, 8])
            for (const speed of [1, 2, 3]) {
                it(`cake-${tier} ${party.join("/")} ${speed}x`, () => {
                    for (const seed of [1, 7, 42]) {
                        const state = createDefaultSession();
                        state.party = party;
                        for (const id of party) {
                            state.owned.add(id);
                            state.relicProgress[id] = { ...createInitialRelicProgress(), level: Math.min(60, tier * 8), breakthrough: Math.min(4, Math.floor(tier / 2)) };
                        }
                        const now = new Date("2026-10-21T00:00:00Z");
                        const input = { tierId: `cake-${tier}`, requestId: "cake-admission" };
                        recordBoundaryResult(state, "enterCakeOperation", [input]);
                        const lease = prepareCombat(state, { input: { mode: "cake", ...input }, stageId: "1-1" }, now, `cake-${seed}`);
                        const { scene, proof } = sceneFight(JSON.parse(JSON.stringify(lease)), speed);
                        const restored = saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
                        const verdict = finishCombat(restored, proof, new Date(now.getTime() + 600000));
                        expect(verdict.victory).toBe(scene.state.phase === "victory");
                    }
                });
            }
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
