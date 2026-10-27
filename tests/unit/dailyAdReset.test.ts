import { describe,it,expect } from 'vitest';
import { FakeServer } from '../../src/api/FakeServer';
import { createDefaultSession } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { findAdRewardSlot } from '../../src/data/adRewards';

describe('서버 UTC 광고 횟수 조회',()=>{
 it('자정 전 한도를 유지하고 자정 후 조회·저장·재실행에서도 소탕권 광고가 다시 열린다',async()=>{
  const state=createDefaultSession();const limit=findAdRewardSlot('sweep-tickets')!.dailyLimitUtc;
  state.dailyAdRewards={date:'2026-10-21',claimsBySlot:{'sweep-tickets':limit},requestIds:['yesterday']};
  let now=new Date('2026-10-21T23:59:59.000Z');
  const server=new FakeServer(state,{latencyMs:0,now:()=>now,persistSession:()=>undefined,verifyAdToken:()=>true});
  expect((await server.getPlayerState()).dailyAdRewards.claimsBySlot['sweep-tickets']).toBe(limit);
  now=new Date('2026-10-22T00:00:00.000Z');
  expect((await server.getPlayerState()).dailyAdRewards).toEqual({date:'2026-10-22',claimsBySlot:{}});
  const restored=saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));
  const restarted=new FakeServer(restored,{latencyMs:0,now:()=>now,persistSession:()=>undefined,verifyAdToken:()=>true});
  const result=await restarted.claimAdReward({slotId:'sweep-tickets',requestId:'today-new',verificationToken:'verified'});
  expect(result.dailyAdRewards.claimsBySlot['sweep-tickets']).toBe(1);
 });
});
