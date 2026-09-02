import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { FEED_UNIT, relicExpToNext } from "../../src/core/relicProgression";
import { startAfterOpening } from "./openingSave";

/** Convert stable Phaser design coordinates into the browser's scaled canvas coordinates. */
async function gamePoint(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("game canvas is missing");
  return { x: box.x + x * box.width / BASE_WIDTH, y: box.y + y * box.height / BASE_HEIGHT };
}

/** Click one design-space point without repeating canvas scaling at each call site. */
async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const point = await gamePoint(page, x, y);
  await page.mouse.click(point.x, point.y);
}

/** Open the first owned relic through the same pointer path a player uses. */
async function openOwnedRelic(page: Page): Promise<void> {
  await clickGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await clickGame(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("relics");
  await clickGame(page, 200, 620);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.infoOpen)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // Put the first serving exactly on an EXP boundary and retain enough currency for follow-up actions.
    const id = session.favorite;
    session.relicProgress[id].exp = relicExpToNext(session.relicProgress[id].level) - FEED_UNIT.exp;
    session.wallet.cheesecake = 10_000;
  });
  await openOwnedRelic(page);
});

test("짧은 급여 탭 뒤 성장 팝업이 유지되고 외부 입력으로만 닫힌다", async ({ page }, testInfo) => {
  const feed = await gamePoint(page, 766, 524);
  await page.mouse.click(feed.x, feed.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);

  // Releasing has already happened; an internal blank/header tap must not reach the backdrop.
  const inside = await gamePoint(page, 766, 650);
  await page.mouse.click(inside.x, inside.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  // Keep a mobile visual regression artifact for the newly-visible growth action note.
  await page.screenshot({ path: `test-results/${testInfo.project.name}-relic-feed-growth-popup.png`, fullPage: true });

  const outside = await gamePoint(page, 120, 1200);
  await page.mouse.click(outside.x, outside.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
});

test("긴 누르기 반복 급여는 손을 뗀 뒤 팝업을 한 장만 연다", async ({ page }) => {
  const feed = await gamePoint(page, 766, 524);
  await page.mouse.move(feed.x, feed.y);
  await page.mouse.down();
  await page.waitForTimeout(760);
  // The repeat gesture must not create a popup under the held pointer.
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length)).toBe(1);
});
