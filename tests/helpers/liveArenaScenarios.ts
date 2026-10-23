import assert from 'node:assert/strict';
import { createSupabaseStore } from '../../src/server/supabaseStore';
import { handleArenaCall } from '../../src/server/liveArena';
import { createDefaultSession, createInitialRelicProgress } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { arenaTurn, arenaPickable } from '../../src/core/liveArena';
export async function run(sql:(s:string)=>string):Promise<void> {
 const q=(v:unknown)=>v===null?'null':`'${String(typeof v==='string'?v:JSON.stringify(v)).replaceAll("'","''")}'`;
 const ids=Array.from({length:4},(_,i)=>`00000000-0000-0000-0000-${String(i+301).padStart(12,'0')}`);
 const store=createSupabaseStore({url:'https://isolated.invalid',serviceKey:'isolated',fetchImpl:async(url,init)=>{
  const name=String(url).split('/').at(-1)!,args=JSON.parse(String(init?.body));
  return new Response(sql(`select public.${name}(${Object.entries(args).map(([k,v])=>`${k} => ${q(v)}`).join(',')});`)||'null');
 }});
 let n=0;
 const call=(id:string,kind='status',input:Record<string,unknown>={},request=`arena-db-${++n}`)=>handleArenaCall(store.arenaRpc,id,kind==='status'?'get':'act',[{kind,...input}],kind==='status'?undefined:request) as Promise<any>;
 for(const id of ids){sql(`insert into auth.users(id,is_anonymous) values('${id}',true);`);const s=createDefaultSession();s.owned=new Set([...s.owned,'rex','spino','mette','stella']);s.party=['rex','mette','stella'];s.favorite='rex';for(const relic of s.owned)s.relicProgress[relic]=createInitialRelicProgress();await store.commit({playerId:id,expectedRevision:null,data:saveManager.exportData(s),method:'fixture',requestId:null,response:{}});}
 sql(`insert into public.server_friend_edges(a,b,requester,status) values('${ids[0]}','${ids[1]}','${ids[0]}','friend');`);
 const baseline=sql(`select jsonb_agg(data order by player_id)::text from public.player_saves;`);
 await call(ids[0],'queue');let b=await call(ids[1],'queue');let a=await call(ids[0]);assert.equal(a.room.id,b.room.id);assert.equal(a.room.phase,'ban');
 const roomId=a.room.id;
 assert.equal(sql(`select count(*) from public.arena_seats;`),'2');
 await assert.rejects(call(ids[2],'status',{roomId}),/ARENA_FORBIDDEN/);
 let room=a.room;
 while(room.phase==='ban') {const side=arenaTurn(room);const id=room.players[side].id;room=(await call(id,'action',{roomId,action:{kind:'ban',relicId:'spino'}})).room;}
 let retryInput:any;
 for(let i=0;i<6;i++){
  const side=arenaTurn(room),id=room.players[side].id,index=room.picks[side].length;
  const input={roomId,action:{kind:'place',relicId:arenaPickable(room,side)[0].def.id,slot:index}};
  const request=`placement-${i}`;const next=await call(id,'action',input,request);const duplicate=await call(id,'action',input,request);assert.equal(next.room.version,duplicate.room.version);room=next.room;
  if(i===0){retryInput={id,input,request};await assert.rejects(call(id,'action',{roomId,action:{kind:'forfeit'}},request),/ARENA_REQUEST_CONFLICT/);}
 }
 assert.equal(room.phase,'battle');assert(room.lease);assert(retryInput);
 const final=await call(ids[0],'finish',{roomId},'finish-once');assert.equal(final.room.phase,'done');
 const repeated=await call(ids[1],'finish',{roomId},'finish-other');assert.equal(repeated.room.winner,final.room.winner);
 assert.equal(sql(`select sum(wins+losses) from public.arena_ratings;`),'2');assert.equal(sql(`select count(*) from public.arena_seats;`),'0');
 assert.equal(sql(`select jsonb_agg(data order by player_id)::text from public.player_saves;`),baseline,'arena cannot mutate regular duel tiers or wallets');
 let invite=await call(ids[0],'invite',{target:ids[1],rules:{ban:false,order:'second',placement:'hidden'}});
 assert.equal(invite.room.phase,'invited');let incoming=await call(ids[1]);assert.equal(incoming.incoming.length,1);
 const invitedId=invite.room.id;
 let accepted=await call(ids[1],'accept',{roomId:invitedId});assert.equal(accepted.room.first,1);assert.equal(accepted.room.phase,'place');
 const picked=await call(ids[0],'action',{roomId:invitedId,action:{kind:'place',relicId:'rex',slot:1}});assert.equal(picked.room.picks[0].length,1);
 const hidden=await call(ids[1],'status',{roomId:invitedId});assert.equal(hidden.room.picks[0].length,0);assert.equal(hidden.records.length,0);
 await call(ids[0],'action',{roomId:invitedId,action:{kind:'forfeit'}});assert.equal(sql(`select sum(wins+losses) from public.arena_ratings;`),'2');
 const practice=await call(ids[0],'practice',{target:ids[1]});assert.equal(practice.room.phase,'battle');assert.equal(practice.room.ranked,false);assert.equal(practice.room.lease.setup.enemies.length,3);
 await call(ids[0],'finish',{roomId:practice.room.id});assert.equal(sql(`select sum(wins+losses) from public.arena_ratings;`),'2');
 // RLS and grants: no room/private roster access, and only own wakeup counter is readable.
 assert.equal(sql(`set role authenticated;select count(*) from public.arena_signals;reset role;`),'0');
 assert.throws(()=>sql(`set role authenticated;select * from public.arena_rooms;`),/permission denied/);
 assert.throws(()=>sql(`set role authenticated;select public.server_arena_context('${ids[0]}','status',null,null,'{}',null);`),/permission denied/);
 assert.equal(sql(`select count(*) from public.arena_signals;`),'2');
 console.log(JSON.stringify({rankedMatch:roomId,serverWinner:final.room.winner,exactlyOnce:true,hiddenPrivacy:true,friendlyNoRating:true,defensePractice:true,rls:true}));
}
