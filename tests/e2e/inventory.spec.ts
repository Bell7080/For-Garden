import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const WIDTH = 1080; const HEIGHT = 1920;

/** 기준 게임 좌표를 현재 FIT 캔버스 좌표로 변환한다. */
async function tap(page: import("@playwright/test").Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas"); const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({ position: { x: x / WIDTH * box.width, y: y / HEIGHT * box.height } });
}

test("가방은 로비를 유지하고 카테고리 탭과 많은 항목 스크롤 입력을 받는다", async ({ page }) => {
  await startAfterOpening(page, (state) => {
    // 저장 검증을 통과하는 실제 두 스택으로 카테고리 전환과 목록 행을 준비한다.
    state.itemInventory = [{ itemId: "stamina-tonic", quantity: 10 }, { itemId: "rune-dust", quantity: 500 }];
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, WIDTH - 106, 1096);
  // 팝업이 화면을 바꾸지 않는 것이 발굴·무역과 같은 로비 오버레이 계약이다.
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.mouse.wheel(0, 1200);
  await page.screenshot({ path: `test-results/${test.info().project.name}-inventory-popup.png`, fullPage: true });
});
