import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";

/** Phaser 설계 좌표를 기기별 CSS Canvas 좌표로 바꾸어 실제 사용자 입력 경로를 탄다. */
async function tapGame(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("game canvas is missing");
  await page.mouse.click(box.x + x * box.width / BASE_WIDTH, box.y + y * box.height / BASE_HEIGHT);
}

/** 타이틀에서 기본 작전의 편성 화면까지 공용 UI만 눌러 이동한다. */
async function openParty(page: Page): Promise<void> {
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await tapGame(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 180);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("party");
}

test("도디·메테의 도감 전신과 루카 포함 편성·전투 SD 에셋을 한 흐름에서 고정한다", async ({ page }, testInfo) => {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("relics");

  // 개체번호순 기본 도감에서 도디는 첫 카드, 메테는 기본 보유 구역의 여섯 번째 카드다.
  await tapGame(page, 200, 620);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.infoOpen)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-asset-dodi-catalog-fullbody.png`, fullPage: true });
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await tapGame(page, 880, 1094);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.infoOpen)).toBe(true);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-asset-mette-catalog-fullbody.png`, fullPage: true });
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);

  // 로비로 돌아온 뒤 도디·메테·루카를 직접 골라 편성 SD와 같은 조합의 전투 SD를 연속 캡처한다.
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await openParty(page);
  for (const [x, y] of [[964, 1080], [116, 1358], [752, 1080]] as const) await tapGame(page, x, y);
  await page.waitForTimeout(1_000); // 비동기 Puppet 조립이 캡처 전에 세 자리를 모두 채우게 한다.
  await page.screenshot({ path: `test-results/${testInfo.project.name}-asset-dodi-mette-luka-party-sd.png`, fullPage: true });
  await tapGame(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("battle");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.battle?.playerOrder)).toEqual(["도디", "메테", "루카"]);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-asset-dodi-mette-luka-battle-sd.png`, fullPage: true });
});
