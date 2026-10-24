import { describe,it,expect } from 'vitest';
import { MISSIONS, RESEARCH_REWARD_STAGES } from '../../src/core/missions';
import { ACHIEVEMENT_SERIES } from '../../src/data/achievements';
import { WEEKLY_RANK_GEMS } from '../../src/data/competitiveRewards';
import { ARENA_TIERS, ARENA_WEEKLY_RANK_GEMS } from '../../src/core/arenaStanding';
import { DUEL_TIERS } from '../../src/core/duelArena';
import { RAID_DIFFICULTY } from '../../src/data/raid';
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
  expect(EXPEDITION_NODE_REWARD_BALANCE.gems.perNode.min,approvalMessage).toBeLessThanOrEqual(10);
  expect(EXPEDITION_NODE_REWARD_BALANCE.gems.perNode.max,approvalMessage).toBeLessThanOrEqual(20);
  expect(EXPEDITION_TREASURE_REWARD_BALANCE.gems.min,approvalMessage).toBeLessThanOrEqual(30);
  expect(EXPEDITION_TREASURE_REWARD_BALANCE.gems.max,approvalMessage).toBeLessThanOrEqual(60);
  expect(EXPEDITION_SWEEP_REWARDS.gems,approvalMessage).toBeLessThanOrEqual(200);
 });
 it('레이드 정산 젬은 난이도별 상한(50·75·100·150)을 넘지 않는다',()=>{
  expect(Object.values(RAID_DIFFICULTY).map(d=>d.settlement.gems),approvalMessage).toEqual([50,75,100,150]);
 });
 it('원정 최고 점수 길의 주간 젬 합은 350을 넘지 않는다',()=>{
  const gems=EXPEDITION_BEST_SCORE_REWARD_STAGES.filter(stage=>stage.reward.currency==='gems').reduce((sum,stage)=>sum+stage.reward.amount,0);
  expect(gems,approvalMessage).toBeLessThanOrEqual(350);
 });
 it('소탕은 런 최대치 비례식이 아니라 검수된 고정표다',()=>{
  expect(EXPEDITION_SWEEP_REWARDS,approvalMessage).toEqual({gold:4_000,cheesecake:120,gems:200,salvageRecord:60,fossil:0});
 });
 it('경쟁 주간·시즌 보상은 검수된 표를 넘지 않는다(결투장·원정 하향, 아레나 상향 — 응태 승인)',()=>{
  expect(WEEKLY_RANK_GEMS.map(r=>r.gems),approvalMessage).toEqual([3000,2500,2000,1500,1000,500]);
  expect(ARENA_WEEKLY_RANK_GEMS.map(r=>r.gems),approvalMessage).toEqual([2500,2000,1500,1000,500,0]);
  expect(ARENA_TIERS.map(t=>t.weeklyReward.gems),approvalMessage).toEqual([200,300,500,600,800,1000]);
  expect(DUEL_TIERS.map(t=>t.seasonReward.gems),approvalMessage).toEqual([300,500,1000,1500,2000,2500,3000,3500]);
  // 한 주에 한 사람이 받는 경쟁 젬의 끝(결투장 1위 + 원정 1위 + 아레나 마스터·1위)
  expect(WEEKLY_RANK_GEMS[0].gems*2+ARENA_TIERS.at(-1)!.weeklyReward.gems+ARENA_WEEKLY_RANK_GEMS[0].gems,approvalMessage).toBeLessThanOrEqual(9500);
 });
});
