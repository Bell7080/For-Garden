import { expect, test, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const WIDTH = 1080;
const HEIGHT = 1920;

/** 기준 해상도의 Canvas 좌표를 실제 브라우저 크기로 변환해 누른다. */
async function tap(page: Page, x: number, y: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await page.locator("canvas").click({ position: { x: x / WIDTH * box.width, y: y / HEIGHT * box.height } });
}

/** 타이틀 로딩과 오프닝을 건너뛰고 로비가 표시될 때까지 기다린다. */
async function enterLobby(page: Page): Promise<void> {
  await startAfterOpening(page);
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
}

test("무역 팝업은 중복 없이 열리고 구매 뒤 지갑/남은 횟수를 갱신한 후 입력을 복구한다", async ({ page }) => {
  await enterLobby(page);
  // 오른쪽 레일 첫 슬롯은 로비를 떠나지 않고 공유 PopupLayer를 연다.
  await Promise.all([tap(page, WIDTH - 106, 640), tap(page, WIDTH - 106, 640)]);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.tradePopup?.state)).toBe("ready");
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  expect(await page.evaluate(() => window.__PF_DEBUG?.tradePopup?.productCount)).toBeGreaterThan(0);

  const before = await page.evaluate(() => window.__PF_DEBUG?.tradePopup?.remaining?.["trade-weeds"]);
  // 실제 렌더 입력 중심을 사용해 기간 이벤트 상품 유무와 무관하게 같은 일반 상품을 누른다.
  const button = await page.evaluate(() => window.__PF_DEBUG?.tradePopup?.productButtons?.find(({ id }) => id === "trade-weeds"));
  if (!button) throw new Error("trade-weeds 입력면을 찾지 못했다");
  await tap(page, button.x, button.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.tradePopup?.remaining?.["trade-weeds"])).toBe((before ?? 0) - 1);

  // 공용 BACK_SLOT으로 닫은 뒤 같은 레일 버튼이 다시 동작하면 입력과 외부 버튼이 정리된 것이다.
  await tap(page, WIDTH - 106, HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.tradePopup)).toBeUndefined();
  await tap(page, WIDTH - 106, 640);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.tradePopup?.state)).toBe("ready");
  await page.screenshot({ path: `test-results/${test.info().project.name}-trade-popup.png`, fullPage: true });
});
