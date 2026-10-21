import { expect, test, type Page } from "@playwright/test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { createInitialRelicProgress } from "../../src/state/session";
import { TUTORIAL_STEPS } from "../../src/core/tutorial";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { canvasBox, gamePoint, tap, captureGame } from "./canvasInput";

let dir: string, createFixture: typeof import("../helpers/remoteBattleFixture").createFixture;
test.beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "fg-tutorial-"));
  const file = join(dir, "fixture.mjs");
  await build({ entryPoints: ["tests/helpers/remoteBattleFixture.ts"], outfile: file, bundle: true, platform: "node", format: "esm", define: { "import.meta.env": "{}", "import.meta.env.MODE": '"production"', "import.meta.env.DEV": "false", "import.meta.env.PROD": "true" } });
  createFixture = (await import(pathToFileURL(file).href)).createFixture;
});
test.afterAll(async () => { if (dir) await rm(dir, { recursive: true, force: true }); });
async function open(page: Page, step: "navigation" | "feed" | "research") {
  const server = createFixture("stage", s => {
    s.playerCard.nickname = "테스트연구원";
    s.tutorial = { completedStepIds: [...TUTORIAL_STEPS.slice(0, step === "navigation" ? 1 : step === "feed" ? 2 : 7)] };
    s.cleared = new Set(step === "navigation" ? ["1-1"] : step === "feed" ? ["1-1", "1-2"] : ["1-1", "1-2", "1-3", "1-4", "1-5"]);
    s.wallet.fossil = 0; s.wallet.cheesecake = 200;
    for (const id of s.owned) s.relicProgress[id] = createInitialRelicProgress();
    s.selectedStageId = "1-2";
  });
  await page.exposeFunction("__TUTORIAL_CALL", server.call);
  await installGameHandleProbe(page); await startAfterOpening(page);
  await page.evaluate(async () => {
    const root = "/src/";
    const [fake, remote, state, saves, progress] = await Promise.all([import(/* @vite-ignore */root+"api/FakeServer.ts"), import(/* @vite-ignore */root+"api/RemoteGameApi.ts"), import(/* @vite-ignore */root+"state/session.ts"), import(/* @vite-ignore */root+"state/SaveManager.ts"), import(/* @vite-ignore */root+"api/serverProgress.ts")]);
    const api = remote.createRemoteGameApi({ getAccessToken: async () => "isolated-tutorial", applyState: (next: unknown) => progress.applyServerState(state.session, next, saves.saveManager), fetchImpl: async (_url: unknown, init: RequestInit) => {
      const r = await (window as any).__TUTORIAL_CALL(JSON.parse(String(init.body)));
      return new Response(JSON.stringify(r.body), { status: r.status });
    } });
    fake.installGameApi(api); await api.getPlayerState();
  });
  await sourceScene(page, `window.__TUTORIAL_GAME=this.game;this.game.scene.stop('title');this.game.scene.start('${step === "feed" ? "relics" : "lobby"}');`);
  return server;
}
async function clickText(page: Page, key: string) {
  const point = await expect.poll(async () => page.evaluate(async key => {
    const root = "/src/"; const {t} = await import(/* @vite-ignore */root+"i18n/index.ts"); const label = t(key);
    let p: any = null;
    const walk = (v: any) => { if (v.visible === false || v.active === false) return; if (v.type === "Text" && v.text === label) { const b=v.getBounds(); p={x:b.centerX,y:b.centerY}; } for(const c of v.list??[])walk(c); };
    for (const s of (window as any).__TUTORIAL_GAME.scene.getScenes(true)) walk({list:s.children.list});
    return p;
  }, key), { timeout: 30000 }).not.toBeNull();
  void point;
  const p = await page.evaluate(async key => {
    const root = "/src/"; const {t} = await import(/* @vite-ignore */root+"i18n/index.ts"); const label=t(key);let p:any;
    const walk=(v:any)=>{if(v.visible===false||v.active===false)return;if(v.type==='Text'&&v.text===label){const b=v.getBounds();p={x:b.centerX,y:b.centerY};}for(const c of v.list??[])walk(c);};
    for(const s of (window as any).__TUTORIAL_GAME.scene.getScenes(true))walk({list:s.children.list});return p;
  },key);await tap(page,p.x,p.y);
}
async function scenePoint(page: Page, scene: string, field: string) {
  return page.evaluate(({scene,field})=>{const s=(window as any).__TUTORIAL_GAME.scene.getScene(scene);const b=s[field].getBounds();return {x:b.centerX,y:b.centerY};},{scene,field});
}

