import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapAndWait } from "./canvasInput";
import { LOBBY_MENU_BUTTON, lobbyMenuTrayLayout } from "../../src/ui/lobbyMenuLayout";
import { ACHIEVEMENT_CATEGORIES } from "../../src/data/achievements";
import { ACHIEVEMENTS_POPUP_LAYOUT, achievementsTabStrip } from "../../src/ui/achievementsPopupLayout";
import { tabStripScrollFor, tabStripSpotX } from "../../src/core/tabStrip";

const WIDTH = 1080; const HEIGHT = 1920;

test("로비 메뉴의 업적 칩은 업적 창을 연다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    // 받을 단계·진행 중·다 밟은 줄이 섞여 서도록 값을 둔다.
    saved.wallet.gold = 2_400_000;
    saved.achievements = { claimed: { greetings: 4 }, goldPeak: 2_400_000 };
    saved.missions = { ...saved.missions, lifetime: { battle_completed: 64, lobby_interaction: 600, salary_given: 12 } };
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const { chips } = lobbyMenuTrayLayout(2);
  await tap(page, LOBBY_MENU_BUTTON.x, LOBBY_MENU_BUTTON.y);
  await tapAndWait(page, chips[1].x, chips[1].y, () => window.__PF_DEBUG?.popupTitles, ["업적"]);
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${test.info().project.name}-achievements-popup.png`);
  // 마지막 갈래(기록) — 단발·숨은 업적이 선다. 탭 줄은 옆으로 흐르므로 보이는 칸을 눌러 한 걸음씩 옮긴다.
  const spec = achievementsTabStrip();
  let selected = 0;
  for (const index of [3, 5, ACHIEVEMENT_CATEGORIES.indexOf("feat") + 1]) {
    await tap(page, WIDTH / 2 + tabStripSpotX(spec, index) + tabStripScrollFor(spec, selected), HEIGHT / 2 + ACHIEVEMENTS_POPUP_LAYOUT.footer.tabY);
    selected = index;
    await page.waitForTimeout(400);
  }
  await captureGame(page, `test-results/${test.info().project.name}-achievements-feat.png`);
});
