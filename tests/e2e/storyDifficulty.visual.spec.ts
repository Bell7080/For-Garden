import { expect, test } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap } from "./canvasInput";

test("스토리 난이도 선택 · 원본 코마 정예 · 전투 SUB · 해금 축하 · 재접속", async ({ page }, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  await installGameHandleProbe(page);
  await startAfterOpening(page, state => {
    state.settings.game.language = "ko";
    for (let chapter = 1; chapter <= 4; chapter++) for (let order = 1; order <= 10; order++) state.cleared.add(`${chapter}-${order}`);
    for (let order = 1; order < 10; order++) state.cleared.add(`normal:1-${order}`);
    state.selectedStageId = "1-1";
  });
  await sourceScene(page, "window.__STORY_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('stageMap');");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tap(page, 180, 200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("난이도 선택");
  await captureGame(page, info.outputPath("difficulty-picker.png"));
  // 어려움은 보통 4-10을 완료하기 전에는 선택할 수 없다.
  await tap(page, 540, 1185);
  expect(await page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").difficulty)).toBe("easy");
  await tap(page, 540, 985);
  await expect.poll(() => page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").selected)).toBe("normal:1-10");
  expect(await page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").chapterStages(1).map((s: any) => s.kind))).toEqual(Array(11).fill("battle"));
  const koma = await page.evaluate(async () => { const root = "/src/"; const stages = await import(/* @vite-ignore */root+"data/stages.ts"); const stage = stages.getBattleStage("normal:1-10"); return { ids: stage.enemies.map((e: any) => e.relicId), elite: stage.elite }; });
  expect(koma).toEqual({ ids: ["koma"], elite: true });
  await captureGame(page, info.outputPath("normal-koma-map.png"));
  await page.evaluate(async () => {
    const root = "/src/";
    const [state, api, ui, layers] = await Promise.all([import(/* @vite-ignore */root+"state/session.ts"), import(/* @vite-ignore */root+"api/FakeServer.ts"), import(/* @vite-ignore */root+"ui/StoryDifficultyPopup.ts"), import(/* @vite-ignore */root+"ui/PopupLayer.ts")]);
    for (let chapter = 1; chapter <= 4; chapter++) for (let order = 1; order <= 10; order++) if (chapter !== 4 || order !== 10) state.session.cleared.add(`normal:${chapter}-${order}`);
    const result = await api.gameApi.completeStage("normal:4-10", true);
    const scene = (window as any).__STORY_GAME.scene.getScene("stageMap");
    void ui.openStoryDifficultyUnlocked(scene, new layers.PopupLayer(scene, 3000), result.unlockedStoryDifficulty);
  });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("새로운 난이도가 열렸어요!");
  await captureGame(page, info.outputPath("hard-unlocked.png"));
  await tap(page, 540, 1205);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? [])).not.toContain("새로운 난이도가 열렸어요!");
  await tap(page, 180, 200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("난이도 선택");
  await tap(page, 540, 1185);
  await expect.poll(() => page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").selected)).toBe("hard:1-1");
  await captureGame(page, info.outputPath("hard-map.png"));
  await page.reload();
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await sourceScene(page, "window.__STORY_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('stageMap');");
  await expect.poll(() => page.evaluate(() => (window as any).__STORY_GAME.scene.getScene("stageMap").difficulty)).toBe("hard");
});

test("혼합 편성 코마만 정예 표시 · 3장 정예 크기 · 원본 레벨 상속", async ({page}, info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP !== "1", "소스 서버 전용");
  test.setTimeout(360000);
  await installGameHandleProbe(page);
  await startAfterOpening(page, state => {
    state.settings.game.language = "ko";
    for (let c=1;c<=4;c++) for (let n=1;n<=10;n++) state.cleared.add(`${c}-${n}`);
    state.cleared.add("normal:4-10");
    state.selectedStageId = "normal:4-6";
  });
  await sourceScene(page, "window.__STORY_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('party');");
  const inspect = () => page.evaluate(async () => {
    const root="/src/";
    const [{t},{getBattleStage},{ENCOUNTER_ROLE}] = await Promise.all([import(/* @vite-ignore */root+"i18n/index.ts"),import(/* @vite-ignore */root+"data/stages.ts"),import(/* @vite-ignore */root+"core/levelDesign.ts")]);
    const scene=(window as any).__STORY_GAME.scene.getScene("party");
    const labels=scene.children.list.filter((v:any)=>v.type==='Text' && v.text===t('stage.eliteMark'));
    return {puppets:scene.children.list.filter((v:any)=>v.constructor.name==='IndexedPuppetCreature').length, marks:labels.map((v:any)=>({x:v.x,y:v.y})), roles:scene.enemies.map((v:any)=>v.encounterRole), levels:getBattleStage('normal:4-6').enemies.map((v:any)=>v.level), easyLevels:getBattleStage('4-6').enemies.map((v:any)=>v.level), eliteScale:ENCOUNTER_ROLE.elite.bodyScale};
  });
  await expect.poll(async ()=>(await inspect()).marks.length,{timeout:30000}).toBe(1);
  const mixed=await inspect();
  expect(mixed.roles).toEqual(['normal','elite','normal']);
  expect(mixed.marks[0].x).toBe(540);
  expect(mixed.levels).toEqual(mixed.easyLevels);
  expect(mixed.eliteScale).toBeGreaterThan(1);
  await expect.poll(async ()=>(await inspect()).puppets,{timeout:60000}).toBeGreaterThanOrEqual(6);
  await captureGame(page, info.outputPath('mixed-koma-elite.png'));
  await page.evaluate(async()=>{const root='/src/';const {session}=await import(/* @vite-ignore */root+'state/session.ts');session.selectedStageId='hard:3-10';(window as any).__STORY_GAME.scene.getScene('party').scene.restart({content:'stage'});});
  await expect.poll(async ()=>(await inspect()).roles,{timeout:30000}).toEqual(['elite']);
  await expect.poll(async ()=>(await inspect()).marks.length,{timeout:30000}).toBe(1);
  await expect.poll(async ()=>(await inspect()).puppets,{timeout:60000}).toBeGreaterThanOrEqual(4);
  await captureGame(page, info.outputPath('chapter-three-elite.png'));
  await page.evaluate(async()=>{const root='/src/';const {session}=await import(/* @vite-ignore */root+'state/session.ts');session.selectedStageId='normal:4-6';for(let c=1;c<=4;c++)for(let n=1;n<=10;n++)session.cleared.add(`normal:${c}-${n}`);(window as any).__STORY_GAME.scene.getScene('party').scene.start('stageMap');});
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene),{timeout:30000}).toBe('stageMap');
  await page.evaluate(async()=>{const root='/src/';const {getBattleStage}=await import(/* @vite-ignore */root+'data/stages.ts');(window as any).__STORY_GAME.scene.getScene('stageMap').select(getBattleStage('normal:4-6'),true);});
  await expect.poll(()=>page.evaluate(async()=>{const root='/src/';const {t}=await import(/* @vite-ignore */root+'i18n/index.ts');const preview=(window as any).__STORY_GAME.scene.getScene('stageMap').enemyPreview;return preview.list.filter((v:any)=>v.type==='Text'&&v.text===t('stage.eliteMark')).length;}),{timeout:30000}).toBe(1);
  expect(await page.evaluate(()=>(window as any).__STORY_GAME.scene.getScene('stageMap').enemyPreview.options.title)).not.toContain('×');
  await expect.poll(()=>page.evaluate(()=>(window as any).__STORY_GAME.scene.getScene('stageMap').enemyPreview.puppets.size),{timeout:60000}).toBe(3);
  await captureGame(page, info.outputPath('mixed-koma-map.png'));
});
