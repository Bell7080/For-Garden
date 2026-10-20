import { expect, test, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { sourceScene } from './sourceScene';
import { captureGame, tap } from './canvasInput';

async function clickButton(page: Page, label: string) {
  const locate = () => page.evaluate(label => {
    const found: {x:number;y:number}[] = [];
    const walk = (v:any) => {
      if (v.active === false || v.visible === false) return;
      if(v.type==='Text' && v.text===label && v.parentContainer?.parentContainer?.labelText===v && v.parentContainer.parentContainer.bg?.input?.enabled) {
        const b=v.getBounds();found.push({x:b.centerX,y:b.centerY});
      }
      for(const child of v.list??[])walk(child);
    };
    walk({list:(window as any).__BOSS_SCENE.children.list});return found.at(-1);
  },label);
  await expect.poll(locate).toBeTruthy();const point=(await locate())!;await tap(page,point.x,point.y);
}
for (const mode of ['raid','expedition'] as const) test(`${mode}: 실제 일시정지·퇴장 → 저장 실패 → 다시 시도 → 점수와 보상 확정`, async({page},info)=>{
  test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','격리 소스 서버 전용');test.setTimeout(240000);
  const dir=await mkdtemp(join(tmpdir(),'fg-boss-exit-')),errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  try {
    const file=join(dir,'fixture.mjs');
    await build({entryPoints:['tests/helpers/remoteBattleFixture.ts'],outfile:file,bundle:true,platform:'node',format:'esm',define:{'import.meta.env':'{}','import.meta.env.MODE':'"production"','import.meta.env.DEV':'false','import.meta.env.PROD':'true'}});
    const fixture=(await import(pathToFileURL(file).href)).createFixture(mode) as ReturnType<typeof import('../helpers/remoteBattleFixture').createFixture>;
    await page.exposeFunction('__PF_REMOTE_CALL',fixture.call);
    await installGameHandleProbe(page);await startAfterOpening(page);
    await page.evaluate(async mode=>{
      const root='/src/';
      const [{installGameApi},{createRemoteGameApi},{session},{saveManager},{applyServerState}]=await Promise.all([
        import(/* @vite-ignore */root+'api/FakeServer.ts'),import(/* @vite-ignore */root+'api/RemoteGameApi.ts'),import(/* @vite-ignore */root+'state/session.ts'),import(/* @vite-ignore */root+'state/SaveManager.ts'),import(/* @vite-ignore */root+'api/serverProgress.ts')]);
      const api=createRemoteGameApi({getAccessToken:async()=> 'isolated-browser-token',applyState:(next:any)=>applyServerState(session,next,saveManager),fetchImpl:async(_url:any,init:any)=>{
        const response=await(window as any).__PF_REMOTE_CALL(JSON.parse(String(init.body)));return new Response(JSON.stringify(response.body),{status:response.status});
      }});installGameApi(api);await api.getPlayerState();
      if(mode==='raid'){
        const raid=(await api.getRaids()).raids.find((r:any)=>r.kind==='world'&&r.status==='active');
        const admission=await api.enterRaid({raidId:raid.id,requestId:'browser-exit-entry',replayVersion:2});
        (window as any).__BOSS_INPUT={mode:'raid',raidId:raid.id,bossRelicId:raid.bossRelicId,difficulty:raid.difficulty,requestId:admission.requestId,seasonHp:admission.raid.remainingHp,relics:admission.relics,replaySeed:admission.replaySeed,replayVersion:2};
      }else{
        const run=session.expedition.run,node=run.nodes.find((n:any)=>n.type==='boss'),ids=(await api.prepareExpeditionBoss({nodeId:node.id})).ids;
        (window as any).__BOSS_INPUT={mode:'expeditionBoss',runId:run.runId,nodeId:node.id,floor:20,relics:run.relics,augments:run.selectedAugments,...ids};
      }
    },mode);
    fixture.failNext(mode==='raid'?'submitRaidDamage':'settleExpeditionRun');
    await sourceScene(page,`this.game.scene.stop('title');this.game.scene.start('battle',window.__BOSS_INPUT);window.__BOSS_SCENE=this.game.scene.getScene('battle');`);
    await expect.poll(()=>page.evaluate(()=>{const b=window.__PF_DEBUG?.battle;return !!b&&b.elapsed>=5&&!b.ultimateSequenceActive;}),{timeout:90000}).toBe(true);
    await tap(page,1020,62);await clickButton(page,'나가기');
    await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles??[])).toContain('나가기');
    await clickButton(page,'나가기');
    const retryLabel=await page.evaluate(async()=>{const root='/src/';const{t}=await import(/* @vite-ignore */root+'i18n/index.ts');return t('battle.settle.retry');});
    await clickButton(page,retryLabel);
    await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.bossResult?.visible),{timeout:45000}).toBe(true);
    const shown=await page.evaluate(()=>({damage:Math.round((window as any).__BOSS_SCENE.state.boss.score),elapsed:Math.round((window as any).__BOSS_SCENE.state.elapsed*1000)}));
    expect(shown.elapsed).toBeLessThan(30000);expect(shown.damage).toBeGreaterThan(0);
    const state=fixture.state();
    if(mode==='raid')expect(state.raid.instances.find(r=>r.myDamage>0)?.myDamage).toBe(shown.damage);
    else{
      const {expeditionBossDamageScore}=await import('../../src/core/expeditionScore');
      expect(state.expedition.bestScore).toBe(25000+expeditionBossDamageScore(shown.damage));expect(state.expedition.run).toBeNull();
      expect(fixture.calls.filter(c=>c.method==='submitExpeditionBossScore'&&c.status===200)).toHaveLength(1);
    }
    expect(fixture.calls.filter(c=>c.status===503)).toHaveLength(1);
    expect(fixture.calls.filter(c=>c.status!==200&&c.status!==503)).toEqual([]);expect(errors).toEqual([]);
    // 원정 전용 최종판의 보조 조작까지 생성된 뒤 캡처하고 실제 로비 복귀를 누른다.
    if(mode==='expedition') await expect.poll(()=>page.evaluate(()=>{
      const scene=(window as any).__BOSS_SCENE;
      return scene.children.list.some((v:any)=>v.labelText?.text==='로비로'&&v.bg?.input?.enabled);
    })).toBe(true);
    await captureGame(page,info.outputPath(`${mode}-partial-confirmed.png`));
    if(mode==='expedition'){
      await clickButton(page,'로비로');
      await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene),{timeout:45000}).toBe('lobby');
      expect(fixture.state().expedition.run).toBeNull();
    }
    await info.attach('proof',{body:JSON.stringify({mode,shown,calls:fixture.calls,wallet:state.wallet,best:state.expedition.bestScore,raids:state.raid.instances},null,2),contentType:'application/json'});
  }finally{await rm(dir,{recursive:true,force:true});}
});
