import { describe, it, expect } from 'vitest';
import { FakeServer } from '../../src/api/FakeServer';
import { createDefaultSession } from '../../src/state/session';
import { saveManager } from '../../src/state/SaveManager';
import { expeditionWeekKey } from '../../src/core/expeditionBoss';
import { EXPEDITION_BEST_SCORE_REWARD_STAGES } from '../../src/data/expedition';
import { WALLET_CAPS } from '../../src/data/economy';
const now=new Date('2026-10-22T01:00:00Z');
function setup(){const state=createDefaultSession();state.expedition.weekKey=expeditionWeekKey(now);state.expedition.bestScore=28000;return state;}
describe('원정 달성 보상 일괄 수령',()=>{
 it('미수령 달성 단계만 합산하고 재접속·같은 요청 재전송·새 요청으로도 중복 지급하지 않는다',async()=>{
  const state=setup();state.expedition.claimedRewardStageIds=['best-2k'];
  const server=new FakeServer(state,{latencyMs:0,now:()=>now,persistSession:()=>undefined});
  const result=await server.claimExpeditionReward({stageId:'all',requestId:'claim-batch'});
  expect(result.claimedNowStageIds).not.toContain('best-2k');expect(result.claimedNowStageIds).toHaveLength(9);
  expect(result.rewards?.find(r=>r.currency==='gold')?.amount).toBe(15000);
  expect(result.claimedStageIds).not.toContain('best-33k');
  const restored=saveManager.parse(JSON.parse(JSON.stringify(saveManager.exportData(state))));const wallet={...restored.wallet};
  const restarted=new FakeServer(restored,{latencyMs:0,now:()=>now,persistSession:()=>undefined});
  expect((await restarted.claimExpeditionReward({stageId:'all',requestId:'claim-batch'})).rewards).toEqual(result.rewards);
  expect((await restarted.claimExpeditionReward({stageId:'all',requestId:'claim-batch-again'})).rewards).toEqual([]);
  expect(restored.wallet).toEqual(wallet);
 });
 it('저장 실패에는 지갑·단계가 모두 미변경이고 재시도에만 한 번 반영한다',async()=>{
  const state=setup(),before=structuredClone(state);let fail=true;
  const server=new FakeServer(state,{latencyMs:0,now:()=>now,persistSession:()=>{if(fail)throw Error('storage down');}});
  await expect(server.claimExpeditionReward({stageId:'all',requestId:'claim-atomic'})).rejects.toBeDefined();
  expect(state.wallet).toEqual(before.wallet);expect(state.expedition.claimedRewardStageIds).toEqual([]);
  fail=false;expect((await server.claimExpeditionReward({stageId:'all',requestId:'claim-atomic'})).claimedNowStageIds).toHaveLength(10);
 });
 it('지갑 상한의 실제 지급량만 영수증에 포함하고 잠긴 단계는 받지 않는다',async()=>{
  const state=setup();state.wallet.gold=WALLET_CAPS.gold-100;
  const server=new FakeServer(state,{latencyMs:0,now:()=>now,persistSession:()=>undefined});
  const result=await server.claimExpeditionReward({stageId:'all',requestId:'claim-capped'});
  expect(result.rewards?.find(r=>r.currency==='gold')?.amount).toBe(100);expect(state.wallet.gold).toBe(WALLET_CAPS.gold);
  expect(result.claimedNowStageIds).toHaveLength(EXPEDITION_BEST_SCORE_REWARD_STAGES.filter(s=>s.threshold<=28000).length);
 });
});
