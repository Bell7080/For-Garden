import { expect, test, type Page } from "@playwright/test";
import { TUTORIAL_STEPS, type TutorialStepId } from "../../src/core/tutorial";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap } from "./canvasInput";

/**
 * 첫 플레이 튜토리얼의 칸마다 화면을 굽는다 — 강조가 버튼의 실루엣을 따르는지, 강제 칸의 어둠이 누를 곳 밖을
 * 다 덮는지, 안내 글이 다른 요소를 가리지 않는지를 눈으로 본다. 상태는 실제 저장 경로로 만들고 씬만 곧장 연다.
 */
async function open(page: Page, done: number, cleared: string[], stageId?: string): Promise<void> {
  await installGameHandleProbe(page);
  await startAfterOpening(page, (s) => {
    s.tutorial = { completedStepIds: [...TUTORIAL_STEPS.slice(0, done)] as TutorialStepId[] };
    s.cleared = new Set(cleared);
    s.wallet.cheesecake = 200;
    if (stageId) s.selectedStageId = stageId;
  });
  await sourceScene(page, "window.__TW=this.game;");
}
const start = (page: Page, key: string, data: unknown) => sourceScene(page, `const g=window.__TW;for(const s of g.scene.getScenes(true))g.scene.stop(s.scene.key);g.scene.start('${key}',${JSON.stringify(data)});`);
const spot = (page: Page) => page.evaluate(() => {
  const g = (window as any).__TW; const found: string[] = [];
  for (const s of g.scene.getScenes(true)) for (const o of s.children.list) if (o.active && o.visible && o.depth >= 6000) found.push(`${s.scene.key}:${o.type}`);
  return found.length;
});
const scene = (page: Page, key: string) => (fn: string) => page.evaluate(([key, fn]) => new Function("s", `return (${fn})`)((window as any).__TW.scene.getScene(key)), [key, fn] as const);

test("1-1 궁극기 안내", async ({ page }, info) => {
  await open(page, 0, [], "1-1");
  await start(page, "battle", { mode: "stage", exitTo: "lobby" });
  await expect.poll(() => scene(page, "battle")("s.ultimateTutorial?.active === true"), { timeout: 90_000 }).toBe(true);
  await page.waitForTimeout(700);
  await captureGame(page, info.outputPath("01-ultimate.png"));
});

for (const [done, stage, name] of [[1, "1-2", "auto"], [4, "1-3", "presentation"], [5, "1-4", "speed"], [6, "1-5", "contribution"]] as const) {
  test(`전투 조작 안내 — ${name}`, async ({ page }, info) => {
    const cleared = ["1-1", "1-2", "1-3", "1-4", "1-5"].slice(0, ["1-2", "1-3", "1-4", "1-5"].indexOf(stage) + 1);
    await open(page, done, cleared, stage);
    await start(page, "battle", { mode: "stage" });
    await expect.poll(() => scene(page, "battle")("s.featureSpotlight?.active === true"), { timeout: 90_000 }).toBe(true);
    await page.waitForTimeout(500);
    await captureGame(page, info.outputPath(`02-${name}.png`));
    if (name === "speed" || name === "presentation") {
      const chip = await scene(page, "battle")(`(() => { const b = s.${name}Chip.getBounds(); return { x: b.centerX, y: b.centerY }; })()`) as { x: number; y: number };
      await tap(page, chip.x, chip.y);
      await page.waitForTimeout(500);
      await captureGame(page, info.outputPath(`02-${name}-again.png`));
    }
  });
}

