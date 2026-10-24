import { describe, it, expect } from 'vitest';
import { RANKED_ARENA_RULES, ARENA_HIDDEN_BAN, ARENA_SLOTS, startArena, applyArenaAction, arenaTurn, arenaCanAct, arenaPickable, arenaRules, publicArenaRoom, settleArena, arenaPosition, ARENA_ABSENCE_MS, type ArenaRoom, type ArenaRules } from '../../src/core/liveArena';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { arenaPlayer } from '../../src/server/liveArena';
function fixture(hidden=false,ban=true,extra:Partial<ArenaRules>={}):ArenaRoom {
 const state=createDefaultSession();state.owned=new Set([...state.owned,'rex','spino','mette','stella']);
 for(const id of state.owned)state.relicProgress[id]=createInitialRelicProgress();state.party=['rex','mette','stella'];state.favorite='rex';
 return startArena({id:'test-room',version:0,ranked:true,rules:{...RANKED_ARENA_RULES,ban,placement:hidden?'hidden':'alternate',...extra},players:[],phase:'ban',first:0,bans:[null,null],picks:[[],[]],locked:[false,false],deadline:50000,seed:'same-seed'},['a','b'].map(id=>arenaPlayer(id,saveManager.exportData(state))),0);
}
const place=(r:ArenaRoom,side:number,id:string,slot:number)=>applyArenaAction(r,r.players[side].id,{kind:'place',relicId:id,slot},1000);
describe('live arena authoritative preparation',()=>{
 it('requires four owned relics for one ban and a three-person team',()=>{const r=fixture();expect(()=>startArena(r,r.players.map(p=>({...p,roster:p.roster.slice(0,3)})),0)).toThrow('ARENA_ROSTER');});
 it('bans blind and simultaneously, then removes the banned relic from both pools',()=>{
  let r=fixture();expect(arenaCanAct(r,0)).toBe(true);expect(arenaCanAct(r,1)).toBe(true);
  expect(()=>applyArenaAction(r,'b',{kind:'ban',relicId:'nonowned'},100)).toThrow('ARENA_PLACEMENT');
  r=applyArenaAction(r,'b',{kind:'ban',relicId:'rex'},100);
  expect(publicArenaRoom(r,'a').bans).toEqual([null,ARENA_HIDDEN_BAN]);expect(publicArenaRoom(r,'b').bans).toEqual([null,'rex']);
  expect(()=>applyArenaAction(r,'b',{kind:'ban',relicId:'spino'},100)).toThrow('ARENA_TURN');
  r=applyArenaAction(r,'a',{kind:'ban',relicId:'spino'},200);expect(r.phase).toBe('place');expect(r.deadline).toBe(45200);
  expect(publicArenaRoom(r,'a').bans).toEqual(['spino','rex']);
  expect(arenaPickable(r,0).map(u=>u.def.id)).not.toContain('rex');expect(arenaPickable(r,0).map(u=>u.def.id)).not.toContain('spino');
  expect(()=>place(r,0,'rex',0)).toThrow('ARENA_PLACEMENT');
  expect(()=>place(r,1,'mette',0)).toThrow('ARENA_TURN');
  expect(()=>place(r,0,'nonowned',0)).toThrow('ARENA_PLACEMENT');
  expect(()=>place(r,0,'mette',3)).toThrow('ARENA_PLACEMENT');
  r=place(r,0,'mette',2);expect(r.picks[0][0]).toEqual({relicId:'mette',slot:2,...ARENA_SLOTS[2]});
  // 상대가 고른 렐릭은 기본 규칙에서 고를 수 없다.
  expect(()=>place(r,1,'mette',0)).toThrow('ARENA_PLACEMENT');
  r=place(r,1,'stella',1);
  expect(()=>place(r,0,'stella',0)).toThrow('ARENA_PLACEMENT');
  expect(()=>place(r,0,'torika',2)).toThrow('ARENA_PLACEMENT');
 });
 it('lets a friendly room allow duplicate picks and never strands a small roster',()=>{
  expect(arenaRules({ban:true,order:'first',placement:'alternate'}).unique).toBe(true);
  expect(arenaRules({ban:true,order:'first',placement:'alternate',unique:false}).unique).toBe(false);
  let r=fixture(false,false,{unique:false});r=place(r,0,'rex',0);r=place(r,1,'rex',0);expect(r.picks[1][0].relicId).toBe('rex');
  r=fixture(false,false);r.players[1].roster=r.players[1].roster.filter(u=>['rex','mette','stella'].includes(u.def.id));
  r=place(r,0,'rex',0);r=place(r,1,'mette',0);r=place(r,0,'stella',1);
  expect(arenaPickable(r,1).map(u=>u.def.id).sort()).toEqual(['rex','stella']);
  r=place(r,1,'rex',1);r=place(r,0,'spino',2);r=place(r,1,'stella',2);expect(r.phase).toBe('battle');
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
  r=fixture(false,false,{unique:false});
  for(let n=0;n<6;n++){const side=arenaTurn(r),i=r.picks[side].length;r=place(r,side,['rex','mette','stella'][i],i);}
  expect(r.phase).toBe('battle');expect(r.lease!.setup.options!.playerPositions![0]).toEqual(arenaPosition(r.picks[0][0],0));
 });
 it('assigns timeout and forfeit without trusting a client result',()=>{
  let r=fixture();expect(applyArenaAction(r,'a',{kind:'tick'},50000)).toMatchObject({phase:'done',winner:null,reason:'timeout'});
  r=applyArenaAction(r,'a',{kind:'ban',relicId:'rex'},100);expect(applyArenaAction(r,'a',{kind:'tick'},50000)).toMatchObject({winner:0,reason:'timeout'});
  r=fixture();
  r=fixture(true,false);expect(applyArenaAction(r,'b',{kind:'tick'},50000).winner).toBe(null);
  expect(applyArenaAction(r,'a',{kind:'forfeit'},1000)).toMatchObject({winner:1,reason:'forfeit'});
  expect(()=>publicArenaRoom(r,'outsider')).toThrow('ARENA_FORBIDDEN');
 });
 it('treats a silent opponent during ban/pick as a forfeit loss',()=>{
  const r=fixture();
  expect(applyArenaAction(r,'b',{kind:'tick'},ARENA_ABSENCE_MS+1000)).toMatchObject({phase:'done',winner:1,reason:'forfeit'});
  const alive=applyArenaAction(r,'a',{kind:'ban',relicId:'rex'},15000);
  expect(applyArenaAction(alive,'b',{kind:'tick'},ARENA_ABSENCE_MS+1000).phase).toBe('ban');
 });
});
