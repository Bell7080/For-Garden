import { describe, expect, it } from 'vitest';
import { createSkirmish, stepSkirmish } from '../../src/core/skirmish';
import { battleArena } from '../../src/core/battleArena';
import { getRelic } from '../../src/data/relics';
import { competitiveRankGems } from '../../src/data/competitiveRewards';
import { DUEL_SEASON_DAYS, DUEL_TIERS, duelSeasonId, duelSeasonResetScore } from '../../src/core/duelArena';

describe('실제 이용자 PvP의 양쪽 성장', () => {
 it('공격·방어 모두 평타 쿨다운과 사거리 대기 없이 같은 스텝에 지원 궁극기를 쓴다',()=>{
  const def=getRelic('stella');
  const battle=createSkirmish([def],[def],battleArena('duel'),{}, {},{automaticUltimates:true});
  for(const fighter of battle.fighters){fighter.energy=def.ultimate.cost;fighter.attackCooldown=999;}
  const events=stepSkirmish(battle,.02,()=>.5);
  expect(events.filter(event=>event.kind==='teamBuff').map(event=>event.fighterId)).toEqual(battle.fighters.map(f=>f.id));
  expect(battle.fighters.map(f=>f.energy)).toEqual([0,0]);
 });
 it('기존 PvE 모드는 아군 궁극기를 임의로 자동 발동하지 않는다',()=>{
  const def=getRelic('stella');const battle=createSkirmish([def],[def],battleArena('duel'));
  for(const fighter of battle.fighters){fighter.energy=def.ultimate.cost;fighter.attackCooldown=999;}
  expect(stepSkirmish(battle,.02,()=>.5).filter(e=>e.kind==='teamBuff')).toEqual([]);
  expect(battle.fighters.map(f=>f.energy)).toEqual([def.ultimate.cost,def.ultimate.cost]);
 });
 it('방어팀도 회복 궁극기를 공격용 strike로 잃지 않고 실제 아군 회복으로 실행한다',()=>{
  const def=getRelic('mette');const battle=createSkirmish([def],[def],battleArena('duel'),{}, {},{automaticUltimates:true});
  for(const fighter of battle.fighters){fighter.energy=def.ultimate.cost;fighter.attackCooldown=999;fighter.hp=fighter.maxHp/2;}
  const events=stepSkirmish(battle,.02,()=>.5);
  expect(events.filter(e=>e.kind==='heal'&&e.source==='ultimate')).toHaveLength(2);
  expect(battle.fighters.map(f=>f.energy)).toEqual([0,0]);
  expect(battle.fighters[0].hp/battle.fighters[0].maxHp).toBeCloseTo(battle.fighters[1].hp/battle.fighters[1].maxHp,8);
  expect(battle.fighters[1].hp).toBeGreaterThan(battle.fighters[1].maxHp/2);
 });
 it('같은 렐릭이 양쪽에 있어도 방어자 룬 특성은 공격자에게 새지 않는다', () => {
  const def=getRelic('torika');
  const base=createSkirmish([def],[def],battleArena('duel'));
  const battle=createSkirmish([def],[def],battleArena('duel'),{}, {},{enemyAugmentEffects:[{kind:'flatStat',stat:'critChance',points:20,scope:{kind:'relic',relicId:'torika'}}]});
  expect(battle.fighters[0].def.stats.critChance).toBe(base.fighters[0].def.stats.critChance);
  expect(battle.fighters[1].def.stats.critChance).toBeGreaterThan(base.fighters[1].def.stats.critChance);
 });
 it('방어자 시작 보호막도 같은 코어 경계를 지난다', () => {
  const def=getRelic('torika');
  const battle=createSkirmish([def],[def],battleArena('duel'),{}, {},{enemyAugmentEffects:[{kind:'triggered',trigger:'battleStart',scope:{kind:'relic',relicId:'torika'},limits:{maxTriggers:1,cooldownSeconds:0,maxStacks:1,target:'self'},payload:{kind:'shield',maxHpPercent:20}}]});
  expect(battle.fighters[0].shield.amount).toBe(0);expect(battle.fighters[1].shield.amount).toBeGreaterThan(0);
 });
});
describe('주간·시즌 보상 정책',()=>{
 it('순위 구간 경계와 참가 보상은 오름/내림 혼동 없이 같은 표를 읽는다',()=>{
  expect([1,2,3,4,10,11,50,51,100,101,10000].map(competitiveRankGems)).toEqual([5000,4000,4000,3000,3000,2000,2000,1500,1500,800,800]);
 });
 it('3주마다 시즌이 넘어가고 플래티넘 보상·소프트 초기화가 적용된다',()=>{
  const start=new Date('2026-01-05T00:00:00Z');expect(DUEL_SEASON_DAYS).toBe(21);
  expect(duelSeasonId(new Date(start.getTime()+21*86400000-1))).toBe(duelSeasonId(start));
  expect(duelSeasonId(new Date(start.getTime()+21*86400000))).not.toBe(duelSeasonId(start));
  expect(DUEL_TIERS.find(t=>t.id==='platinum')!.seasonReward.gems).toBe(3000);expect(duelSeasonResetScore(1200)).toBe(700);
 });
});
