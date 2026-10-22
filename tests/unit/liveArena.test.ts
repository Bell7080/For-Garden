import { describe, it, expect } from 'vitest';
import { RANKED_ARENA_RULES, startArena, applyArenaAction, arenaTurn, publicArenaRoom, settleArena, arenaPosition, type ArenaRoom } from '../../src/core/liveArena';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { arenaPlayer } from '../../src/server/liveArena';
function fixture(hidden=false,ban=true):ArenaRoom {
 const state=createDefaultSession();state.owned=new Set([...state.owned,'rex','spino','mette','stella']);
 for(const id of state.owned)state.relicProgress[id]=createInitialRelicProgress();state.party=['rex','mette','stella'];state.favorite='rex';
 return startArena({id:'test-room',version:0,ranked:true,rules:{...RANKED_ARENA_RULES,ban,placement:hidden?'hidden':'alternate'},players:[],phase:'ban',first:0,bans:[null,null],picks:[[],[]],locked:[false,false],deadline:50000,seed:'same-seed'},['a','b'].map(id=>arenaPlayer(id,saveManager.exportData(state))),0);
}
const place=(r:ArenaRoom,side:number,id:string,index:number)=>applyArenaAction(r,r.players[side].id,{kind:'place',relicId:id,x:[.08,.5,.92][index],y:index===1?.32:0},1000);
describe('live arena authoritative preparation',()=>{
 it('requires four owned relics for one ban and a three-person team',()=>{const r=fixture();expect(()=>startArena(r,r.players.map(p=>({...p,roster:p.roster.slice(0,3)})),0)).toThrow('ARENA_ROSTER');});
 it('enforces ban order, own roster, banned units, unique selection and space',()=>{
  let r=fixture();expect(()=>applyArenaAction(r,'b',{kind:'ban',relicId:'rex'},100)).toThrow('ARENA_TURN');
  r=applyArenaAction(r,'a',{kind:'ban',relicId:'spino'},100);r=applyArenaAction(r,'b',{kind:'ban',relicId:'rex'},100);
  expect(()=>place(r,0,'rex',0)).toThrow('ARENA_PLACEMENT');
  expect(()=>place(r,1,'rex',0)).toThrow('ARENA_TURN');
  expect(()=>place(r,0,'nonowned',0)).toThrow('ARENA_PLACEMENT');
  r=place(r,0,'spino',0);r=place(r,1,'rex',0);
  expect(()=>place(r,0,'spino',1)).toThrow('ARENA_PLACEMENT');
  expect(()=>applyArenaAction(r,'a',{kind:'place',relicId:'mette',x:.08,y:0},100)).toThrow('ARENA_PLACEMENT');
  expect(()=>applyArenaAction(r,'a',{kind:'place',relicId:'mette',x:NaN,y:0},100)).toThrow('ARENA_PLACEMENT');
 });
 it('keeps hidden placements private until both lock and supports undo',()=>{
  let r=fixture(true,false);r=place(r,0,'rex',0);
  expect(publicArenaRoom(r,'b').picks[0]).toEqual([]);expect(publicArenaRoom(r,'a').picks[0]).toHaveLength(1);
  r=applyArenaAction(r,'a',{kind:'undo'},1000);expect(r.picks[0]).toEqual([]);
  for(const side of [0,1]){for(const [i,id] of ['rex','mette','stella'].entries())r=place(r,side,id,i);r=applyArenaAction(r,r.players[side].id,{kind:'lock'},1000);}
  expect(r.phase).toBe('battle');expect(publicArenaRoom(r,'b').picks[0]).toHaveLength(3);
  expect(r.lease!.setup.options!.automaticUltimates).toBe(true);
  const a=settleArena(r),b=settleArena(structuredClone(r));expect(a.winner).toBe(b.winner);expect(a.resultTicks).toBe(b.resultTicks);expect(a.reason).toBe('combat');
 });
 it('alternates six placements and preserves selected positions in shared battle core',()=>{
  let r=fixture(false,false);
  for(let n=0;n<6;n++){const side=arenaTurn(r),i=r.picks[side].length;r=place(r,side,['rex','mette','stella'][i],i);}
  expect(r.phase).toBe('battle');expect(r.lease!.setup.options!.playerPositions![0]).toEqual(arenaPosition(r.picks[0][0],0));
 });
 it('assigns timeout and forfeit without trusting a client result',()=>{
  let r=fixture();expect(applyArenaAction(r,'a',{kind:'tick'},50000)).toMatchObject({phase:'done',winner:1,reason:'timeout'});
  r=fixture(true,false);expect(applyArenaAction(r,'b',{kind:'tick'},50000).winner).toBe(null);
  expect(applyArenaAction(r,'a',{kind:'forfeit'},1000)).toMatchObject({winner:1,reason:'forfeit'});
  expect(()=>publicArenaRoom(r,'outsider')).toThrow('ARENA_FORBIDDEN');
 });
});