test("1-1 광장 → 출격 → 1-2 편성 이동·길게 눌러 정보 확인", async ({page},info) => {
  test.skip(process.env.PF_E2E_REMOTE_LOOP!=="1","소스 서버 전용");test.setTimeout(240000);
  const server=await open(page,"navigation");
  await clickText(page,"lobby.sortie");await clickText(page,"lobby.sortie.story");
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe("stageMap");
  const p=await scenePoint(page,"stageMap","sortieButton");await tap(page,p.x,p.y);
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe("party");
  await expect.poll(()=>page.evaluate(()=>(window as any).__TUTORIAL_GAME.scene.getScene('party').partyTutorialPhase)).toBe('move');
  const slots=await page.evaluate(()=>{const s=(window as any).__TUTORIAL_GAME.scene.getScene('party');return s.allySlots.map((v:any)=>{const b=v.hit.getBounds();return {x:b.centerX,y:b.centerY};});});
  const box=await canvasBox(page), from=gamePoint(box,slots[0].x,slots[0].y),to=gamePoint(box,slots[1].x,slots[1].y);
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.mouse.move(to.x,to.y,{steps:10});await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>(window as any).__TUTORIAL_GAME.scene.getScene('party').partyTutorialPhase)).toBe('hold');
  await page.mouse.move(from.x,from.y);await page.mouse.down();await page.waitForTimeout(1200);await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>(window as any).__TUTORIAL_GAME.scene.getScene('party').info.isOpen)).toBe(true);
  await captureGame(page,info.outputPath('formation-information.png'));
  await tap(page,974,1800);
  await expect.poll(()=>page.evaluate(()=>(window as any).__TUTORIAL_GAME.scene.getScene('party').partyTutorialPhase)).toBe('start');
  expect(server.calls.filter(c=>c.status!==200)).toEqual([]);
});

test("1-2 후 토리카 일반·1레벨 강화 → 단계 서버 저장 → 광장 복귀",async({page},info)=>{
  test.skip(process.env.PF_E2E_REMOTE_LOOP!=="1","소스 서버 전용");test.setTimeout(240000);
  const server=await open(page,"feed");
  await expect.poll(()=>page.evaluate(()=>(window as any).__TUTORIAL_GAME.scene.getScene('relics').info.currentDef?.id)).toBe('torika');
  const pos=await page.evaluate(()=>{const b=(window as any).__TUTORIAL_GAME.scene.getScene('relics').info.feedButtonBounds();return{x:b.centerX,y:b.centerY};});
  await tap(page,pos.x,pos.y);
  await expect.poll(()=>server.state().tutorial?.completedStepIds.includes('feed')).toBe(true);
  const box=await canvasBox(page),p=gamePoint(box,pos.x,pos.y);await page.mouse.move(p.x,p.y);await page.mouse.down();await page.waitForTimeout(1200);await page.mouse.up();
  await expect.poll(()=>page.evaluate(()=>!!(window as any).__TUTORIAL_GAME.scene.getScene('relics').info.feedBulkTutorialBounds())).toBe(true);
  const one=await page.evaluate(()=>{const b=(window as any).__TUTORIAL_GAME.scene.getScene('relics').info.feedBulkTutorialBounds();return{x:b.centerX,y:b.centerY};});
  await tap(page,one.x,one.y);
  await expect.poll(()=>server.state().tutorial?.completedStepIds.includes('feedLevel')).toBe(true);
  await expect.poll(()=>page.evaluate(()=>(window as any).__TUTORIAL_GAME.scene.getScene('relics').info.isOpen)).toBe(false);
  expect(server.state().relicProgress.torika.level).toBeGreaterThan(1);
  await captureGame(page,info.outputPath('training-return.png'));
  await clickText(page,'nav.lobby');await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('lobby');
  expect(server.calls.filter(c=>c.status!==200)).toEqual([]);
});

test("1-5 후 연구 개방 → 지원품 1회 지급 → 첫 10회 연구",async({page},info)=>{
  test.skip(process.env.PF_E2E_REMOTE_LOOP!=="1","소스 서버 전용");test.setTimeout(300000);
  const server=await open(page,"research");
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.popupTitles)).toContain('복원 연구 개방');
  await captureGame(page,info.outputPath('research-unlocked.png'));
  await clickText(page,'settings.action.confirm');
  await expect.poll(()=>server.state().wallet.fossil).toBe(8);
  await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.rewardPopup)).toBe(true);
  await tap(page,540,250);
  await expect.poll(()=>page.evaluate(()=>!!window.__PF_DEBUG?.rewardPopup)).toBe(false);
  await page.waitForFunction(()=>!(window as any).__TUTORIAL_GAME.scene.getScene('lobby').children.list.some((v:any)=>v.active&&v.depth===100000));
  await clickText(page,'nav.lab');await expect.poll(()=>page.evaluate(()=>window.__PF_DEBUG?.scene)).toBe('lab');
  const p=await scenePoint(page,'lab','tenButton');await tap(page,p.x,p.y);
  await expect.poll(()=>server.state().tutorial?.completedStepIds.includes('pull'),{timeout:60000}).toBe(true);
  expect(server.state().wallet.fossil).toBe(0);
  expect(server.calls.filter(c=>c.method==='pullRelics')).toHaveLength(1);
  expect(server.calls.filter(c=>c.status!==200)).toEqual([]);
  await info.attach('server-calls',{body:JSON.stringify(server.calls,null,2),contentType:'application/json'});
});