test("강화 안내 — 급여 → 1레벨 → 보상", async ({ page }, info) => {
  await open(page, 2, ["1-1", "1-2"]);
  await start(page, "relics", {});
  const relics = scene(page, "relics");
  await expect.poll(() => relics("s.info?.currentDef?.id"), { timeout: 60_000 }).toBe("torika");
  await expect.poll(() => spot(page)).toBeGreaterThan(0);
  await page.waitForTimeout(600);
  await captureGame(page, info.outputPath("03-feed.png"));
  const feed = await relics("(() => { const b = s.info.feedButtonBounds(); return { x: b.centerX, y: b.centerY }; })()") as { x: number; y: number };
  await tap(page, feed.x, feed.y);
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("03-feed-hold.png"));
  await page.mouse.move(0, 0);
  // 꾹 눌러 한 번에 급여 쪽지를 연다.
  const { canvasBox, gamePoint } = await import("./canvasInput");
  const box = await canvasBox(page), p = gamePoint(box, feed.x, feed.y);
  await page.mouse.move(p.x, p.y); await page.mouse.down(); await page.waitForTimeout(1200); await page.mouse.up();
  await expect.poll(() => relics("!!s.info.feedBulkTutorialBounds()")).toBe(true);
  await page.waitForTimeout(600);
  await captureGame(page, info.outputPath("03-feed-level.png"));
  const one = await relics("(() => { const b = s.info.feedBulkTutorialBounds(); return { x: b.centerX, y: b.centerY }; })()") as { x: number; y: number };
  await tap(page, one.x, one.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.rewardPopup), { timeout: 20_000 }).toBe(true);
  await page.waitForTimeout(700);
  await captureGame(page, info.outputPath("03-feed-reward.png"));
  await tap(page, 540, 300);
  await page.waitForTimeout(1200);
  await captureGame(page, info.outputPath("03-feed-after.png"));
});

test("광장·지도·편성 안내(가리키기만)", async ({ page }, info) => {
  await open(page, 1, ["1-1"], "1-2");
  await start(page, "lobby", {});
  await expect.poll(() => spot(page), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("04-lobby.png"));
  await start(page, "stageMap", {});
  await expect.poll(() => spot(page), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1200);
  await captureGame(page, info.outputPath("04-stagemap.png"));
  await start(page, "party", {});
  await expect.poll(() => scene(page, "party")("s.partyTutorialPhase"), { timeout: 60_000 }).toBe("move");
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("04-party-move.png"));
});

test("연구소 안내", async ({ page }, info) => {
  await open(page, 8, ["1-1", "1-2", "1-3", "1-4", "1-5"]);
  await page.evaluate(() => undefined);
  await sourceScene(page, "window.__TW.registry?.set?.('noop',1);");
  await start(page, "lab", {});
  await expect.poll(() => spot(page), { timeout: 60_000 }).toBeGreaterThan(0);
  await page.waitForTimeout(1500);
  await captureGame(page, info.outputPath("05-lab.png"));
});

/** 강제 안내의 구멍 — 막 네 장(깊이 6000, 보이지 않는 입력면)이 비워 둔 상자의 가운데. 없으면 `undefined`. */
const hole = (page: Page) => page.evaluate(() => {
  const g = (window as any).__TW;
  for (const s of g.scene.getScenes(true)) {
    const blocks = s.children.list.filter((o: any) => o.type === "Rectangle" && o.depth === 6000 && o.input?.enabled && o.fillAlpha === 0 && o.width < 1080 + 1);
    if (blocks.length < 2) continue;
    const top = blocks.find((b: any) => b.y - b.height / 2 <= 0.5 && b.width >= 1079);
    const bottom = blocks.find((b: any) => b !== top && b.y + b.height / 2 >= 1919 && b.width >= 1079);
    const left = blocks.find((b: any) => b.x - b.width / 2 <= 0.5 && b.width < 1079);
    const right = blocks.find((b: any) => b.x + b.width / 2 >= 1079 && b.width < 1079);
    const t0 = top ? top.height : 0, b0 = bottom ? bottom.y - bottom.height / 2 : 1920;
    const l0 = left ? left.width : 0, r0 = right ? right.x - right.width / 2 : 1080;
    return { x: (l0 + r0) / 2, y: (t0 + b0) / 2 };
  }
  return undefined;
});
const tapHole = async (page: Page, dy = 0) => {
  await expect.poll(() => hole(page), { timeout: 30_000 }).toBeTruthy();
  await page.waitForTimeout(450);
  const at = (await hole(page))!;
  await tap(page, at.x, at.y + dy);
};
const popupTitles = (page: Page) => page.evaluate(() => [...((window as any).__PF_DEBUG?.popupTitles ?? [])] as string[]);
const textCenter = (page: Page, needle: string) => page.evaluate((needle) => {
  const g = (window as any).__TW;
  const walk = (list: any[]): any => { for (const o of list) { if (o.type === "Text" && o.visible && String(o.text).includes(needle)) return o; if (o.list) { const f = walk(o.list); if (f) return f; } } };
  for (const s of g.scene.getScenes(true)) { const o = walk(s.children.list); if (o) { const b = o.getBounds(); return { x: b.centerX, y: b.centerY }; } }
  return undefined;
}, needle);

