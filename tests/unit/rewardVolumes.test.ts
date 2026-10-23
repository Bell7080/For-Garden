import { describe,it,expect } from 'vitest';
import { MISSIONS, RESEARCH_REWARD_STAGES } from '../../src/core/missions';
import { ACHIEVEMENT_SERIES } from '../../src/data/achievements';
import { EXPEDITION_BEST_SCORE_REWARD_STAGES, EXPEDITION_NODE_REWARD_BALANCE, EXPEDITION_SWEEP_REWARDS, EXPEDITION_TREASURE_REWARD_BALANCE } from '../../src/data/expedition';
describe('젬 보상 볼륨',()=>{
 it('일간·주간 임무 및 연구도 완료의 젬 합계를 상향한 표로 지급한다',()=>{
  const total=(period:'daily'|'weekly')=>MISSIONS.filter(m=>m.period===period&&m.reward.currency==='gems').reduce((sum,m)=>sum+m.reward.amount,0)+RESEARCH_REWARD_STAGES[period].flatMap(s=>s.rewards).filter(r=>r.currency==='gems').reduce((sum,r)=>sum+r.amount,0);
  expect(total('daily')).toBe(350);expect(total('weekly')).toBe(900);
 });
 it('업적 젬 단계는 최소 25개이고 기존 단계 ID와 목표를 유지한다',()=>{
  for(const tier of ACHIEVEMENT_SERIES.flatMap(s=>s.tiers).filter(t=>t.reward.currency==='gems'))expect(tier.reward.amount).toBeGreaterThanOrEqual(25);
  expect(ACHIEVEMENT_SERIES.find(s=>s.id==='wealth')?.tiers.map(t=>t.target)).toEqual([10000,100000,1000000,10000000,100000000]);
 });
});

describe('반복 보상 인플레이션 승인선',()=>{
 const approvalMessage='반복 보상 승인선 초과: 1회·일일·주간 공급량 표를 제시하고 개발자의 명시적 확인을 받은 뒤 CLAUDE.md의 절차와 이 상한을 함께 갱신하세요.';
 it('원정 젬의 노드·보물·소탕 1회 상한을 넘지 않는다',()=>{
  expect(EXPEDITION_NODE_REWARD_BALANCE.gems.perNode.min,approvalMessage).toBeLessThanOrEqual(5);
  expect(EXPEDITION_NODE_REWARD_BALANCE.gems.perNode.max,approvalMessage).toBeLessThanOrEqual(15);
  expect(EXPEDITION_TREASURE_REWARD_BALANCE.gems.min,approvalMessage).toBeLessThanOrEqual(20);
  expect(EXPEDITION_TREASURE_REWARD_BALANCE.gems.max,approvalMessage).toBeLessThanOrEqual(50);
  expect(EXPEDITION_SWEEP_REWARDS.gems,approvalMessage).toBeLessThanOrEqual(120);
 });
 it('원정 최고 점수 길의 주간 젬 합은 350을 넘지 않는다',()=>{
  const gems=EXPEDITION_BEST_SCORE_REWARD_STAGES.filter(stage=>stage.reward.currency==='gems').reduce((sum,stage)=>sum+stage.reward.amount,0);
  expect(gems,approvalMessage).toBeLessThanOrEqual(350);
 });
 it('소탕은 런 최대치 비례식이 아니라 검수된 고정표다',()=>{
  expect(EXPEDITION_SWEEP_REWARDS,approvalMessage).toEqual({gold:4_000,cheesecake:120,gems:120,salvageRecord:60,fossil:0});
 });
});
