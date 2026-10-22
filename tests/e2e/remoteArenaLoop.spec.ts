import { test, expect } from '@playwright/test';
import { installGameHandleProbe } from './gameDiagnostics';
import { startAfterOpening } from './openingSave';
import { tap, captureGame } from './canvasInput';
import { PVP_ACTIVE_MODES } from '../../src/data/pvpModes';
import { pvpMenuLayout, PVP_MENU } from '../../src/ui/pvpLayout';
test('아레나 선택 팝업 SD → 독립 티어 카드 → 매칭 시간·SD → 취소 복귀',async({page},info)=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','Vite test source mode only');test.setTimeout(420000);
 const errors:string[]=[];page.on('pageerror',e=>{errors.push(e.message);console.error('[arena pageerror]',e.stack);});
 const calls:string[]=[];
 await page.route('**/api/game',async route=>{
  const body=route.request().postDataJSON();
  if(!String(body.method).startsWith('arena.')){await route.continue();return;}
  const kind=body.args[0].kind;calls.push(kind);
  await route.fulfill({json:{ok:true,result:{playerId:'browser-arena',score:1320,wins:4,losses:2,room:null,incoming:[],queuedAt:kind==='queue'?new Date(Date.now()-7000).toISOString():null}}});
 });
 await installGameHandleProbe(page);await startAfterOpening(page);console.log('[arena visual] boot ready');
 await page.evaluate(async()=>{const root='/src/';const m=await import(/* @vite-ignore */root+'api/arenaApi.ts');m.installArenaApi(async()=> 'browser-token');});
 console.log('[arena visual] API installed');
 const cdp=await page.context().newCDPSession(page);
 const fn=await cdp.send('Runtime.evaluate',{expression:"window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener"});
 const props=await cdp.send('Runtime.getProperties',{objectId:fn.result.objectId!});const bound=props.internalProperties!.find(p=>p.name==='[[BoundThis]]')!.value!.objectId!;
 await cdp.send('Runtime.callFunctionOn',{objectId:bound,functionDeclaration:"function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('lobby',{menu:'duel'});}"});
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles)).toContain('결투');
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__ARENA_GAME;return g.scene.getScene('lobby').children.list.filter((o:any)=>o.name?.startsWith('arena-mascot-')&&o.visible).length;}),{timeout:90000}).toBeGreaterThanOrEqual(2);
 console.log('[arena visual] popup SD ready');await captureGame(page,info.outputPath('arena-mode-popup.png'));
 const layout=pvpMenuLayout(PVP_ACTIVE_MODES.map(m=>m.id));
 await tap(page,540,960+PVP_MENU.panel.offsetY+layout.centers[1]);
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('arena');
 await expect.poll(()=>page.evaluate(()=>{const g=(window as any).__ARENA_GAME;const text=(n:any):string[]=>[...(typeof n.text==='string'?[n.text]:[]),...(n.list??[]).flatMap(text)];return text(g.scene.getScene('arena').view);})).toContain('골드');
 await captureGame(page,info.outputPath('arena-tier-lobby.png'));
 await tap(page,540,1650);await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('arenaMatch');
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__ARENA_GAME.scene.getScene('arenaMatch');return s.label.text;})).not.toBe('00:00');
 await expect.poll(()=>page.evaluate(()=>{const s=(window as any).__ARENA_GAME.scene.getScene('arenaMatch');return s.children.list.filter((o:any)=>o.name?.startsWith('arena-mascot-')&&o.visible).length;}),{timeout:90000}).toBe(2);
 await captureGame(page,info.outputPath('arena-matching.png'));
 await tap(page,540,1640);await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('arena');
 expect(calls).toContain('cancel');expect(errors).toEqual([]);
 await info.attach('arena-api-calls',{body:JSON.stringify(calls),contentType:'application/json'});
});

