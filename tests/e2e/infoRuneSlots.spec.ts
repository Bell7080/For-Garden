import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { generateRune, type RunePart, type RuneRarity } from "../../src/core/runes";
import type { LanguageId } from "../../src/core/language";
import { startAfterOpening } from "./openingSave";
import { canvasBox, gamePoint, tapUntil } from "./canvasInput";

/**
 * 정보창 룬 칸 — 끼운 조각이 이음매 없이 맞물리고, 빈 칸이 번호를 달고 튀어나오며, 돋보기 판의
 * 옵션 줄이 판 안에 드는지를 눈으로 본다. 판정이 아니라 캡처가 목적이라 언어마다 한 장씩 남긴다.
 */
// 세로 화면을 그대로 담아야 작은 글자의 넘침이 보인다.
test.use({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 });

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const point = gamePoint(await canvasBox(page), x, y);
  await page.mouse.click(point.x, point.y);
}

/** 앞자리 둘은 긴 옵션 이름이 섞이도록 등급과 시드를 고른다. 셋째 칸은 비워 둔다. */
function seededRunes(prefix: string): ReturnType<typeof generateRune>[] {
  const plan: [RuneRarity, RunePart][] = [["legendary", 0], ["epic", 1]];
  let seed = 0.13;
  const random = () => { seed = (seed * 9301 + 0.49297) % 1; return seed; };
  return plan.map(([rarity, part], index) => generateRune({ instanceId: `${prefix}-${index}`, baseName: "rune", rarity, part, random }));
}

async function openInfo(page: Page, language: LanguageId): Promise<void> {
  await startAfterOpening(page, (session) => {
    session.settings.game.language = language;
    for (const id of session.owned) {
      const runes = seededRunes(id);
      session.runeInventory.push(...runes);
      const progress = session.relicProgress[id];
      if (progress) progress.heartGemSlots = [runes[0].instanceId, runes[1].instanceId, null];
    }
  });
  await clickGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");
  await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await page.waitForTimeout(1200);
}

for (const language of ["ko", "de", "ru", "vi"] as const) {
  test(`정보창 룬 칸과 돋보기 판 (${language})`, async ({ page }, testInfo) => {
    await openInfo(page, language);
    await page.screenshot({ path: `test-results/info-rune-slots-${language}.png` });
    await tapUntil(page, 994, 1296, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length > 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/info-rune-overview-${language}.png` });
    testInfo.annotations.push({ type: "clamped", description: JSON.stringify(await page.evaluate(() => window.__PF_DEBUG?.clampedText ?? [])) });
  });
}
