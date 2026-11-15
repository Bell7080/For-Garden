import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { normalizePlayerLevel } from "../../src/core/playerLevel";
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";
import { LAB_TITLE } from "../../src/ui/labLayout";

const WIDTH = 1080; const HEIGHT = 1920;
const OUT = process.env.DOT_CAPTURE_DIR ?? "test-results/free-dots";

/** 무료 보상 붉은 점 검수 — 로비 · 연구소(무료 연구) · 상점(일일 무료칸)을 받기 전·후로 찍는다. */
test("무료 보상 점이 서고 받은 뒤 꺼진다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    saved.playerResearch = normalizePlayerLevel({ level: 30 });
    saved.playerCard.uid = "123456789";
    for (let n = 1; n <= 10; n += 1) saved.cleared.add(`1-${n}`);
    saved.settings.game.contentSeen = { owner: "123456789", known: ["lab", "excavation", "shop", "trade", "duel", "interaction", "guild", "friends", "cakeOperation", "bounty", "raid", "expedition", "archaeology"], fresh: [] };
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 30_000 }).toBe("lobby");
  await page.waitForTimeout(6000);
  await captureGame(page, `${OUT}/1-lobby.png`);
  // 연구소 — 하단 탭 네 번째.
  await tap(page, 756, 1830);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 20_000 }).toBe("lab");
  await page.waitForTimeout(4000);
  await captureGame(page, `${OUT}/2-lab.png`);
  await page.waitForTimeout(700);
  await captureGame(page, `${OUT}/2b-lab.png`);
  // 붉은 점이 달린 오른쪽 꺾쇠로 무료 화석 연구 배너까지 넘긴다.
  await tap(page, WIDTH - LAB_TITLE.arrow.x, LAB_TITLE.arrow.y);
  await page.waitForTimeout(2500);
  await captureGame(page, `${OUT}/2c-lab-fossil.png`);
  await page.waitForTimeout(500);
  await captureGame(page, `${OUT}/2d-lab-fossil.png`);
  // 로비로 돌아가 상점.
  await tap(page, 540, 1830);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 20_000 }).toBe("lobby");
  await page.waitForTimeout(3000);
  await tap(page, LOBBY_RAIL_BOUNDS.content.shop.x, LOBBY_RAIL_BOUNDS.content.shop.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene), { timeout: 20_000 }).toBe("shop");
  await page.waitForTimeout(3500);
  await captureGame(page, `${OUT}/3-shop.png`);
  expect(errors).toEqual([]);
});
