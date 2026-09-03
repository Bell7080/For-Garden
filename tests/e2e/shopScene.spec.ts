import { expect, test, type Page } from "@playwright/test";
import type { DebugPoint, DebugState } from "../../src/debug";
import { startAfterOpening } from "./openingSave";

/** 디버그 계약이 준 설계 좌표만 실제 FIT Canvas 좌표로 바꿔 누른다. */
async function tap(page: Page, point: DebugPoint): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await page.mouse.click(box.x + point.x / 1080 * box.width, box.y + point.y / 1920 * box.height);
}

/** 목록 안 입력 중심에서 휠을 보내 Canvas의 세로 스크롤 경로를 탄다. */
async function scroll(page: Page, point: DebugPoint, deltaY: number): Promise<void> {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await page.mouse.move(box.x + point.x / 1080 * box.width, box.y + point.y / 1920 * box.height);
  await page.mouse.wheel(0, deltaY);
}

/** Canvas 입력 좌표를 하드코딩하지 않도록 현재 최소 디버그 계약을 읽는다. */
async function controls(page: Page): Promise<NonNullable<DebugState["storefrontControls"]>> {
  return page.evaluate(() => {
    if (!window.__PF_DEBUG?.storefrontControls) throw new Error("상점 입력 계약이 준비되지 않았다");
    return window.__PF_DEBUG.storefrontControls;
  });
}

/** 저장을 통과하고 충분한 테스트 재화가 있는 로비까지 실제 타이틀 입력으로 이동한다. */
async function enterLobby(page: Page): Promise<void> {
  await startAfterOpening(page, (session) => { session.wallet.fossil = 10_000; session.wallet.amber = 100; });
  // 타이틀은 화면 전체 입력면이므로 Canvas 자체의 CSS 중앙을 사용하고 게임 좌표를 복제하지 않는다.
  const canvas = page.locator("canvas"); const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.lobby)).toBeTruthy();
}

test("로비 임무→상점→무역 순서와 두 storefront의 확정 보상 흐름을 검증한다", async ({ page }, testInfo) => {
  // SwiftShader의 기준 캡처와 대형 Puppet 로딩이 느린 CI에서도 흐름 제한과 섞이지 않게 한다.
  test.setTimeout(420_000);
  await enterLobby(page);

  // 1080×1920 캡처는 좌측 전신과 콘텐츠 레일이 서로 가리지 않는 기준 자료다.
  let input = await controls(page);
  await tap(page, input.lobby!.mission);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("임무 기록");
  await tap(page, input.lobby!.missionBack);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();

  input = await controls(page); await tap(page, input.lobby!.shop);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("shop");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopView?.category)).toBe("general");
  await page.screenshot({ path: `test-results/${testInfo.project.name}-shop-1080x1920-layout.png`, fullPage: true });

  // 세 탭은 같은 입력 계약으로 전환되며 일반 탭 복귀 뒤 긴 상품 열만 세로로 움직인다.
  input = await controls(page); await tap(page, input.shop!.tabs.enhancement);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopView?.category)).toBe("enhancement");
  await tap(page, input.shop!.tabs.rune);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopView?.category)).toBe("rune");
  await tap(page, input.shop!.tabs.general);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopView?.category)).toBe("general");
  input = await controls(page); await scroll(page, input.shop!.drag.from, 1_200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopView?.scrollY)).toBeLessThan(0);

  // 첫 행으로 되돌아가 상세판을 열고 수량을 바꾼 뒤 서버 확정 보상판까지 확인한다.
  await scroll(page, input.shop!.drag.to, -1_200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.shopView?.scrollY)).toBe(0);
  input = await controls(page); await tap(page, input.shop!.cards[0]);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["구매 확인"]);
  input = await controls(page); await tap(page, input.purchase!.plus); await tap(page, input.purchase!.confirm);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["구매 보상"]);
  await tap(page, await page.evaluate(() => window.__PF_DEBUG!.rewardPopupConfirm!));
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
  // 보상 확인 콜백의 카탈로그 재조회가 같은 포인터 release와 겹치지 않은 뒤 화면을 떠난다.
  await page.waitForTimeout(300);
  input = await controls(page); await tap(page, input.shop!.back);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");

  // 무역은 독립 씬이 아니라 로비 위 레이어지만 같은 구매·확정 보상 계약을 사용한다.
  input = await controls(page); await tap(page, input.lobby!.trade);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["무역"]);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.trade?.products.length)).toBeGreaterThan(0);
  input = await controls(page); await tap(page, input.trade!.products[0]);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["무역", "구매 확인"]);
  input = await controls(page); await tap(page, input.purchase!.confirm);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["무역", "구매 보상"]);
  await tap(page, await page.evaluate(() => window.__PF_DEBUG!.rewardPopupConfirm!));
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["무역"]);
});
