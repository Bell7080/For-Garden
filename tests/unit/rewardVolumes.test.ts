import { describe,it,expect } from 'vitest';
import { MISSIONS, RESEARCH_REWARD_STAGES } from '../../src/core/missions';
import { ACHIEVEMENT_SERIES } from '../../src/data/achievements';
import { ANCIENT_MONTHLY_RANK_REWARDS, GUILD_GUARD_DAILY_RANK_COINS, GUILD_WEEKLY_RANK_REWARDS, WEEKLY_RANK_GEMS } from '../../src/data/competitiveRewards';
import { ANCIENT_STRATA_MAX_FLOOR, ancientFirstClearReward } from '../../src/data/ancientStrataDifficulty';
import { ARENA_TIERS, ARENA_WEEKLY_RANK_GEMS } from '../../src/core/arenaStanding';
import { DUEL_TIERS } from '../../src/core/duelArena';
import { RAID_DIFFICULTY } from '../../src/data/raid';
import { GUILD_GUARD } from '../../src/core/guildGuard';
import { GUILD_GUARD_COIN, guildGuardCoin } from '../../src/core/guildGuardBattle';
import { GUILD_WAR_COIN } from '../../src/core/guildWarAttack';
import { EXPEDITION_BEST_SCORE_REWARD_STAGES, EXPEDITION_NODE_REWARD_BALANCE, EXPEDITION_SWEEP_REWARDS, EXPEDITION_TREASURE_REWARD_BALANCE, EXPEDITION_WEEKLY_RANK_POOL } from '../../src/data/expedition';
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
 // 2026-10-27 응태 요청: 원정 주간 순위를 표준 보상 풀(1,000위 밖 백분율 구간 + 참여)로 옮기고 골드·치즈케이크를 얹었다.
 // 젬·인양 기록은 예전 표 그대로(101위 밖 500·80)이고, 얹은 몫의 끝(1위 골드 5,000·치즈케이크 150)은 원정 주간 공급의 약 13.5%다(승인선 20% 아래).
 it('원정 주간 순위 풀은 예전 젬·인양 기록을 넘지 않고 얹은 골드·치즈케이크는 주간 공급의 20% 아래다',()=>{
  const rows=[...EXPEDITION_WEEKLY_RANK_POOL.ranks.map(r=>r.rewards),...EXPEDITION_WEEKLY_RANK_POOL.percents.map(r=>r.rewards),EXPEDITION_WEEKLY_RANK_POOL.participation];
  expect(EXPEDITION_WEEKLY_RANK_POOL.ranks.slice(0,5).map(r=>r.rewards.gems),approvalMessage).toEqual(WEEKLY_RANK_GEMS.slice(0,5).map(r=>r.gems));
  expect(rows.every(r=>(r.gems??0)<=3000&&(r.salvageRecord??0)<=400),approvalMessage).toBe(true);
  expect(rows.slice(5).every(r=>r.gems===500&&r.salvageRecord===80),approvalMessage).toBe(true);
  const weeklyRuns=7/0.75;
  for(const key of ['gold','cheesecake'] as const){
   const top=Math.max(...rows.map(r=>r[key]??0));
   expect(top,approvalMessage).toBeLessThanOrEqual(EXPEDITION_SWEEP_REWARDS[key]*weeklyRuns*0.2);
  }
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
 // 2026-10-27 응태 승인: 길드 수호전 한 판 코인 5~20, 하루 두 판(하루 40 · 주 280이 끝).
 // 2026-10-29: 점수 곡선이 3배 안팎으로 가팔라져 환산 점수만 150 → 450(기본 5 · 상한 20 · 하루 횟수는 그대로 — 같은 편성의 코인은 늘지 않는다).
 it('길드 수호전 코인은 한 판 20 · 하루 40을 넘지 않는다',()=>{
  expect(GUILD_GUARD_COIN,approvalMessage).toEqual({base:5,perScore:450,cap:20});
  expect(guildGuardCoin(Number.MAX_SAFE_INTEGER),approvalMessage).toBe(20);
  expect(GUILD_GUARD.attemptsPerDay,approvalMessage).toBe(2);
  expect(guildGuardCoin(Number.MAX_SAFE_INTEGER)*GUILD_GUARD.attemptsPerDay*7,approvalMessage).toBeLessThanOrEqual(280);
 });
 // 2026-10-28 응태 승인(결정 카드 「안 A — 승30·패15·부전승20」): 길드전 전투일 코인. 전투일은 이틀에 하루라 주 최대 4번(주 120이 끝).
 it('길드전 코인은 한 회차 30 · 주 120을 넘지 않는다',()=>{
  expect(GUILD_WAR_COIN,approvalMessage).toEqual({win:30,loss:15,bye:20,forfeit:0});
  const battleDays=[0,1,2,3,4,5,6].filter(d=>d%2===1).length+1;
  expect(Math.max(...Object.values(GUILD_WAR_COIN))*battleDays,approvalMessage).toBeLessThanOrEqual(120);
 });
 // 2026-10-28 응태 승인(결정 카드 「제안한 값으로 둘 다 승인」): 길드 주간 순위 젬 1위 300 · 참여 20(주 1회),
 // 수호전 일일 길드 순위 코인 1위 30 · 참여 4(하루 1회 · 주 최대 210, 판 코인과 합쳐 주 ~210 → ~280).
 it('길드 주간 순위 젬과 수호전 일일 순위 코인은 승인된 표를 넘지 않는다',()=>{
  expect(GUILD_WEEKLY_RANK_REWARDS.ranks.map(r=>r.gems),approvalMessage).toEqual([300,250,200,150,120,100,80,60]);
  expect(GUILD_WEEKLY_RANK_REWARDS.percents.map(r=>r.gems),approvalMessage).toEqual([50,40,30]);
  expect(GUILD_WEEKLY_RANK_REWARDS.participation,approvalMessage).toBe(20);
  expect(GUILD_GUARD_DAILY_RANK_COINS.ranks.map(r=>r.gems),approvalMessage).toEqual([30,25,20,15,12,10]);
  expect(GUILD_GUARD_DAILY_RANK_COINS.percents.map(r=>r.gems),approvalMessage).toEqual([8,6,5]);
  expect(GUILD_GUARD_DAILY_RANK_COINS.participation,approvalMessage).toBe(4);
  const top=(table:typeof GUILD_WEEKLY_RANK_REWARDS)=>Math.max(...table.ranks.map(r=>r.gems),...table.percents.map(r=>r.gems),table.participation);
  expect(top(GUILD_WEEKLY_RANK_REWARDS),approvalMessage).toBeLessThanOrEqual(300);
  expect(top(GUILD_GUARD_DAILY_RANK_COINS)*7,approvalMessage).toBeLessThanOrEqual(210);
 });
});
