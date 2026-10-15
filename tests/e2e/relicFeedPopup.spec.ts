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

test("급여를 누르는 순간 보조 버튼이 뜨고 외부 입력으로만 닫힌다", async ({ page }, testInfo) => {
  // 급여는 되풀이하면 실제로 여러 번 먹이고 판도 열렸다 닫힌다 — 다시 누르지 않고, 정보창이
  // 원화·스킬을 마저 세울 틈만 두고 한 번 누른다.
  // 급여 버튼 자리는 화면이 알려 준다 — 레벨 칸의 줄 구성이 바뀌면 좌표가 함께 움직인다.
  await page.waitForTimeout(900);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.feedButton !== undefined), { timeout: 15_000 }).toBe(true);
  const spot = (await page.evaluate(() => window.__PF_DEBUG!.feedButton!))!;
  const feed = await gamePointOf(page, spot.x, spot.y);
  await page.mouse.move(feed.x, feed.y);
  await page.mouse.down();
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);

  // Releasing has already happened; an internal blank/header tap must not reach the backdrop.
  const inside = await gamePointOf(page, 766, 640);
  await page.mouse.click(inside.x, inside.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  // Keep a mobile visual regression artifact for the newly-visible growth action note.
  await captureGame(page, `test-results/${testInfo.project.name}-relic-feed-growth-popup.png`);

  const outside = await gamePointOf(page, 120, 1200);
  await page.mouse.click(outside.x, outside.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
});

test("보조 버튼이 열린 상태에서도 길게 누르기와 연타가 이어진다", async ({ page }) => {
  await page.waitForTimeout(900);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.feedButton !== undefined), { timeout: 15_000 }).toBe(true);
  const spot = (await page.evaluate(() => window.__PF_DEBUG!.feedButton!))!;
  const feed = await gamePointOf(page, spot.x, spot.y);
  await page.mouse.move(feed.x, feed.y);
  await page.mouse.down();
  // 속도 수치는 순수 경과 시간 테스트가 검증한다. 소프트웨어 GPU에서는 고정 대기 시간 대신
  // 실제 반복 입력이 처리됐는지 기다려 입력 통과와 싱글턴 쪽지의 유지 여부를 확인한다.
  await expect.poll(async () => (await page.evaluate(() => window.__PF_DEBUG?.feedTaps))?.served ?? 0, { timeout: 15_000 }).toBeGreaterThan(12);
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["한 번에 급여"]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length)).toBe(1);
});

test("급여 버튼을 연달아 두드리면 누른 것을 하나도 버리지 않고 모두 먹인다", async ({ page }) => {
  await page.waitForTimeout(900);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.feedButton !== undefined), { timeout: 15_000 }).toBe(true);
  const spot = (await page.evaluate(() => window.__PF_DEBUG!.feedButton!))!;
  const feed = await gamePointOf(page, spot.x, spot.y);
  const taps = 8;
  // 서버 응답(가짜 지연)보다 빠르게 두드린다 — 예전에는 요청이 도는 동안의 누름이 버려졌다.
  for (let index = 0; index < taps; index += 1) {
    await page.mouse.click(feed.x, feed.y);
    await page.waitForTimeout(60);
  }
  expect((await page.evaluate(() => window.__PF_DEBUG?.feedTaps))?.served).toBe(taps);
  // 보조 쪽지가 열려 있어도 원래 급여 입력이 통과하고, 누른 수만큼 서버에서 확정된다.
  await expect
    .poll(async () => {
      const count = await page.evaluate(() => window.__PF_DEBUG?.feedTaps);
      return count !== undefined && count.served > 0 && count.served === count.confirmed;
    }, { timeout: 30_000 })
    .toBe(true);
});