test("룬 체험 — 세공 → 각인 → 장착", async ({ page }, info) => {
  test.setTimeout(240_000);
  const { createRuneInstance } = await import("../../src/core/runes");
  const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 3])) as never;
  const rune = createRuneInstance({ instanceId: "tutorial-rune", baseName: "체험 룬", rarity: "uncommon", part: 0, statValues: values, random: () => 0.3 });
  await installGameHandleProbe(page);
  await startAfterOpening(page, (s) => {
    s.tutorial = { completedStepIds: [...TUTORIAL_STEPS.slice(0, 8)] as TutorialStepId[], freeRuneCraft: { runeInstanceId: rune.instanceId } };
    s.cleared = new Set(["1-1", "1-2", "1-3", "1-4", "1-5"]);
    s.runeInventory = [rune];
  });
  await sourceScene(page, "window.__TW=this.game;");
  await start(page, "relics", { openRelicId: "torika" });
  const relics = scene(page, "relics");
  await expect.poll(() => relics("!!s.info?.runeSlotBounds?.(0)"), { timeout: 60_000 }).toBe(true);
  await page.waitForTimeout(1500);
  const slot = await relics("(() => { const b = s.info.runeSlotBounds(0); return { x: b.centerX, y: b.centerY, w: b.width, h: b.height }; })()") as { x: number; y: number };
  await tap(page, slot.x, slot.y);
  await page.waitForTimeout(1500);
  await expect.poll(() => hole(page), { timeout: 30_000 }).toBeTruthy();
  await page.waitForTimeout(700);
  await captureGame(page, info.outputPath("06-rune-pick.png"));
  await tapHole(page);
  await page.waitForTimeout(700);
  await captureGame(page, info.outputPath("06-rune-craft.png"));
  const doneTitle = "룬 완성";
  let engraveShot = false;
  for (let i = 0; i < 40; i += 1) {
    const titles = await popupTitles(page);
    if (titles.some((title) => title.includes(doneTitle))) break;
    if (await textCenter(page, "장착하러")) break;
    const label = await page.evaluate(() => { const g = (window as any).__TW; for (const s of g.scene.getScenes(true)) for (const o of s.children.list) if (o.type === "Text" && o.depth >= 6000 && o.visible) return String(o.text); return ""; });
    if (!engraveShot && label.includes("각인")) { await page.waitForTimeout(400); await captureGame(page, info.outputPath("06-rune-engrave.png")); engraveShot = true; }
    if (!(await hole(page))) { await page.waitForTimeout(500); continue; }
    // 각인할 줄 고르기는 두 줄을 함께 비추므로 가운데(줄 사이)가 아니라 윗줄을 누른다.
    await tapHole(page, label.includes("골라") ? -45 : 0);
    await page.waitForTimeout(500);
  }
  await expect.poll(() => textCenter(page, "장착하러"), { timeout: 20_000 }).toBeTruthy();
  await page.waitForTimeout(700);
  await captureGame(page, info.outputPath("06-rune-done.png"));
  const go = (await textCenter(page, "장착하러"))!;
  await tap(page, go.x, go.y);
  await expect.poll(() => hole(page), { timeout: 60_000 }).toBeTruthy();
  await page.waitForTimeout(900);
  await captureGame(page, info.outputPath("06-rune-slot.png"));
  await tapHole(page);
  await page.waitForTimeout(900);
  await captureGame(page, info.outputPath("06-rune-card.png"));
  await tapHole(page);
  await page.waitForTimeout(700);
  await captureGame(page, info.outputPath("06-rune-apply.png"));
  await tapHole(page);
  await expect.poll(() => hole(page), { timeout: 20_000 }).toBeFalsy();
  await expect.poll(() => relics("s.info && (window.__TW.registry, true)")).toBe(true);
  await page.waitForTimeout(900);
  await captureGame(page, info.outputPath("06-rune-equipped.png"));
});
