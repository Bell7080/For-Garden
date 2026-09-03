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

test("상점 레일은 독립 ShopScene을 열고 공용 뒤로가기로 로비에 복귀한다", async ({ page }) => {
  // 소프트웨어 WebGL 환경에서는 세 장의 모바일 캡처가 기본 제한을 넘을 수 있어 이 시각 회귀만 여유를 둔다.
  test.setTimeout(240_000);
  await enterLobby(page);
  // 왼쪽 콘텐츠 레일의 임무 아래 두 번째 슬롯과 오른쪽 가방 레일을 시각 회귀 자료로 남긴다.
  await page.screenshot({ path: `test-results/${test.info().project.name}-lobby-content-rail.png`, fullPage: true });
  await tap(page, 106, 792);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("shop");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.screenTitle)).toBe("무역소");
  await page.screenshot({ path: `test-results/${test.info().project.name}-shop-scene.png`, fullPage: true });

  // 상품 카드는 즉시 차감하지 않고 공용 구매 확인판을 열어 수량과 총가격을 먼저 보여 준다.
  await tap(page, 730, 475);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("구매 확인");
  await page.screenshot({ path: `test-results/${test.info().project.name}-purchase-popup.png`, fullPage: true });
  // 서버 성공 뒤 구매 작업판이 사라지고 더 높은 공용 보상 영수증만 남는지 실제 흐름으로 확인한다.
  await tap(page, WIDTH / 2, 1305);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["구매 보상"]);
  await page.screenshot({ path: `test-results/${test.info().project.name}-shop-reward-popup.png`, fullPage: true });
  // 보상 팝업을 닫은 뒤 최신 목록을 다시 그릴 시간을 준 다음 화면 공용 뒤로가기를 누른다.
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual([]);

  // 독립 씬도 공용 BACK_SLOT을 사용해 원래 로비로 돌아간다.
  await tap(page, WIDTH - 106, HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});
