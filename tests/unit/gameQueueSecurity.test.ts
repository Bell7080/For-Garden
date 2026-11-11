import { describe,it,expect } from "vitest";
import {handleGameCall,MAX_PENDING_GAME_CALLS,type StateStore,type StoredState} from "../../src/server/gameHandler";
describe("서버 게임 큐 과부하",()=>{
 it("대기 중 한도가 지난 요청은 나중에 깨어나도 조회·저장을 실행하지 않는다",async()=>{
  let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve});
  const loaded:string[]=[],committed:string[]=[];
  const store:StateStore={load:async id=>{loaded.push(id);await barrier;return null;},findReceipt:async()=>undefined,
   commit:async input=>{committed.push(input.playerId);return {revision:"1"};}};
  const active=handleGameCall("active",{method:"getPlayerState"},{store});
  const controller=new AbortController();
  const expired=handleGameCall("expired",{method:"getPlayerState"},{store,signal:controller.signal});
  const rejected=expect(expired).rejects.toMatchObject({status:503,code:"request_timeout"});
  controller.abort();release();await active;await rejected;
  expect(loaded).toEqual(["active"]);expect(committed).toEqual(["active"]);
 });
 it("조회 도중 전체 호출 한도가 지나면 기본 계정을 새로 저장하지 않는다",async()=>{
  const controller=new AbortController();let committed=false;
  const store:StateStore={load:async()=>{controller.abort();return null;},findReceipt:async()=>undefined,
   commit:async()=>{committed=true;return {revision:"1"};}};
  await expect(handleGameCall("expired",{method:"getPlayerState"},{store,signal:controller.signal})).rejects.toMatchObject({code:"request_timeout"});
  expect(committed).toBe(false);
 });
 it("인증 계정을 바꿔도 전역 대기열을 무한히 쌓을 수 없고 해제 뒤 정상 처리한다",async()=>{
  let release!:()=>void;const barrier=new Promise<void>(resolve=>{release=resolve});
  const states=new Map<string,StoredState>();
  const store:StateStore={load:async id=>{await barrier;return states.get(id)??null;},findReceipt:async()=>undefined,
   commit:async input=>{states.set(input.playerId,{revision:"1",data:input.data});return {revision:"1"};}};
  const pending=Array.from({length:MAX_PENDING_GAME_CALLS},(_,i)=>handleGameCall(`player-${i}`,{method:"getPlayerState"},{store}));
  expect(()=>handleGameCall("other",{method:"getPlayerState"},{store})).toThrow("server_busy");
  release();await Promise.all(pending);
  expect((await handleGameCall("other",{method:"getPlayerState"},{store})).ok).toBe(true);
 });
});
