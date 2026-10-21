import { createInitialRelicProgress } from "../../src/state/session";
import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame } from "./canvasInput";

test("치즈케이크 15명과 디안 소환수: 실제 로딩·사망 정지·안내 중 재소환 크기", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", e => errors.push(e.message));
  await installGameHandleProbe(page);
  await startAfterOpening(page, s => {
    s.party = ["dian", "torika", "mette"];
    for (const id of s.party) { s.owned.add(id); s.relicProgress[id] = { ...createInitialRelicProgress(), level: 60, breakthrough: 4 }; }
    s.settings.game.autoUltimate = true;
    s.settings.game.battleSpeed = 2;
    s.settings.game.skipUltimatePresentation = true;
  });
  await page.evaluate(async()=>{
    const root='/src/';const {IndexedPuppetCreature}=await import(/* @vite-ignore */root+'puppets/IndexedPuppetCreature.ts');
    const metric={started:performance.now(),animatedBeforeReady:0};(window as any).__SWARM_STARTUP=metric;
    const prototype=IndexedPuppetCreature.prototype as any,step=prototype.step;
    prototype.step=function(time:number,delta:number){
      if(this.scene?.scene?.key==='battle'&&!this.scene.spawned&&this.visible&&!this.animationFrozen)metric.animatedBeforeReady++;
      return step.call(this,time,delta);
    };
  });
  await sourceScene(page, `this.game.scene.stop('title');this.game.scene.start('battle',{mode:'cake',tierId:'cake-8'});window.__SWARM=this.game.scene.getScene('battle');`);
  await expect.poll(() => page.evaluate(() => (window as any).__SWARM.spawned), { timeout: 120000 }).toBe(true);
  const metrics = await page.evaluate(() => {
    const scene = (window as any).__SWARM;
    const enemies = [...scene.views.values()].filter((v: any) => v.fighter.side === "enemy");
    const wolf = [...scene.views.values()].find((v: any) => v.fighter.summonOwnerId);
    if (!wolf) throw new Error("디안 소환수 없음");
    const before = wolf.creature.scaleX;
    // 안내창으로 코어가 멈춰 syncViews가 다시 호출되지 않는 상황을 재현한다.
    scene.reviveView(wolf.fighter.id);
    const after = wolf.creature.scaleX;
    scene.playDeath(wolf.fighter.id);
    const frozen = wolf.creature.animationFrozen;
    const poseVersion = wolf.creature.poseVersion;
    wolf.creature.step(0, 16);
    const updatesAfterDeath = wolf.creature.poseVersion - poseVersion;
    scene.reviveView(wolf.fighter.id);
    const startup=(window as any).__SWARM_STARTUP;
    return { enemies: enemies.length, creatures: scene.views.size, before, after, frozen, updatesAfterDeath, revivedFrozen: wolf.creature.animationFrozen,
      startup:{...scene.fighterCreationStats,animatedBeforeReady:startup.animatedBeforeReady,elapsedMs:Math.round(performance.now()-startup.started)} };
  });
  expect(metrics.enemies).toBe(15);
  expect(metrics.after).toBeCloseTo(metrics.before, 5);
  expect(metrics.frozen).toBe(true);
  expect(metrics.updatesAfterDeath).toBe(0);
  expect(metrics.revivedFrozen).toBe(false);
  expect(metrics.startup.completed).toBe(metrics.creatures);
  expect(metrics.startup.animatedBeforeReady).toBe(0);
  console.log('swarm-startup',JSON.stringify(metrics.startup));
  const budget = await page.evaluate(() => {
    const scene=(window as any).__SWARM;
    // 실제 표시 객체의 정지 HP/폭주 예산을 잰다. 전투 계산을 프레임 절약으로 건너뛰지 않는다.
    const enemies=[...scene.views.values()].filter((v:any)=>v.fighter.side==='enemy'&&!v.dead) as any[];
    let repaints=0;
    for(const view of enemies){
      view.hpBar.snap(1);
      const graph=view.hpBar.graph,clear=graph.clear;
      graph.clear=function(){repaints++;return clear.call(this);};
      for(let frame=0;frame<120;frame++)view.hpBar.step(16);
      graph.clear=clear;
    }
    scene.simulationPaused=()=>true;
    for(const view of scene.views.values())if(!view.dead){view.fighter.ferocityFever=true;view.feverTinted=true;view.feverAt=scene.time.now-500;}
    scene.syncViews();
    return {enemies:enemies.length,staticHpRepaints:repaints,outlineCopies:enemies.map(view=>view.creature.afterimages.length)};
  });
  expect(budget.enemies).toBe(15);expect(budget.staticHpRepaints).toBe(0);
  expect(budget.outlineCopies.every(count=>count===12)).toBe(true);
  await captureGame(page, info.outputPath("cake-8-with-dian.png"));
  await info.attach("swarm-metrics", { body: JSON.stringify({ ...metrics, budget, errors }, null, 2), contentType: "application/json" });
  console.log('swarm-budget',JSON.stringify(budget));
  expect(errors).toEqual([]);
});
