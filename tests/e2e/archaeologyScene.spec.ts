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
