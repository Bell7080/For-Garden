import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { tap, tapUntil } from "./canvasInput";
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { FRIENDS_SCREEN, friendsTabX } from "../../src/ui/friendsLayout";

const BASE = { width: 1080, height: 1920 } as const;

test("친구 화면은 친구·신청·찾기 세 탭으로 갈린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE.width / 2, BASE.height / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, LOBBY_RAIL_BOUNDS.utility.friends.x, LOBBY_RAIL_BOUNDS.utility.friends.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "friends");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `test-results/${test.info().project.name}-friends-list.png` });
  for (const [index, name] of [[1, "requests"], [2, "search"]] as const) {
    await tap(page, friendsTabX(index), FRIENDS_SCREEN.tabs.y);
    await page.waitForTimeout(1000);
    await page.screenshot({ path: `test-results/${test.info().project.name}-friends-${name}.png` });
  }
});
