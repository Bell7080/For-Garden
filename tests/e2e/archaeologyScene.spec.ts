import { expect, test, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";

/**
 * 고고학 화면과 그 상점의 눈 검사.
 *
 * **라벨 줄을 두 번 그려도 한 겹으로 남는지**가 이 편의 요점이다 — 탭을 씬에 직접 붙여 두던
 * 때는 누를 때마다 새 라벨이 옛 라벨 위에 겹쳐 글자가 두 겹으로 보였고, 그 상태로도 단위
 * 테스트는 전부 통과했다(씬 안의 표시 객체 수는 순수 규칙이 볼 수 없다).
 */

/** 지금 화면의 제목. 같은 씬이 두 자리를 맡으므로 **어느 상점인지**는 이 값이 가른다. */
function screenTitle(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.screenTitle);
}

/** 화면 이름을 읽는다. 디버그 채널은 언어를 따르지 않아 어느 언어에서나 같은 값이다. */
function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

/** 화면이 옮겨질 때까지 같은 자리를 다시 누른다. 입력면이 늦게 서는 화면이 있다. */
async function tapUntil(page: Page, x: number, y: number, target: string): Promise<void> {
  await expect.poll(async () => {
    if ((await scene(page)) === target) return target;
    await tap(page, x, y);
    return scene(page);
  }, { timeout: 30_000 }).toBe(target);
}

test("고고학의 두 탭과 고고학 상점을 연다", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await startAfterOpening(page, (session) => {
    session.wallet.fossil = 10_000;
    session.wallet.gold = 500_000;
    session.wallet.rawStone = 5_000;
  });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  // 하단 탭 첫 슬롯이 고고학이다.
  await tapUntil(page, BASE_WIDTH / 10, BASE_HEIGHT - 180 + 90, "archaeology");
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-strata.png`);

  // 판을 하나 열고 칸 몇 개를 판다 — 부순 칸에만 아래층과 보상이 드러나는지 보는 자리다.
  await tap(page, BASE_WIDTH / 2, 900);
  await page.waitForTimeout(1_500);
  for (const [col, row] of [[1, 1], [3, 0], [2, 3], [0, 4]] as const) {
    await tap(page, 340 + col * 100, 430 + row * 178);
    await page.waitForTimeout(500);
  }
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-dug.png`);

  // 라벨 줄을 **여러 번** 오간다. 한 번만 눌러 보면 겹친 것이 한 겹처럼 보인다.
  const tabY = BASE_HEIGHT - 268;
  for (let round = 0; round < 2; round += 1) {
    await tap(page, 496, tabY);
    await page.waitForTimeout(300);
    await tap(page, 200, tabY);
    await page.waitForTimeout(300);
  }
  await tap(page, 496, tabY);
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-research.png`);

  // 왼쪽 위 상점 입구 — 같은 상점 씬이 점원과 배경만 갈아 끼운다.
  await tapUntil(page, 96, 352, "shop");
  // 점원 Puppet은 ZIP을 내려받아 세우므로 첫 프레임보다 늦게 도착한다.
  await page.waitForTimeout(3_000);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-shop.png`);
});

test("고고학 상점을 다녀와도 로비 상점은 제 자리로 열린다", async ({ page }) => {
  test.setTimeout(300_000);
  // **Phaser는 데이터 없이 시작한 씬의 지난 데이터를 그대로 남긴다.** 고고학 상점을 한 번 열면
  // 로비의 `scene.start("shop")`이 그 자리를 물려받아 일반 상점 자리에 고고학 상점이 떴다.
  await startAfterOpening(page, (session) => { session.wallet.fossil = 10_000; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  // 먼저 고고학 상점을 열어 **지난 자리를 남긴다.**
  await tapUntil(page, BASE_WIDTH / 10, BASE_HEIGHT - 180 + 90, "archaeology");
  await tapUntil(page, 96, 352, "shop");
  await expect.poll(() => screenTitle(page)).toBe("고고학 상점");

  // 우하단 뒤로가기는 들어온 자리로 돌아간다.
  await tapUntil(page, 974, 1800, "archaeology");
  await tapUntil(page, BASE_WIDTH / 2, BASE_HEIGHT - 180 + 90, "lobby");

  // 로비의 상점 레일 — 자리를 넘기지 않고 들어오는 경로다.
  const shopSpot = await page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.lobby?.shop);
  expect(shopSpot).toBeTruthy();
  await tapUntil(page, shopSpot!.x, shopSpot!.y, "shop");
  await expect.poll(() => screenTitle(page)).toBe("상점");
});
