import { describe, expect, it } from "vitest";
import { sourceClass } from "../helpers/sourceClass";
import * as skirmish from "../../src/core/skirmish";
import * as ultimate from "../../src/core/ultimateSequence";
import * as arenaView from "../../src/core/arenaView";
import * as controls from "../../src/core/battleControls";
import { createDefaultSession, createInitialRelicProgress } from "../../src/state/session";
import { prepareCombat, finishCombat } from "../../src/server/combatAuthority";
import { recordBoundaryResult } from "../../src/server/releaseBoundary";
import { combatState } from "../../src/core/combatProtocol";
import { bossBattleRandom } from "../../src/core/bossSimulation";
import { saveManager } from "../../src/state/SaveManager";

let clock = 0, frame = 0;
const timers: { at: number; fn: () => void }[] = [];
const later = (frames: number, fn: () => void) => timers.push({ at: frame + frames, fn });
const noop = () => undefined;
const Battle = sourceClass("src/scenes/BattleScene.ts", "BattleScene", {
  Phaser: { Scene: class {} }, ...skirmish, ...ultimate, ...arenaView,
  performance: { now: () => clock }, audioManager: undefined, BOSS_STEP_MS: 20, formatBattleClock: () => "", hasMergedBattleHit: () => false,
  ultimatePresentationFor: () => ({ zoomScale: 1.2, zoomMs: 200, cameraShakeIntensity: 0 }), ultimatePresentationTiming: () => ({ rate: 1 }),
  shouldWaitForUltimatePresentation: controls.shouldWaitForUltimatePresentation, scaleUltimateDuration: () => 100, ULTIMATE_RECOVERY_RATIO: 0.5,
  settingsManager: { get: () => ({ presentation: { graphicsQuality: "high" }, accessibility: { reduceFlashes: false } }), haptic: noop },
  UltimateCutIn: { create: () => new Promise((r) => later(3, () => r({ play: () => new Promise((p) => later(20, () => p(undefined))), destroy: noop }))) },
});
function makeScene(skip: boolean) {
  const scene = Object.assign(Object.create(Battle.prototype), {
    scene: { isActive: () => true }, views: new Map(), bossActions: [],
    tweens: { killTweensOf: noop, add: (cfg: any) => later(6, () => cfg.onComplete?.()) },
    stepMeters: noop, refreshContribution: noop, syncCombatEffects: noop, syncGroundSurfaces: noop, refreshProfiles: noop,
    refreshDebug: noop, syncViews: noop, paintDeathClock: noop, simulationPaused: () => false, pressProfileCard: noop,
    ultimatePresentationSkipped: () => skip, motion: { cameraShakeFactor: 0 }, cameras: { main: { shake: noop } }, contributionPanel: undefined,
    playEvent(this: { finished: boolean }, event: skirmish.SkirmishEvent) { if (event.kind === "finish") this.finished = true; return event.kind === "attack" ? { completed: new Promise((r) => later(8, () => r(undefined))) } : undefined; },
  });
  return scene;
}
function begin(scene: any, lease: any, speed: number) {
  Object.assign(scene, { state: combatState(lease), combatLease: lease, combatTicks: 0, combatActions: [], battleInput: { mode: "cake" },
    spawned: true, finished: false, lastStepAt: clock, fightStartsAt: 0, battleSpeed: speed, bossStepRemainder: 0, rng: bossBattleRandom(lease.seed),
    autoUltimate: true, ultimateSequence: Object.assign(ultimate.createUltimateSequenceState(), { nextToken: (scene.ultimateSequence?.nextToken ?? 0) + 1 }), ultimateSequenceActive: false, currentUltimateFighterId: null });
  scene.views.clear();
  for (const fighter of scene.state.fighters) scene.views.set(fighter.id, { fighter, creature: { scaleX: 1 }, hpBar: { setValue: noop, setShield: noop } });
}
async function runFrames(scene: any, until: () => boolean) {
  let n = 0;
  while (!until() && n++ < 40000) {
    frame++; clock += frame % 13 === 0 ? 200 : 17;
    for (const t of timers.splice(0).filter((t) => { if (t.at <= frame) return true; timers.push(t); return false; })) t.fn();
    for (let k = 0; k < 5; k++) await Promise.resolve();
    scene.update();
  }
}
function lease(party: string[], tier: number, seed: string, lv: number[], bt: number[]) {
  const state = createDefaultSession(); state.party = party;
  party.forEach((id, k) => { state.owned.add(id); state.relicProgress[id] = { ...createInitialRelicProgress(), level: lv[k], breakthrough: bt[k] }; });
  const now = new Date("2026-10-21T00:00:00Z");
  const input = { tierId: `cake-${tier}`, requestId: "cake-admission-" + seed };
  recordBoundaryResult(state, "enterCakeOperation", [input]);
  const l = prepareCombat(state, { input: { mode: "cake", ...input }, stageId: "1-1" }, now, seed);
  return { state, now, l: JSON.parse(JSON.stringify(l)) };
}
function verify(x: ReturnType<typeof lease>, scene: any): string {
  const restored = saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(x.state))));
  try { const v = finishCombat(restored, { id: x.l.id, ticks: scene.combatTicks, actions: scene.combatActions }, new Date(x.now.getTime() + 600000)); return v.victory === (scene.state.phase === "victory") ? "ok" : "mismatch"; }
  catch { return "reject"; }
}
/*
 * 자동 전투(반복 출격)는 같은 씬이 판을 끝내자마자 다음 판을 세운다. 궁극기 연출·컷인·공격 동작이 비동기로
 * 기다리는 동안 다음 판이 서므로, 실제 화면 흐름(타이머·마이크로태스크)을 그대로 돌려 두 판 모두 서버 재현이
 * 받아들이는지 본다. 범위 안에 적이 없을 때 헛도는 광역 궁극기(토리카)와 첫 신고 편성(메테·루카·모르페)을 둔다.
 */
describe("자동 전투 연속 판의 서버 재현", () => {
    for (const party of [["mette", "luka", "morphe"], ["torika", "stella", "teku"], ["meron", "pachi", "terisa"]])
        for (const skip of [false, true])
            it(`${party.join("/")} 연출 ${skip ? "끔" : "켬"} — 두 판 모두 통과`, async () => {
                const scene = makeScene(skip); timers.length = 0;
                for (const run of ["a", "b"]) {
                    const x = lease(party, 2, run + party[0], [40, 50, 30], [2, 3, 2]);
                    begin(scene, x.l, 2);
                    await runFrames(scene, () => scene.finished);
                    expect(scene.finished).toBe(true);
                    expect(verify(x, scene)).toBe("ok");
                }
            }, 60000);
});
