import { test, expect as baseExpect } from '@playwright/test';
// GPU 없는 컨테이너에서는 캔버스 한 장 그리는 데도 수 초가 든다 — 폴링 한도를 넉넉히 둔다.
const expect = baseExpect.configure({ timeout: 30000 });
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

for (const mySide of [0, 1] as const) test(`아레나 동시 밴 → 공개 연출 → 번갈아 칸 픽 → 자동 전투(내 자리 ${mySide}) → 서버 결과`,async({page},info)=>{
 test.skip(process.env.PF_E2E_REMOTE_LOOP!=='1','Vite test source mode only');test.setTimeout(420000);
 const {createDefaultSession,createInitialRelicProgress}=await import('../../src/state/session');
 const {saveManager}=await import('../../src/state/SaveManager');
 const {arenaPlayer}=await import('../../src/server/liveArena');
 const {startArena,applyArenaAction,arenaTurn,arenaPickable,settleArena,publicArenaRoom}=await import('../../src/core/liveArena');
 const {ARENA_ROOM_LAYOUT}=await import('../../src/ui/arenaRoomLayout');
 const own=createDefaultSession();own.owned=new Set([...own.owned,'rex','spino','mette','stella']);own.party=['rex','mette','stella'];own.favorite='rex';
 for(const id of own.owned)own.relicProgress[id]={...createInitialRelicProgress(),level:20,breakthrough:1};
 const opponent=createDefaultSession();opponent.owned=new Set(own.owned);opponent.party=[...own.party];opponent.favorite='rex';for(const id of opponent.owned)opponent.relicProgress[id]=createInitialRelicProgress();
 const me='browser-arena',foe='browser-enemy',foeSide=1-mySide;
 let room:import('../../src/core/liveArena').ArenaRoom|undefined;const calls:string[]=[];const errors:string[]=[];
 page.on('pageerror',e=>{errors.push(e.message);console.error(e.stack);});
 // 상대는 차례가 오면 곧바로 둔다. 밴은 내가 밴한 뒤에만 — 그래야 공개 연출이 내 화면에서 돈다.
 const advance=():void=>{
  if(!room)return;
  if(room.phase==='ban'&&room.bans[mySide]!==null&&room.bans[foeSide]===null)room=applyArenaAction(room,foe,{kind:'ban',relicId:'parua'},Date.now());
  while(room.phase==='place'&&arenaTurn(room)===foeSide){const i=room.picks[foeSide].length;room=applyArenaAction(room,foe,{kind:'place',relicId:arenaPickable(room,foeSide)[0].def.id,slot:i},Date.now());}
 };
 await page.route('**/api/game',async route=>{
  const body=route.request().postDataJSON();if(!String(body.method).startsWith('arena.')){await route.continue();return;}
  const input=body.args[0],kind=input.kind;calls.push(kind);
  // GPU 없는 컨테이너는 한 걸음에 수십 초가 들어 45초 시계에 걸린다 — 모의 서버는 시계를 늘 넉넉히 둔다.
  if(room&&(room.phase==='ban'||room.phase==='place'))room.deadline=Date.now()+600000;
  if(kind==='action'){room=applyArenaAction(room!,me,input.action,Date.now());room.version++;}
  if(kind==='finish')room=settleArena(room!);
  const before=JSON.stringify(room);advance();if(JSON.stringify(room)!==before)room!.version++;
  await route.fulfill({json:{ok:true,result:{playerId:me,score:1000,wins:0,losses:0,room:room&&publicArenaRoom(room,me),incoming:[]}}});
 });
 await installGameHandleProbe(page);await startAfterOpening(page);
 await page.evaluate(async()=>{const root='/src/';const m=await import(/* @vite-ignore */root+'api/arenaApi.ts');m.installArenaApi(async()=> 'browser-token');});
 const players=[arenaPlayer(me,saveManager.exportData(own)),arenaPlayer(foe,saveManager.exportData(opponent))];if(mySide===1)players.reverse();
 room=startArena({id:'browser-live-arena',version:1,ranked:false,rules:{ban:true,order:'first',placement:'alternate',unique:true},players:[],phase:'ban',first:0,bans:[null,null],picks:[[],[]],locked:[false,false],deadline:0,seed:'browser-arena-shared-seed'},players,Date.now());
 const cdp=await page.context().newCDPSession(page);const fn=await cdp.send('Runtime.evaluate',{expression:"window.__PF_AUDIT_LISTENERS__.find(e=>e.canvas===document.querySelector('canvas')).listener"});const props=await cdp.send('Runtime.getProperties',{objectId:fn.result.objectId!});const bound=props.internalProperties!.find(p=>p.name==='[[BoundThis]]')!.value!.objectId!;
 await cdp.send('Runtime.callFunctionOn',{objectId:bound,functionDeclaration:"function(){window.__ARENA_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('arenaRoom',{roomId:'browser-live-arena'});}"});
 const scene=(expr:string)=>page.evaluate((e)=>{const s=(window as any).__ARENA_GAME.scene.getScene('arenaRoom');return new Function('s',`return ${e}`)(s);},expr);
 const tapCard=async(id:string)=>{const grid=await page.evaluate(()=>(window as any).__PF_DEBUG.gridCards.arenaRoom);const c=grid.cards[id];await tap(page,c.x,c.y+grid.offsetY);};
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('arenaRoom');
 await expect.poll(()=>scene('s.status?.room?.phase'),{timeout:30000}).toBe('ban');
 await page.waitForTimeout(1500);await captureGame(page,info.outputPath(`arena-ban-${mySide}.png`));
 const banTarget=room!.players[foeSide].roster[0].def.id;
 await tapCard(banTarget);await expect.poll(()=>scene('s.selectedRelic')).toBe(banTarget);
 await page.waitForTimeout(400);await captureGame(page,info.outputPath(`arena-ban-selected-${mySide}.png`));
 await tap(page,ARENA_ROOM_LAYOUT.confirm.x,ARENA_ROOM_LAYOUT.confirm.y);
 await expect.poll(()=>scene('s.status?.room?.phase'),{timeout:30000}).toBe('place');
 await page.waitForTimeout(1000);await captureGame(page,info.outputPath(`arena-ban-reveal-${mySide}.png`));
 await expect.poll(()=>scene('s.revealing')).toBe(false);
 for(let i=0;i<3;i++){
  await expect.poll(()=>scene(`s.status.room.phase==='place'&&s.status.room.picks[${mySide}].length===${i}&&s.canAct(s.status.room,${mySide})`)).toBe(true);
  const id=arenaPickable(publicArenaRoom(room!,me),mySide)[0].def.id;
  // 두 순서를 모두 지난다 — 둘째 픽은 칸을 먼저, 나머지는 카드를 먼저 고른다.
  if(i===1){await tap(page,ARENA_ROOM_LAYOUT.slotX[2],ARENA_ROOM_LAYOUT.allyRow);await expect.poll(()=>scene('s.selectedSlot')).toBe(2);}
  await tapCard(id);await expect.poll(()=>scene('s.selectedRelic')).toBe(id);
  if(i===1){await page.waitForTimeout(500);await captureGame(page,info.outputPath(`arena-pick-${mySide}.png`));}
  await tap(page,ARENA_ROOM_LAYOUT.confirm.x,ARENA_ROOM_LAYOUT.confirm.y);
  if(i<2)await expect.poll(()=>room!.picks[mySide].length).toBe(i+1);
 }
 expect(room!.picks[mySide].map(p=>p.slot).sort()).toEqual([0,1,2]);
 await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('battle');
 await expect.poll(()=>page.evaluate(()=>(window as any).__ARENA_GAME.scene.getScene('battle').spawned),{timeout:90000}).toBe(true);
 // 어느 자리에서 보든 내 편이 아래에 선다.
 const rows=await page.evaluate(()=>{const b=(window as any).__ARENA_GAME.scene.getScene('battle');const avg=(f:any[])=>f.reduce((a,x)=>a+x.y,0)/f.length;const mine=b.state.fighters.filter((f:any)=>b.isAlly(f)),theirs=b.state.fighters.filter((f:any)=>!b.isAlly(f));return {flip:b.viewFlip,mine:avg(mine),theirs:avg(theirs)};});
 expect(rows.flip).toBe(mySide===1);expect(rows.mine).toBeGreaterThan(rows.theirs);
 await page.waitForTimeout(2500);await captureGame(page,info.outputPath(`arena-automatic-battle-${mySide}.png`));
 await page.evaluate(()=>{const g=(window as any).__ARENA_GAME;g.__RENDER_CALLBACK=g.loop.callback;g.loop.callback=g.headlessStep.bind(g);});
 await expect.poll(()=>calls.includes('finish'),{timeout:180000,intervals:[2000]}).toBe(true);
 await page.evaluate(()=>{const g=(window as any).__ARENA_GAME;g.loop.callback=g.__RENDER_CALLBACK;});
 await expect.poll(async()=>(await page.evaluate(()=>window.__PF_DEBUG?.popupTitles))?.some((t:string)=>['승리','패배','무승부'].includes(t))).toBe(true);
 expect(room!.phase).toBe('done');expect(room!.reason).toBe('combat');expect(errors).toEqual([]);
 await captureGame(page,info.outputPath(`arena-confirmed-result-${mySide}.png`));
 await info.attach('arena-calls',{body:JSON.stringify(calls),contentType:'application/json'});
});
