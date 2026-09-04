import { expect, test, type Page } from "@playwright/test";
import type { DebugPoint, DebugState } from "../../src/debug";
import { startAfterOpening } from "./openingSave";
import { canvasBox, captureGame, gamePoint, tap as tapGame } from "./canvasInput";

/** 디버그 계약이 준 자리를 그대로 누른다. */
async function tap(page: Page, point: DebugPoint): Promise<void> {
  await tapGame(page, point.x, point.y);
}

/** 목록 안 입력 중심에서 휠을 보내 Canvas의 세로 스크롤 경로를 탄다. */
async function scroll(page: Page, point: DebugPoint, deltaY: number): Promise<void> {
  const at = gamePoint(await canvasBox(page), point.x, point.y);
  await page.mouse.move(at.x, at.y);
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
  // 타이틀은 화면 전체가 입력면이라 한가운데를 누른다.
  await tapGame(page, 540, 960);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.lobby)).toBeTruthy();
}

test("로비 임무→상점과 교류→교환소의 분리된 진입 흐름을 검증한다", async ({ page }, testInfo) => {
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
  await captureGame(page, `test-results/${testInfo.project.name}-shop-1080x1920-layout.png`);

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

  // 교류 버튼은 새 교류 씬의 유일한 로비 진입점이고, 그 안의 고정 버튼만 교환소를 연다.
  input = await controls(page); await tap(page, input.lobby!.interaction);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("interaction");
  input = await controls(page); await tap(page, input.interaction!.exchange);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["교환소"]);
  // 일반 상점과 교류 교환소가 서로 다른 화면 수명과 제목을 가진 최종 진입 구조를 남긴다.
  await captureGame(page, `test-results/${testInfo.project.name}-interaction-exchange-entry-1080x1920.png`);
});
