import { expect, test } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil } from "./canvasInput";
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { GUILD_EDITOR, GUILD_SCREEN } from "../../src/ui/guildLayout";

/** 길드를 만들고 처음 들어온 날 뜨는 출석 도장판 — 칸마다 그날 보상 액자 + 길드 코인 액자가 선다. */
test("길드 출석판은 코인을 글이 아니라 액자로 붙인다", async ({ page }, testInfo) => {
  await startAfterOpening(page, (saved) => {
    saved.wallet.gems = 50_000;
    if (saved.attendance) saved.attendance.autoShownDay = new Date().toISOString().slice(0, 10);
  });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  const guild = LOBBY_RAIL_BOUNDS.utility.guild;
  await tapUntil(page, guild.x, guild.y, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "guild");
  await tapUntil(page, GUILD_SCREEN.side + GUILD_SCREEN.width - 100, GUILD_SCREEN.controls.y,
    async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length > 0);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2 + GUILD_EDITOR.nameInput);
  await page.keyboard.type("Garden");
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2 + GUILD_EDITOR.submit);
  await page.waitForTimeout(1200);
  await captureGame(page, testInfo.outputPath("guild-after-submit.png"));
  // 확인 창이 떴다면 확정한다(오른쪽 버튼).
  const titles = await page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? []);
  if (titles.length > 1) await tap(page, BASE_WIDTH / 2 + 170, BASE_HEIGHT / 2 + 150);
  await page.waitForTimeout(2500);
  await captureGame(page, testInfo.outputPath("guild-attendance.png"));
});
