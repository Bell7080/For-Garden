import { expect, test } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { expeditionWeekKey } from '../../src/core/expeditionBoss';
import { sourceScene } from './sourceScene';

test('디안 없는 치즈케이크 원격 전투·결과 저장·복귀와 설정 계정 오류 후 입력 복구',async({page})=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','소스 서버 전용');test.setTimeout(450000);
 const dir=await mkdtemp(join(tmpdir(),'fg-cake-loop-'));const errors:string[]=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')console.log(m.text());});
 try{
  const file=join(dir,'fixture.mjs');await build({entryPoints:['tests/helpers/remoteBattleFixture.ts'],outfile:file,bundle:true,platform:'node',format:'esm',define:{'import.meta.env':'{}','import.meta.env.MODE':'"production"','import.meta.env.DEV':'false','import.meta.env.PROD':'true'}});
  const fixture=(await import(pathToFileURL(file).href)).createFixture('stage',(state:any)=>{
   state.expedition.weekKey=expeditionWeekKey(new Date());state.expedition.bestScore=28000;
   state.party=['dodo','maddy','stella'];
   for(const id of state.party){state.owned.add(id);state.relicProgress[id]={...state.relicProgress.rex,heartGemSlots:[...state.relicProgress.rex.heartGemSlots]};}
  });
  fixture.loseNextReply('completeCakeOperation');
  await page.exposeFunction('__CAKE_CALL',fixture.call);await installGameHandleProbe(page);await startAfterOpening(page);
  await page.evaluate(async()=>{
   const root='/src/';const [api,remote,state,saves,progress]=await Promise.all([import(/* @vite-ignore */root+'api/FakeServer.ts'),import(/* @vite-ignore */root+'api/RemoteGameApi.ts'),import(/* @vite-ignore */root+'state/session.ts'),import(/* @vite-ignore */root+'state/SaveManager.ts'),import(/* @vite-ignore */root+'api/serverProgress.ts')]);
   const r=remote.createRemoteGameApi({getAccessToken:async()=> 'isolated',applyState:(next:unknown)=>progress.applyServerState(state.session,next,saves.saveManager),fetchImpl:async(_u:unknown,init:RequestInit)=>{const result=await (window as any).__CAKE_CALL(JSON.parse(String(init.body)));return new Response(JSON.stringify(result.body),{status:result.status});}});api.installGameApi(r);await r.getPlayerState();await r.enterCakeOperation({tierId:'cake-1',requestId:'cake-browser-admission'});
  });
  await sourceScene(page,"this.game.scene.stop('title');this.game.scene.start('battle',{mode:'cake',tierId:'cake-1',requestId:'cake-browser-admission'});window.__CAKE_GAME=this.game;");
  await expect.poll(()=>page.evaluate(()=>(window as any).__CAKE_GAME.scene.getScene('battle').spawned),{timeout:90000}).toBe(true);
  console.log('cake-browser-state',await page.evaluate(()=>{const b=(window as any).__CAKE_GAME.scene.getScene('battle');return {active:b.scene.isActive(),phase:b.state?.phase,elapsed:b.state?.elapsed,popups:window.__PF_DEBUG?.popupTitles,scene:window.__PF_DEBUG?.scene};}));
  // 소프트웨어 GPU의 그리기 지연만 제외한다. Phaser 시계·씬 update·실제 wall time은 그대로 흐른다.
  await page.evaluate(()=>{const game=(window as any).__CAKE_GAME;game.__RENDER_CALLBACK=game.loop.callback;game.loop.callback=game.headlessStep.bind(game);});
  await expect.poll(()=>fixture.calls.some((x:any)=>x.method==='completeCakeOperation'&&x.status===200),{timeout:150000}).toBe(true);
  await page.evaluate(()=>{const game=(window as any).__CAKE_GAME;game.loop.callback=game.__RENDER_CALLBACK;});
  await expect.poll(()=>page.evaluate(()=>Boolean((window as any).__CAKE_GAME.scene.getScene('battle').resultFailureUi?.active))).toBe(false);
  expect(fixture.calls.filter((x:any)=>x.method==='completeCakeOperation').map((x:any)=>x.status)).toEqual([504,200]);
  await sourceScene(page,"this.game.scene.stop('battle');this.game.scene.start('settings');window.__ACCOUNT_SETTINGS=this.game.scene.getScene('settings');");
  await page.evaluate(async()=>{const s=(window as any).__ACCOUNT_SETTINGS;await s.runAccountAction(async()=>{throw Error('network failure');});});
  expect(await page.evaluate(()=>(window as any).__ACCOUNT_SETTINGS.input.enabled)).toBe(true);
  await sourceScene(page,"this.game.scene.getScene('settings').popups.closeAll();this.game.scene.stop('settings');this.game.scene.start('cakeOperation',{tierId:'cake-1'});");
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('cakeOperation');
  await page.evaluate(async()=>{
    const root='/src/';const [module,api]=await Promise.all([import(/* @vite-ignore */root+'ui/ExpeditionRewardPopup.ts'),import(/* @vite-ignore */root+'api/FakeServer.ts')]);
    const scene=(window as any).__CAKE_GAME.scene.getScene('cakeOperation');scene.popups.closeAll();
    const popup=new module.ExpeditionRewardPopup(scene,scene.popups,api.gameApi);(window as any).__BATCH_POPUP=popup;
    await popup.open();await (popup as any).claim();
  });
  expect(fixture.calls.filter((x:any)=>x.method==='claimExpeditionReward'&&x.status===200)).toHaveLength(1);
  expect(fixture.state().expedition.claimedRewardStageIds).toHaveLength(10);
  expect(fixture.state().cakeOperation.clearedIndex).toBeGreaterThanOrEqual(0);expect(errors).toEqual([]);
 } finally{console.log('cake-browser-final',await page.evaluate(()=>{const g=(window as any).__CAKE_GAME;if(!g)return {};const b=g.scene.getScene('battle');return {active:b.scene.isActive(),spawned:b.spawned,phase:b.state?.phase,elapsed:b.state?.elapsed,ticks:b.combatTicks,debug:window.__PF_DEBUG?.scene,popups:window.__PF_DEBUG?.popupTitles,failed:!!b.resultFailureUi?.active};}).catch(()=>null));await rm(dir,{recursive:true,force:true});}
});
