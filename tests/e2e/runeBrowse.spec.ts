import { expect, test, type Page } from "@playwright/test";
import { createRuneInstance, type RuneStatKey } from "../../src/core/runes";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil, waitForCanvasInputFrame } from "./canvasInput";
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { INVENTORY_LAYOUT, inventoryGridPosition } from "../../src/managers/InventoryManager";
import { RUNE_LIST_CONTROLS } from "../../src/ui/runeListControlsLayout";

const W = 1080;
const H = 1920;
/** 가방 룬 탭의 첫 칸 — `InventoryPopup`의 목록 윗변(조작 두 줄 아래)에서 한 칸 반 아래다. */
const RUNE_LIST_TOP = -622 - RUNE_LIST_CONTROLS.rowHeight / 2 + RUNE_LIST_CONTROLS.height + 18;

function cardCenter(index: number): { x: number; y: number } {
  const { x, y } = inventoryGridPosition(index);
  return { x: W / 2 + x, y: H / 2 + RUNE_LIST_TOP + INVENTORY_LAYOUT.cellHeight / 2 + y };
}

const titles = (page: Page) => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? []);

test("가방에서 연 룬 쪽지·세공 판은 가방 순서대로 좌우로 넘어가고 끝에서 멈춘다", async ({ page }, testInfo) => {
  await startAfterOpening(page, (session) => {
    const values = Object.fromEntries(["hp", "atk", "ap", "def", "res", "moveSpeed", "attackSpeed", "lifeSteal", "critChance", "critDamage", "ferocityGain", "energyGain"].map((key) => [key, 10])) as Record<RuneStatKey, number>;
    session.runeInventory = (["uncommon", "rare", "epic", "legendary"] as const).map((rarity, index) =>
      ({ ...createRuneInstance({ instanceId: `browse-${index}`, baseName: `넘김 ${index + 1}`, rarity, part: (index % 3) as 0 | 1 | 2, statValues: values, random: () => 0 }), customName: `넘김 ${index + 1}` }));
    session.wallet.gold = 5_000_000;
  });
  await page.setViewportSize({ width: 540, height: 960 });
  await tapUntil(page, W / 2, H / 2, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "lobby");
  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.inventory.x, LOBBY_RAIL_BOUNDS.utility.inventory.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.inventoryCategory)) === "rune");
  await page.waitForTimeout(800);
  const first = cardCenter(0);
  await tap(page, first.x, first.y);
  await expect.poll(() => titles(page)).toContain("룬");
  await captureGame(page, `test-results/${testInfo.project.name}-rune-browse-note.png`);
  // 쪽지에서 세공으로.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.runeNoteCraft !== undefined)).toBe(true);
  const craft = (await page.evaluate(() => window.__PF_DEBUG!.runeNoteCraft!))!;
  await tap(page, craft.x, craft.y);
  await expect.poll(() => titles(page)).toContain("룬 세공");
  await captureGame(page, `test-results/${testInfo.project.name}-rune-browse-craft-1.png`);
  // 오른쪽 꺾쇠 → 두 번째 룬, 방향키 → 세 번째, 쓸어 넘기기 → 네 번째.
  await tap(page, W - 34, H / 2 + 0);
  await page.waitForTimeout(500);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-browse-craft-2.png`);
  await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(500);
  const box = (await page.locator("canvas").boundingBox())!;
  const sx = (x: number) => box.x + (x * box.width) / W;
  const sy = (y: number) => box.y + (y * box.height) / H;
  await page.mouse.move(sx(800), sy(500));
  await page.mouse.down();
  await page.mouse.move(sx(500), sy(510), { steps: 6 });
  await page.mouse.move(sx(300), sy(515), { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-browse-craft-4.png`);
  // 끝에서는 멈춘다 — 세공 판은 그대로 하나다.
  await page.keyboard.press("ArrowRight");
  await waitForCanvasInputFrame(page);
  expect((await titles(page)).filter((title) => title === "룬 세공")).toHaveLength(1);
  await captureGame(page, `test-results/${testInfo.project.name}-rune-browse-craft-end.png`);
});
