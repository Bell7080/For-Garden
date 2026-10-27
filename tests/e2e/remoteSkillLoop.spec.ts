import { expect, test, type Page } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { tap, captureGame } from "./canvasInput";

async function textPoint(page: Page, label: string) {
  const read = async () => page.evaluate(label => {
    let point: any = null;
    const walk = (v: any) => { if(v.visible===false||v.active===false)return;
      if(v.type==='Text'&&v.text===label){const b=v.getBounds();point={x:b.centerX,y:b.centerY};}
      for(const c of v.list??[])walk(c);
    };
    const scene=(window as any).__SKILL_SCENE;walk({list:scene.children.list});return point;
  },label);
  await expect.poll(read).not.toBeNull();return (await read())!;
}
async function clickTag(page: Page, label: string) {const p=await textPoint(page,label);await tap(page,p.x,p.y);}

test("미보유 도감·적의 디안/모르페 소환수와 폭주·수치 태그를 실제로 연다",async({page},info)=>{
  test.skip(process.env.PF_E2E_REMOTE_LOOP!=="1","소스 서버 전용");test.setTimeout(300000);
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
  await installGameHandleProbe(page);await startAfterOpening(page);
  await sourceScene(page,`this.game.scene.stop('title');this.game.scene.start('relics');window.__SKILL_SCENE=this.game.scene.getScene('relics');`);
  const show=async(id:string)=>page.evaluate(async id=>{const root='/src/';const{getRelic}=await import(/* @vite-ignore */root+'data/relics.ts');const s=(window as any).__SKILL_SCENE;s.info.popups.closeAll();s.info.showRelic(getRelic(id),false);},id);
  await show('dian');await tap(page,124,1724);await clickTag(page,'쿠로');
  await expect.poll(()=>page.evaluate(()=>(window as any).__SKILL_SCENE.info.summonInfo?.isOpen)).toBe(true);
  await captureGame(page,info.outputPath('unowned-dian-kuro.png'));
  // 첫 스킬 액자 위의 폭주 뱃지. 순수 배치표가 가진 실제 위치를 사용한다.
  const badge=await page.evaluate(async()=>{const root='/src/';const {SUMMON_INFO:L}=await import(/* @vite-ignore */root+'ui/summonInfoLayout.ts');return{x:540+L.skills.x,y:960+L.skills.y+L.ferocityBadgeOffsetY};});
  await tap(page,badge.x,badge.y);
  const gain=await page.evaluate(async()=>{const root='/src/';const{getRelic}=await import(/* @vite-ignore */root+'data/relics.ts');const{deriveSummonStats}=await import(/* @vite-ignore */root+'core/summonStats.ts');const owner=getRelic('dian'),summon=owner.summons[0];return Math.round(deriveSummonStats(owner.stats,summon).def*summon.def.ferocityTrait.defenseResistancePercent/100);});
  await clickTag(page,`+${gain}`);
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles??[])).toContain(`+${gain}`);
  await captureGame(page,info.outputPath('kuro-defense-formula.png'));
  await show('morphe');await tap(page,124,1724);await clickTag(page,'디모');
  await expect.poll(()=>page.evaluate(()=>(window as any).__SKILL_SCENE.info.summonInfo?.isOpen)).toBe(true);
  await page.evaluate(async()=>{const root='/src/';const s=(window as any).__SKILL_SCENE;const[{getRelic},{EnemyInfoPopup},{PopupLayer}]=await Promise.all([import(/* @vite-ignore */root+'data/relics.ts'),import(/* @vite-ignore */root+'ui/EnemyInfoPopup.ts'),import(/* @vite-ignore */root+'ui/PopupLayer.ts')]);s.info.popups.closeAll();s.info.hide();const def=getRelic('dian');s.enemyAuditLayer=new PopupLayer(s,2400);s.enemyAudit=new EnemyInfoPopup(s,s.enemyAuditLayer);s.enemyAudit.show({def:{...def,stats:{...def.stats,atk:450,ap:700}},level:40,breakthrough:4});});
  const passive=await page.evaluate(async()=>{const root='/src/';const{ENEMY_INFO:L}=await import(/* @vite-ignore */root+'ui/enemyInfoLayout.ts');return{x:540+L.skills.x,y:960+L.skills.y};});
  await tap(page,passive.x,passive.y);await clickTag(page,'시로');
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles??[])).toContain('소환수');
  expect(await textPoint(page,'700')).not.toBeNull();
  await captureGame(page,info.outputPath('enemy-dian-shiro.png'));
  await info.attach('browser-errors',{body:JSON.stringify(errors),contentType:'application/json'});
  expect(errors).toEqual([]);
});

test("긴 스킬 요약·조건·돌파 설명은 같은 판 안에서 겹치거나 화면 밖으로 나가지 않는다",async({page},info)=>{
  test.skip(process.env.PF_E2E_REMOTE_LOOP!=="1","소스 서버 전용");test.setTimeout(240000);
  await installGameHandleProbe(page);await startAfterOpening(page);
  await sourceScene(page,`this.game.scene.stop('title');this.game.scene.start('relics');window.__SKILL_SCENE=this.game.scene.getScene('relics');`);
  const bounds=await page.evaluate(async()=>{
    const root='/src/';const [{getRelic},{buildSkillViewModel},{openSkillPopup},{KeywordManager},{PopupLayer},{loadTextCatalog},{breakthroughEffectText}]=await Promise.all([
      import(/* @vite-ignore */root+'data/relics.ts'),import(/* @vite-ignore */root+'ui/info.ts'),import(/* @vite-ignore */root+'ui/SkillPopup.ts'),import(/* @vite-ignore */root+'managers/KeywordManager.ts'),import(/* @vite-ignore */root+'ui/PopupLayer.ts'),import(/* @vite-ignore */root+'i18n/index.ts'),import(/* @vite-ignore */root+'ui/skillPresentation.ts')]);
    await loadTextCatalog('en');const scene=(window as any).__SKILL_SCENE;scene.auditLayer=new PopupLayer(scene,2400);
    const results:any[]=[];
    for(const id of ['terisa','ella','morphe','taboa']){
      scene.auditLayer.closeAll();const def=getRelic(id),slot=id==='ella'?'basic':id==='taboa'?'ultimate':'passive';
      openSkillPopup(scene,scene.auditLayer,new KeywordManager(scene,scene.auditLayer),buildSkillViewModel({def,breakthrough:4,kindLabel:slot,skill:def[slot],slot,breakthroughEffect:breakthroughEffectText(def,slot,def.stats)}));
      const layer=scene.auditLayer.stack.at(-1),body=scene.auditLayer.bodyByLayer.get(layer);
      // 화면 내 배치 한계는 애니메이션 끝의 목표 스케일 1에서 잰다.
      scene.tweens.killTweensOf(body);scene.tweens.killTweensOf(layer);body.setScale(1);layer.setAlpha(1);
      const b=body.getBounds();results.push({id,left:b.left,right:b.right,top:b.top,bottom:b.bottom});
    }
    return results;
  });
  for(const b of bounds){expect(b.left,b.id).toBeGreaterThanOrEqual(0);expect(b.right,b.id).toBeLessThanOrEqual(1080);expect(b.top,b.id).toBeGreaterThanOrEqual(0);expect(b.bottom,b.id).toBeLessThanOrEqual(1920);}
  await info.attach('popup-bounds',{body:JSON.stringify(bounds,null,2),contentType:'application/json'});
  await captureGame(page,info.outputPath('skill-summary-and-effects.png'));
});
