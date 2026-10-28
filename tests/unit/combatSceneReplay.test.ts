import { describe, expect, it } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import * as skirmish from "../../src/core/skirmish";
import * as ultimate from "../../src/core/ultimateSequence";
import * as arenaView from "../../src/core/arenaView";
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
        } }, ...skirmish, ...ultimate, ...arenaView,
    performance: { now: () => clock }, audioManager: undefined, BOSS_STEP_MS: 20, formatBattleClock: () => "", hasMergedBattleHit: () => false,
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
    // 메론의 궁극기는 덧칠된 적이 없으면 칠 대상이 없다 — 자동 궁극기가 그 헛방을 매 틱 쏘던 때는
    // 기록에 없는 시전이 표적·행동 번호를 바꿔 자동 전투 첫 판이 COMBAT_REJECTED로 끝났다.
    it("덧칠이 없을 때 메론의 궁극기는 나가지 않고 판도 건드리지 않는다", () => {
        const party = ["meron", "nodonia", "parua"];
        const state = createDefaultSession();
        state.party = party;
        for (const id of party) {
            state.owned.add(id);
            state.relicProgress[id] = { ...createInitialRelicProgress(), level: 32, breakthrough: 2 };
        }
        const now = new Date("2026-10-21T00:00:00Z");
        const input = { tierId: "cake-4", requestId: "cake-admission" };
        recordBoundaryResult(state, "enterCakeOperation", [input]);
        const lease = prepareCombat(state, { input: { mode: "cake", ...input }, stageId: "1-1" }, now, "cake-1");
        const fresh = combatState(JSON.parse(JSON.stringify(lease)));
        const meron = fresh.fighters.find((f) => f.def.id === "meron")!;
        meron.energy = 999;
        expect(skirmish.canFireUltimate(fresh, meron)).toBe(false);
        const before = { serial: meron.augmentActionSerial, target: meron.targetId };
        expect(skirmish.fireUltimate(fresh, meron.id, bossBattleRandom("x"))).toEqual([]);
        expect({ serial: meron.augmentActionSerial, target: meron.targetId }).toEqual(before);
        const { scene, proof } = sceneFight(JSON.parse(JSON.stringify(lease)), 1);
        const restored = saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
        expect(finishCombat(restored, proof, new Date(now.getTime() + 600000)).victory).toBe(scene.state.phase === "victory");
    });
    it("범위 안에 적이 없으면 광역 궁극기는 나가지 않고, 들어오면 나간다", () => {
        const party = ["torika", "stella", "teku"];
        const state = createDefaultSession();
        state.party = party;
        for (const id of party) {
            state.owned.add(id);
            state.relicProgress[id] = { ...createInitialRelicProgress(), level: 40, breakthrough: 2 };
        }
        const now = new Date("2026-10-21T00:00:00Z");
        const input = { tierId: "cake-2", requestId: "cake-admission" };
        recordBoundaryResult(state, "enterCakeOperation", [input]);
        const lease = prepareCombat(state, { input: { mode: "cake", ...input }, stageId: "1-1" }, now, "cake-2");
        const fresh = combatState(JSON.parse(JSON.stringify(lease)));
        const torika = fresh.fighters.find((f) => f.def.id === "torika")!;
        expect(torika.def.ultimate.targeting).toBe("nearbyEnemies");
        torika.energy = 999;
        const enemies = fresh.fighters.filter((f) => f.side !== torika.side);
        for (const enemy of enemies) { enemy.x = fresh.arena.right; enemy.y = fresh.arena.top; }
        torika.x = fresh.arena.left; torika.y = fresh.arena.bottom;
        const before = JSON.stringify({ ...torika, def: undefined });
        expect(skirmish.canFireUltimate(fresh, torika)).toBe(false);
        // 판정은 판을 건드리지 않고, 억지로 쏴도 헛방은 아무것도 남기지 않는다.
        expect(JSON.stringify({ ...torika, def: undefined })).toBe(before);
        expect(skirmish.fireUltimate(fresh, torika.id, bossBattleRandom("x"))).toEqual([]);
        expect(JSON.stringify({ ...torika, def: undefined })).toBe(before);
        enemies[0].x = torika.x + 10; enemies[0].y = torika.y;
        expect(skirmish.canFireUltimate(fresh, torika)).toBe(true);
        expect(skirmish.fireUltimate(fresh, torika.id, bossBattleRandom("x")).length).toBeGreaterThan(0);
    });
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
