import {test,expect} from '@playwright/test';
import {createRuneInstance,type RuneStatKey} from '../../src/core/runes';
import {RUNE_CRAFT_PANEL,runeCraftLayout} from '../../src/ui/runeCraftLayout';
import {installGameHandleProbe} from './gameDiagnostics';
import {startAfterOpening} from './openingSave';
import {tap,canvasBox,gamePoint,captureGame} from './canvasInput';
import {sourceScene} from './sourceScene';
test('세공 응답 도중 누른 버튼은 살아 있고, 닫은 창의 대기 연타는 소비되지 않는다',async({page},info)=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','소스 서버 전용');test.setTimeout(180000);
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
 await installGameHandleProbe(page);await startAfterOpening(page,s=>{const values=Object.fromEntries(['hp','atk','ap','def','res','moveSpeed','attackSpeed','lifeSteal','critChance','critDamage','ferocityGain','energyGain'].map(k=>[k,1])) as Record<RuneStatKey,number>;s.runeInventory=[createRuneInstance({instanceId:'e2e-rapid',baseName:'연타 검사',rarity:'uncommon',part:0,statValues:values,random:()=>0})];s.wallet.gold=100000;});
 await page.evaluate(async()=>{const root='/src/';const [r,p,s,a]=await Promise.all([import(/* @vite-ignore */root+'ui/RunePopup.ts'),import(/* @vite-ignore */root+'ui/PopupLayer.ts'),import(/* @vite-ignore */root+'state/session.ts'),import(/* @vite-ignore */root+'api/FakeServer.ts')]);const w=window as any;w.__CRAFT={calls:0};const api=new a.FakeServer(s.session,{latencyMs:0});w.__OPEN_CRAFT=(scene:any)=>{w.__CRAFT.scene=scene;w.__CRAFT.popups=new p.PopupLayer(scene,3500);r.openRunePopup(scene,w.__CRAFT.popups,{runeInstanceId:'e2e-rapid',api:{enhanceRune:async(q:unknown)=>{w.__CRAFT.calls++;await new Promise(resolve=>w.__CRAFT.resolve=resolve);return api.enhanceRune(q);}}});};});
 await sourceScene(page,"window.__OPEN_CRAFT(this.game.scene.getScene('title'));");
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles)).toContain('룬 세공');
 const layout=runeCraftLayout({mainCount:2,subCount:0}),top=RUNE_CRAFT_PANEL.centerY-layout.height/2;
 await tap(page,270,top+RUNE_CRAFT_PANEL.firstMainY);await tap(page,540,top+layout.buttonY);
 await expect.poll(()=>page.evaluate(()=>(window as any).__CRAFT.calls)).toBe(1);
 // 첫 응답이 돌아오는 동안 같은 버튼을 누른 채 유지한다.
 const point=gamePoint(await canvasBox(page),540,top+layout.buttonY);await page.mouse.move(point.x,point.y);await page.mouse.down();
 await page.evaluate(()=>{const w=window as any;const found:any[]=[];const walk=(v:any)=>{if(v.constructor.name==='Button'&&v.labelText?.text==='세공')found.push(v);for(const c of v.list??[])walk(c);};walk({list:w.__CRAFT.scene.children.list});w.__CRAFT.button=found.at(-1);w.__CRAFT.resolve();});
 await expect.poll(()=>page.evaluate(async()=>{const root='/src/';const m=await import(/* @vite-ignore */root+'state/session.ts');return Object.values(m.session.runeInventory[0].enhancementHistory).flat().length;})).toBe(1);
 expect(await page.evaluate(()=>(window as any).__CRAFT.button.active)).toBe(true);
 await page.mouse.up();await expect.poll(()=>page.evaluate(()=>(window as any).__CRAFT.calls)).toBe(2);
 await tap(page,540,top+layout.buttonY); // 3번째는 대기열
 await page.evaluate(()=>(window as any).__CRAFT.popups.closeTop());
 await page.evaluate(()=>(window as any).__CRAFT.resolve());
 await expect.poll(()=>page.evaluate(async()=>{const root='/src/';const m=await import(/* @vite-ignore */root+'state/session.ts');return Object.values(m.session.runeInventory[0].enhancementHistory).flat().length;})).toBe(2);
 await page.waitForTimeout(500);expect(await page.evaluate(()=>(window as any).__CRAFT.calls)).toBe(2);expect(errors).toEqual([]);
 await captureGame(page,info.outputPath('rune-rapid-close.png'));
});
