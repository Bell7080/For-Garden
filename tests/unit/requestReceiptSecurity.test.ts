import { describe,expect,it } from "vitest";
import {handleGameCall,type StateStore,type StoredState} from "../../src/server/gameHandler";
function memory() {
  let stored:StoredState|null=null;const receipts=new Map<string,Record<string,unknown>>();let count=0;
  const store:StateStore={load:async()=>stored,findReceipt:async(_id,key)=>receipts.get(key),commit:async input=>{
    const revision=String(++count);stored={data:input.data,revision};if(input.requestId)receipts.set(input.requestId,{...(input.response as object),revision});return {revision};
  }};return {store,receipts,count:()=>count};
}
describe("영수증 저장 용량·민감 입력 경계",()=>{
 it("불필요한 큰 입력과 전체 상태를 영수증에 저장하지 않고 재전송은 복구한다",async()=>{
  const m=memory(),noise="private-opaque-request-data-".repeat(3000);
  const request={method:"updateAccountSettings",args:[{},noise],requestId:"bounded-receipt-01"};
  const first=await handleGameCall("player",request,{store:m.store});const saved=m.receipts.get(request.requestId)!;
  expect(saved._requestFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);expect(saved.state).toBeUndefined();expect(JSON.stringify(saved)).not.toContain(noise);
  expect(JSON.stringify(saved).length).toBeLessThan(1000);
  const replay=await handleGameCall("player",request,{store:m.store});expect(replay.result).toEqual(first.result);expect(replay.state).toEqual(first.state);expect(m.count()).toBe(1);
  await expect(handleGameCall("player",{...request,args:[{},"different"]},{store:m.store})).rejects.toThrow("request_id_conflict");
 });
 it("조회에 임의 요청 ID를 붙여도 영수증 표를 채우지 못한다",async()=>{
  const m=memory();await handleGameCall("player",{method:"getPlayerState",requestId:"read-receipt-01"},{store:m.store});
  await handleGameCall("player",{method:"getPlayerState",requestId:"read-receipt-02"},{store:m.store});
  expect(m.receipts.size).toBe(0);
 });
 it("구형 원문 fingerprint를 가진 재전송도 새 지급 없이 복구한다",async()=>{
  const m=memory();const request={method:"updateAccountSettings",args:[{}],requestId:"legacy-receipt-01"};
  const first=await handleGameCall("player",request,{store:m.store});m.receipts.get(request.requestId)!._requestFingerprint=JSON.stringify([request.method,request.args]);
  const replay=await handleGameCall("player",request,{store:m.store});expect(replay.state).toEqual(first.state);expect(m.count()).toBe(1);
 });
});
