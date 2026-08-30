import { expect, test, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const BASE = { width: 1080, height: 1920 } as const;
/** 게임 논리 좌표를 반응형 Canvas의 실제 좌표로 변환한다. */
async function tap(page: Page, x: number, y: number): Promise<void> { const box = await page.locator("canvas").boundingBox(); if (!box) throw new Error("캔버스를 찾지 못했다"); await page.locator("canvas").click({ position: { x: x / BASE.width * box.width, y: y / BASE.height * box.height } }); }

test("우편 점에서 우편함을 열어 보상을 받고 재화 증가와 점 해제를 확인한다", async ({ page }) => {
  await startAfterOpening(page); await tap(page, BASE.width / 2, BASE.height / 2); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const goldBefore = await page.evaluate(() => window.__PF_DEBUG?.wallet?.gold);
  // 우편은 오른쪽 레일의 두 번째 행이며 초기 미읽음 데이터가 알림 점을 켠다.
  await tap(page, BASE.width - 106, 792); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.mailPopup)).toMatchObject({ open: true, unreadCount: 2, claimableCount: 1 });
  // 첫 행의 공용 RewardFrame을 눌러 단일 수령하고 TopBar와 알림 집계를 함께 갱신한다.
  await tap(page, BASE.width / 2 - 80, BASE.height / 2 - 570); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.gold)).toBe((goldBefore ?? 0) + 1200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.mailPopup)).toMatchObject({ unreadCount: 1, claimableCount: 0 });
  // 남은 무첨부 안내 행을 열람하면 마지막 우편 점도 해제된다.
  await tap(page, BASE.width / 2 - 80, BASE.height / 2 - 570 + 280); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.mailPopup?.unreadCount)).toBe(0);
});
