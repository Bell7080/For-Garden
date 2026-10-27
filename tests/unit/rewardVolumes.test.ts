import { describe,it,expect } from 'vitest';
import { MISSIONS, RESEARCH_REWARD_STAGES } from '../../src/core/missions';
import { ACHIEVEMENT_SERIES } from '../../src/data/achievements';
import { ANCIENT_MONTHLY_RANK_REWARDS, WEEKLY_RANK_GEMS } from '../../src/data/competitiveRewards';
import { ANCIENT_STRATA_MAX_FLOOR, ancientFirstClearReward } from '../../src/data/ancientStrataDifficulty';
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
  expect(EXPEDITION_NODE_REWARD_BALANCE.gems.perNode.min,approvalMessage).toBeLessThanOrEqual(9);
  expect(EXPEDITION_NODE_REWARD_BALANCE.gems.perNode.max,approvalMessage).toBeLessThanOrEqual(17);
  expect(EXPEDITION_TREASURE_REWARD_BALANCE.gems.min,approvalMessage).toBeLessThanOrEqual(25);
  expect(EXPEDITION_TREASURE_REWARD_BALANCE.gems.max,approvalMessage).toBeLessThanOrEqual(50);
  expect(EXPEDITION_SWEEP_REWARDS.gems,approvalMessage).toBeLessThanOrEqual(170);
 });
 it('레이드 정산 젬은 난이도별 상한(40·65·85·130)을 넘지 않는다',()=>{
  expect(Object.values(RAID_DIFFICULTY).map(d=>d.settlement.gems),approvalMessage).toEqual([40,65,85,130]);
 });
 it('원정 최고 점수 길의 주간 젬 합은 295를 넘지 않는다',()=>{
  const gems=EXPEDITION_BEST_SCORE_REWARD_STAGES.filter(stage=>stage.reward.currency==='gems').reduce((sum,stage)=>sum+stage.reward.amount,0);
  expect(gems,approvalMessage).toBeLessThanOrEqual(295);
 });
 it('소탕은 런 최대치 비례식이 아니라 검수된 고정표다',()=>{
  expect(EXPEDITION_SWEEP_REWARDS,approvalMessage).toEqual({gold:4_000,cheesecake:120,gems:170,salvageRecord:60,fossil:0});
 });
 it('경쟁 주간·시즌 보상은 검수된 표를 넘지 않는다(결투장·원정 하향, 아레나 상향 — 응태 승인)',()=>{
  expect(WEEKLY_RANK_GEMS.map(r=>r.gems),approvalMessage).toEqual([3000,2500,2000,1500,1000,500]);
  expect(ARENA_WEEKLY_RANK_GEMS.map(r=>r.gems),approvalMessage).toEqual([2500,2000,1500,1000,500,0]);
  expect(ARENA_TIERS.map(t=>t.weeklyReward.gems),approvalMessage).toEqual([200,300,500,600,800,1000]);
  expect(DUEL_TIERS.map(t=>t.seasonReward.gems),approvalMessage).toEqual([300,500,1000,1500,2000,2500,3000,3500]);
  // 한 주에 한 사람이 받는 경쟁 젬의 끝(결투장 1위 + 원정 1위 + 아레나 마스터·1위)
  expect(WEEKLY_RANK_GEMS[0].gems*2+ARENA_TIERS.at(-1)!.weeklyReward.gems+ARENA_WEEKLY_RANK_GEMS[0].gems,approvalMessage).toBeLessThanOrEqual(9500);
 });
 // 2026-10-27 응태 승인: 고대 지층은 매달 초기화되고 초회 보상을 매달 전부 다시 준다(200층 끝까지 젬 6,500/월).
 // 월간 순위는 1위 3,000 · 1,000위 밖은 백분율 구간 + 참여 200.
 it('고대 지층의 달마다 다시 열리는 초회 젬과 월간 순위 젬은 승인된 표를 넘지 않는다',()=>{
  const gems=Array.from({length:ANCIENT_STRATA_MAX_FLOOR},(_,i)=>ancientFirstClearReward(i+1)).reduce((sum,r)=>sum+(r.kind==='currency'&&r.currency==='gems'?r.amount:0),0);
  expect(gems,approvalMessage).toBeLessThanOrEqual(6500);
  expect(ANCIENT_MONTHLY_RANK_REWARDS.ranks.map(r=>r.gems),approvalMessage).toEqual([3000,2500,2000,1500,1000,900,750,600]);
  expect(ANCIENT_MONTHLY_RANK_REWARDS.percents.map(r=>r.gems),approvalMessage).toEqual([500,400,300]);
  expect(ANCIENT_MONTHLY_RANK_REWARDS.participation,approvalMessage).toBe(200);
 });
});
