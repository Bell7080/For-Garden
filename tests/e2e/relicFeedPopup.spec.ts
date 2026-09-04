import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { FEED_UNIT, relicExpToNext } from "../../src/core/relicProgression";
import { startAfterOpening } from "./openingSave";
import { canvasBox, captureGame, gamePoint, tapUntil } from "./canvasInput";

/** Convert stable Phaser design coordinates into the browser's scaled canvas coordinates. */
async function gamePointOf(page: Page, x: number, y: number): Promise<{ x: number; y: number }> {
  return gamePoint(await canvasBox(page), x, y);
}

/** Click one design-space point without repeating canvas scaling at each call site. */
async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const point = await gamePointOf(page, x, y);
  await page.mouse.click(point.x, point.y);
}

/** Open the first owned relic through the same pointer path a player uses. */
async function openOwnedRelic(page: Page): Promise<void> {
  await clickGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 로비는 이름이 바뀐 뒤에도 하단 탭의 입력면을 마저 만든다 — 될 때까지 다시 누른다.
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");
  // 카드도 그리드가 원화를 마저 세운 뒤에 입력면을 갖는다 — 정보창이 열릴 때까지 다시 누른다.
  await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
}

test.beforeEach(async ({ page }) => {
  await startAfterOpening(page, (session) => {
    // Put the first serving exactly on an EXP boundary and retain enough currency for follow-up actions.
    //
    // 애착 렐릭 하나만 준비하면 안 된다 — 이 편이 여는 것은 도감의 **첫 카드**이고, 그것이 애착
    // 렐릭이라는 보장이 없다. 준비되지 않은 렐릭을 열면 짧은 탭의 급여가 실제로 성사되지 않아
    // (경험치가 그대로라) 성장 팝업이 뜨지 않는다. 보유한 전부를 같은 경계에 세워 둔다.
    for (const id of session.owned) {
      const progress = session.relicProgress[id];
      if (progress) progress.exp = relicExpToNext(progress.level) - FEED_UNIT.exp;
    }
    session.wallet.cheesecake = 10_000;
  });
  await openOwnedRelic(page);
});

test("짧은 급여 탭 뒤 성장 팝업이 유지되고 외부 입력으로만 닫힌다", async ({ page }, testInfo) => {
  // 급여는 되풀이하면 실제로 여러 번 먹이고 판도 열렸다 닫힌다 — 다시 누르지 않고, 정보창이
  // 원화·스킬을 마저 세울 틈만 두고 한 번 누른다.
  await page.waitForTimeout(700);
  const feed = await gamePointOf(page, 766, 524);
  await page.mouse.click(feed.x, feed.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);

  // Releasing has already happened; an internal blank/header tap must not reach the backdrop.
  const inside = await gamePointOf(page, 766, 650);
  await page.mouse.click(inside.x, inside.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  // Keep a mobile visual regression artifact for the newly-visible growth action note.
  await captureGame(page, `test-results/${testInfo.project.name}-relic-feed-growth-popup.png`);

  const outside = await gamePointOf(page, 120, 1200);
  await page.mouse.click(outside.x, outside.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
});

test("긴 누르기 반복 급여는 손을 뗀 뒤 팝업을 한 장만 연다", async ({ page }) => {
  const feed = await gamePointOf(page, 766, 524);
  await page.mouse.move(feed.x, feed.y);
  await page.mouse.down();
  await page.waitForTimeout(760);
  // The repeat gesture must not create a popup under the held pointer.
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length)).toBe(1);
});
