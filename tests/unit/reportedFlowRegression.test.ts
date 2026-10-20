import { describe, it, expect, vi } from 'vitest';
import { sourceClass } from '../helpers/sourceClass';
import { displayRankingEntries } from '../../src/ui/expeditionRankingLayout';
import { placedEnemyIndex } from '../../src/data/placedEnemies';
import { getBattleStage, getStageEnemies } from '../../src/data/stages';
import { getRelic } from '../../src/data/relics';
import { raidBossDef, raidBossGrowth } from '../../src/core/raid';
import { groupCombatPower } from '../../src/core/combatPower';

describe('제보된 진행 경로 회귀',()=>{
 it.each(['cake','bounty'])('%s 패배 후 편성 변경이 원래 콘텐츠 단계를 보존한다',mode=>{
  const start=vi.fn();
  const Scene=sourceClass('src/scenes/BattleScene.ts','BattleScene',{Phaser:{Scene:class{}},growthPaths:()=>[{id:'party'}],session:{party:[],relicProgress:{}},contentOpen:()=>false,startScene:start});
  const scene=Object.create(Scene.prototype);scene.battleInput={mode,tierId:'tier-2'};
  const chosen=vi.fn();scene.defeatGrowth('party',chosen).onPick({id:'party'});
  expect(start).toHaveBeenCalledWith(scene,'party',{content:mode,tierId:'tier-2'});expect(chosen).toHaveBeenCalledTimes(1);
 });
 it('정식 원정 순위에는 표본이 생기지 않고 내 절대 등수가 보존된다',()=>{
  expect(displayRankingEntries([],0)).toEqual([]);
  const entry={rank:208,playerId:'me',displayName:'연구원',score:100,achievedAt:'',isMe:true};
  expect(displayRankingEntries([entry],100)).toEqual([entry]);
  expect(displayRankingEntries([],100,true).length).toBeGreaterThan(1);
 });
 it('레이드 적 정보에 선택된 스토리 적의 레벨이 섞이지 않는다',()=>{
  const boss=raidBossDef(getRelic('koma'),'normal');
  const map=placedEnemyIndex({mode:'raid',raidId:'test',bossRelicId:'koma',difficulty:'normal',requestId:'test-entry',seasonHp:100},getBattleStage('3-10'),[boss]);
  expect(map.get('enemy-0')).toEqual({def:boss,...raidBossGrowth('normal')});
 });
 it('4-10 전체 편성 전투력은 3-10보다 높다',()=>{
  const power=(id:string)=>groupCombatPower(getStageEnemies(getBattleStage(id)).map(e=>e.stats));
  expect(power('4-10')).toBeGreaterThan(power('3-10'));
 });
});