test('아레나 1밴 → 교차 자유 배치 → 자동 전투 → 서버 결과 팝업',async({page},info)=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','Vite test source mode only');test.setTimeout(420000);
 const {createDefaultSession,createInitialRelicProgress}=await import('../../src/state/session');
 const {saveManager}=await import('../../src/state/SaveManager');
 const {arenaPlayer}=await import('../../src/server/liveArena');
 const {startArena,applyArenaAction,arenaTurn,settleArena}=await import('../../src/core/liveArena');
 const own=createDefaultSession();own.owned=new Set([...own.owned,'rex','spino','mette','stella']);own.party=['rex','mette','stella'];own.favorite='rex';
 for(const id of own.owned)own.relicProgress[id]={...createInitialRelicProgress(),level:20,breakthrough:1};
 const opponent=createDefaultSession();opponent.owned=new Set(own.owned);opponent.party=[...own.party];opponent.favorite='rex';for(const id of opponent.owned)opponent.relicProgress[id]=createInitialRelicProgress();
 let room:import('../../src/core/liveArena').ArenaRoom|undefined;const calls:string[]=[];const errors:string[]=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 await page.route('**/api/game',async route=>{
  const body=route.request().postDataJSON();if(!String(body.method).startsWith('arena.')){await route.continue();return;}
  const input=body.args[0],kind=input.kind;calls.push(kind);
  if(kind==='action'){
   room=applyArenaAction(room!,'browser-arena',input.action,Date.now());
   if(room.phase==='ban'&&arenaTurn(room)===1)room=applyArenaAction(room,'browser-enemy',{kind:'ban',relicId:'parua'},Date.now());
   if(room.phase==='place'&&arenaTurn(room)===1){const i=room.picks[1].length,id=room.players[1].roster.filter(u=>u.def.id!==room!.bans[0]&&!room!.picks[1].some(p=>p.relicId===u.def.id))[0].def.id;room=applyArenaAction(room,'browser-enemy',{kind:'place',relicId:id,x:[.08,.5,.92][i],y:i===1?.32:0},Date.now());}
  }
  if(kind==='finish')room=settleArena(room!);
  if(room&&kind!=='status')room.version++;
  await route.fulfill({json:{ok:true,result:{playerId:'browser-arena',score:1000,wins:0,losses:0,room,incoming:[]}}});
 });
 await installGameHandleProbe(page);await startAfterOpening(page);
 await page.evaluate(async()=>{const root='/src/';const m=await import(/* @vite-ignore */root+'api/arenaApi.ts');m.installArenaApi(async()=> 'browser-token');});
 room=startArena({id:'browser-live-arena',version:1,ranked:false,rules:{ban:true,order:'first',placement:'alternate'},players:[],phase:'ban',first:0,bans:[null,null],picks:[[],[]],locked:[false,false],deadline:0,seed:'browser-arena-shared-seed'},[arenaPlayer('browser-arena',saveManager.exportData(own)),arenaPlayer('browser-enemy',saveManager.exportData(opponent))],Date.now());
 const cdp=await page.context().newCDPSession(page);const fn=await cdp.send('Runtime.evaluate',{expression:"window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener"});const props=await cdp.send('Runtime.getProperties',{objectId:fn.result.objectId!});const bound=props.internalProperties!.find(p=>p.name==='[[BoundThis]]')!.value!.objectId!;
 await cdp.send('Runtime.callFunctionOn',{objectId:bound,functionDeclaration:"function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('arenaRoom',{roomId:'browser-live-arena'});}"});
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('arenaRoom');
 await expect.poll(()=>page.evaluate(()=>(window as any).__ARENA_GAME.scene.getScene('arenaRoom').status?.room?.phase)).toBe('ban');
 await captureGame(page,info.outputPath('arena-ban.png'));
 await tap(page,230,700);
 await expect.poll(()=>page.evaluate(()=>(window as any).__ARENA_GAME.scene.getScene('arenaRoom').status?.room?.phase)).toBe('place');
 for(let i=0;i<3;i++){
  await tap(page,230,1170);
  await expect.poll(()=>page.evaluate(()=>(window as any).__ARENA_GAME.scene.getScene('arenaRoom').selected)).not.toBe('');
  await tap(page,[235,540,845][i],[970,915,970][i]);
  if(i<2)await expect.poll(()=>page.evaluate(()=>(window as any).__ARENA_GAME.scene.getScene('arenaRoom').status?.room?.picks[0].length)).toBe(i+1);
 }
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('battle');
 await expect.poll(()=>page.evaluate(()=>(window as any).__ARENA_GAME.scene.getScene('battle').spawned),{timeout:90000}).toBe(true);
 await captureGame(page,info.outputPath('arena-automatic-battle.png'));
 await page.evaluate(()=>{const g=(window as any).__ARENA_GAME;g.__RENDER_CALLBACK=g.loop.callback;g.loop.callback=g.headlessStep.bind(g);});
 await expect.poll(()=>calls.includes('finish'),{timeout:180000,intervals:[2000]}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__ARENA_GAME;g.loop.callback=g.__RENDER_CALLBACK;});
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles)).toContain('승리');
 expect(room!.phase).toBe('done');expect(room!.reason).toBe('combat');expect(errors).toEqual([]);
 await captureGame(page,info.outputPath('arena-confirmed-result.png'));
 await info.attach('arena-calls',{body:JSON.stringify(calls),contentType:'application/json'});
});
