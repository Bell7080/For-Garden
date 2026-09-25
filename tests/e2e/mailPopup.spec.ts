import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { tap, tapUntil } from "./canvasInput";
// 자리는 화면이 소유한 배치표에서 읽는다 — 좌표를 스펙에 베껴 두면 줄이 옮겨질 때 조용히 빗나간다.
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { MAIL_DETAIL_LAYOUT, MAIL_POPUP_LAYOUT, mailListRows, mailTabX } from "../../src/ui/mailPopupLayout";

const BASE = { width: 1080, height: 1920 } as const;
test("우편함은 우편과 안내로 갈리고, 우편을 받으면 재화가 늘고 안내를 열면 읽음이 된다", async ({ page }) => {
  await startAfterOpening(page); await tap(page, BASE.width / 2, BASE.height / 2); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const goldBefore = await page.evaluate(() => window.__PF_DEBUG?.wallet?.gold);
  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.mail.x, LOBBY_RAIL_BOUNDS.utility.mail.y, async () => Boolean(await page.evaluate(() => window.__PF_DEBUG?.mailPopup?.open)));
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.mailPopup)).toMatchObject({ open: true, unreadCount: 4, claimableCount: 2 });
  await page.screenshot({ path: `test-results/${test.info().project.name}-mail-reward.png` });
  const { viewport, footer } = MAIL_POPUP_LAYOUT;
  // 맨 위 우편(개척 지원 보급 상자)을 눌러 펼친다 — 줄에는 받기가 없고, 펼친 판 아래에서 받는다.
  await tap(page, BASE.width / 2, BASE.height / 2 + viewport.top + mailListRows("reward", 1).centers[0]);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length ?? 0)).toBe(2);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/${test.info().project.name}-mail-detail.png` });
  await tap(page, BASE.width / 2, BASE.height / 2 + MAIL_DETAIL_LAYOUT.claim.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.gold)).toBe((goldBefore ?? 0) + 50_000);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.mailPopup)).toMatchObject({ claimableCount: 1 });
  // 영수증은 화면 아무 곳이나 눌러 닫는다.
  await tap(page, BASE.width / 2, BASE.height / 2);
  // 안내 탭으로 옮겨 맨 위 안내를 열면 읽음이 된다.
  await tap(page, BASE.width / 2 + mailTabX(1), BASE.height / 2 + footer.tabY);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/${test.info().project.name}-mail-notice.png` });
  const unread = await page.evaluate(() => window.__PF_DEBUG?.mailPopup?.unreadCount ?? 0);
  await tap(page, BASE.width / 2, BASE.height / 2 + viewport.top + mailListRows("notice", 1).centers[0]);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.mailPopup?.unreadCount)).toBe(unread - 1);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `test-results/${test.info().project.name}-mail-notice-open.png` });
});
