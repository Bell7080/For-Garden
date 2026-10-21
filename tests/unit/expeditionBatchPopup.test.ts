import { describe,it,expect,vi } from 'vitest';
import { sourceClass } from '../helpers/sourceClass';
describe('원정 달성 보상 팝업',()=>{
 it('여러 달성 보상을 한 요청으로 받고 같은 재화를 합쳐 팝업 한 장으로 표시한다',async()=>{
  let resolve!:(v:unknown)=>void;const request=vi.fn((_request:unknown)=>new Promise(r=>{resolve=r;})),show=vi.fn();
  const Popup=sourceClass('src/ui/ExpeditionRewardPopup.ts','ExpeditionRewardPopup',{
   hasRemoteState:()=>false,session:{wallet:{}},withBusy:(_s:unknown,p:unknown)=>p,t:(k:string)=>k,
   currencyRecordToRewardItems:(r:Record<string,number>)=>Object.entries(r).map(([currency,amount])=>({currency,amount})),openRewardPopup:show,
  });
  const scene={scene:{isActive:()=>true}};const popup=new Popup(scene,{}, {claimExpeditionReward:request});
  popup.body={active:true};popup.refresh=vi.fn().mockResolvedValue(undefined);popup.render=vi.fn();
  const claim=popup.claim();await popup.claim();expect(request).toHaveBeenCalledOnce();expect(request.mock.calls[0][0]).toMatchObject({stageId:'all'});
  resolve({wallet:{gems:900},alreadyClaimed:false,rewards:[{currency:'gems',amount:300},{currency:'gems',amount:600},{currency:'gold',amount:30000}]});
  await claim;expect(show).toHaveBeenCalledOnce();expect(show.mock.calls[0][2].items).toEqual([{currency:'gems',amount:900},{currency:'gold',amount:30000}]);
 });
});
