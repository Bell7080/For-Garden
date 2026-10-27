import { describe,it,expect } from "vitest";
import {handleGameCall,MAX_PENDING_GAME_CALLS,type StateStore,type StoredState} from "../../src/server/gameHandler";
describe("서버 게임 큐 과부하",()=>{
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
