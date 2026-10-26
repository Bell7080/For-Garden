import {chromium} from '@playwright/test';
import {writeFileSync,mkdirSync,rmSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
// Run against a local Vite dev server. All progress belongs to a fresh, isolated browser context.
const origin=new URL(process.argv[2]??'http://127.0.0.1:5180');
if(origin.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(origin.hostname)||origin.username||origin.password)throw Error('A local HTTP dev server is required');
const dir=process.argv[3]??'work/ancient-ui';
mkdirSync(dir,{recursive:true});mkdirSync('work',{recursive:true});
const fixture=`work/ancient-ui-${randomUUID()}.html`;
writeFileSync(fixture,`<!doctype html><html lang="ko"><head><meta charset="utf-8"><base href="/"></head><body><div id="app"></div><script type="module">
import Phaser from 'phaser';
const ActualGame=Phaser.Game;
Phaser.Game=class extends ActualGame {constructor(config){super({...config,type:Phaser.CANVAS,fps:{...config.fps,target:30,forceSetTimeOut:true}});window.ancientGame=this;}};
await import('/src/main.ts');
</script></body></html>`);

let browser;
try {
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:540,height:960},locale:'ko-KR'}),errors=[];
 page.setDefaultTimeout(120000);
 // The fixture must not contact account/progress/payment APIs or external services.
 await page.route('**/*',route=>{const url=new URL(route.request().url());return url.hostname===origin.hostname&&!url.pathname.startsWith('/api/')?route.continue():route.abort();});
 page.on('pageerror',e=>errors.push(e.stack??e.message));
 await page.goto(new URL('/'+fixture,origin).href);
 await page.waitForFunction(()=>window.__PF_DEBUG?.ready,null,{polling:500,timeout:90000});
 await page.evaluate(async()=>{
  const url=path=>performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname===path)?.name??path;
  const s=await import(url('/src/state/session.ts')),a=await import(url('/src/api/FakeServer.ts')),t=await import(url('/src/core/tutorial.ts'));
  for(const scene of window.ancientGame.scene.getScenes(true))if(scene.sys.settings.key!=='effect-overlay')window.ancientGame.scene.stop(scene.sys.settings.key);
  const state=s.session;state.tutorial=t.createCompletedTutorialState();state.party=['rex','torika','mette'];
  for(const id of state.party){state.owned.add(id);state.relicProgress[id]={...s.createInitialRelicProgress(),level:60,breakthrough:4,bondLevel:10,bondXp:650};}
  for(let i=1;i<=10;i++)state.cleared.add(`1-${i}`);
  state.wallet.gems=1000;state.settings.accessibility.reduceMotion=true;state.settings.presentation.graphicsQuality='low';state.settings.presentation.frameRateLimit=30;state.settings.presentation.damageNumbers=false;state.settings.presentation.screenShake=false;state.settings.sound.masterMuted=true;state.settings.game.autoUltimate=true;state.settings.game.skipUltimatePresentation=true;state.settings.game.battleSpeed=3;
  a.installGameApi(null);
  window.ancientFixture={state};window.ancientGame.scene.start('ancientStrata');window.ancientScene=window.ancientGame.scene.getScene('ancientStrata');
 });
 await page.waitForTimeout(1500);
 async function select(floor){
  const point=await page.evaluate(async floor=>{const scene=window.ancientScene,index=(floor-1)%10;scene.enemyPreview?.dismiss();scene.showBlock(Math.floor((floor-1)/10));const node=scene.map.list.filter(o=>o.type==='Rectangle'&&o.input)[index];scene.scrollTo(900-node.y);const bounds=node.getBounds();return {x:bounds.centerX,y:bounds.centerY};},floor);
  await page.evaluate(()=>new Promise(resolve=>window.ancientScene.events.once('postupdate',()=>window.ancientScene.events.once('postupdate',resolve))));
  await page.waitForTimeout(250);
  console.log('select',floor,point);
  await page.mouse.click(point.x/2,point.y/2);
  try { await page.waitForFunction(floor=>window.ancientScene.selectedFloor===floor&&window.ancientScene.enemyPreview.alpha>.99,floor,{polling:500,timeout:30000}); } catch(error){console.log(await page.evaluate(()=>({selected:window.ancientScene.selectedFloor,preview:{alpha:window.ancientScene.enemyPreview.alpha,visible:window.ancientScene.enemyPreview.visible},drag:window.ancientScene.dragMoved,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON()})));await page.screenshot({path:`${dir}/selection-failure.png`});throw error;}
  await page.waitForTimeout(1000);
  return page.evaluate(()=>{const s=window.ancientScene;const texts=[];const walk=o=>{if(o.type==='Text'&&o.visible)texts.push(o.text);if(o.list)o.list.forEach(walk)};s.children.list.forEach(walk);return{floor:s.selectedFloor,enemyCount:window.__PF_DEBUG?.enemyPreview?.enemyTargets.length,texts};});
 }
 const previews=[];
 for(const floor of [1,2,3,5,7,10,121]){
  const p=await select(floor);if(p.floor!==floor||!p.texts.some(t=>t.includes('시련'))||!p.texts.includes('100'))throw Error('Missing trial/reward '+floor+JSON.stringify(p));
  const expectedEnemies={1:3,2:5,3:1,5:2,7:3,10:1,121:3};
  if(p.enemyCount!==expectedEnemies[floor])throw Error('Incorrect visible enemy count '+floor);
  if(floor===10&&!p.texts.some(t=>t.includes('적 체력 −12%')))throw Error('Missing deadline HP tradeoff');
  if(floor===121&&!p.texts.includes('먼저 B120 클리어'))throw Error('Missing sequential unlock restriction');
  previews.push(p);if([1,2,5,121].includes(floor))await page.screenshot({path:`${dir}/floor-${floor}.png`});
 }
 if(previews.length)writeFileSync(`${dir}/previews.json`,JSON.stringify(previews,null,2)+'\n');
 await select(1);
 await page.mouse.click(270,865);
 await page.waitForFunction(()=>window.__PF_DEBUG?.scene==='party',null,{polling:500,timeout:30000});await page.waitForTimeout(1000);
 await page.screenshot({path:`${dir}/party.png`,timeout:120000});
 const point=await page.evaluate(()=>{const b=window.ancientGame.scene.getScene('party').startButton.getBounds();return{x:b.centerX,y:b.centerY};});
 await page.mouse.click(point.x/2,point.y/2);
 await page.waitForFunction(()=>window.__PF_DEBUG?.scene==='battle',null,{polling:500,timeout:30000});
 await page.screenshot({path:`${dir}/battle.png`,timeout:120000});
 try { await page.waitForFunction(()=>window.ancientFixture.state.cleared.has('ancient:1'),null,{polling:500,timeout:300000}); } catch(e){console.log('flow failure',await page.evaluate(()=>{const b=window.ancientGame.scene.getScene('battle');return {scene:window.__PF_DEBUG?.scene,elapsed:b.state?.elapsed,phase:b.state?.phase,spawned:b.spawned,finished:b.finished,paused:b.simulationPaused?.(),fightStartsAt:b.fightStartsAt,now:performance.now(),auto:b.autoUltimate,settings:window.ancientFixture.state.settings,party:b.state?.fighters.map(f=>({id:f.id,hp:f.hp,energy:f.energy})),wallet:window.ancientFixture.state.wallet,cleared:[...window.ancientFixture.state.cleared],active:window.ancientGame.scene.getScenes(true).map(s=>s.sys.settings.key)}}));console.log(errors);await page.screenshot({path:`${dir}/flow-failure.png`});throw e;}
 await page.waitForTimeout(1500);
 const result=await page.evaluate(()=>({gems:window.ancientFixture.state.wallet.gems,cleared:window.ancientFixture.state.cleared.has('ancient:1'),selected:window.ancientFixture.state.selectedStageId,phase:window.__PF_DEBUG?.battle?.phase}));
 if(result.gems!==1100)throw Error('Incorrect reward '+JSON.stringify(result));
 await page.screenshot({path:`${dir}/first-clear.png`,timeout:120000});
 const next=await page.evaluate(()=>{let node;const walk=o=>{if(o.type==='Text'&&o.text==='다음 단계'&&o.visible)node=o;if(o.list)o.list.forEach(walk)};window.ancientGame.scene.getScene('battle').children.list.forEach(walk);if(!node)return null;const b=node.getBounds();return{x:b.centerX,y:b.centerY};});
 if(!next)throw Error('Missing next-floor action');await page.mouse.click(next.x/2,next.y/2);
 await page.waitForFunction(()=>window.__PF_DEBUG?.scene==='party'&&window.ancientFixture.state.selectedStageId==='ancient:2',null,{polling:500,timeout:30000});
 const report={renderer:'Canvas at 30fps target; local dev fixture',previews,result,nextFloorOpened:true,errors,scope:'Isolated local QA fixture; actual UI/FakeServer flow. External requests and /api/* are blocked. Strict server authority and replay protection tested separately.'};
 writeFileSync(`${dir}/browser.json`,JSON.stringify(report,null,2)+'\n');
 if(errors.length)throw Error(errors.join('\n'));console.log(JSON.stringify({result,nextFloorOpened:true,errors}));
}finally{await browser?.close();rmSync(fixture,{force:true})}
