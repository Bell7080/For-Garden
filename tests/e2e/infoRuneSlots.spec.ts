import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { generateRune, type RunePart, type RuneRarity } from "../../src/core/runes";
import type { LanguageId } from "../../src/core/language";
import { startAfterOpening } from "./openingSave";
import { canvasBox, gamePoint, tapUntil } from "./canvasInput";
import { BACK_BUTTON_SIZE, BACK_SLOT } from "../../src/ui/popupGeometry";
import { RUNE_WORKBENCH_BACK_CLEARANCE, runeWorkbenchFooterX, runeWorkbenchRows } from "../../src/ui/runeWorkbenchLayout";

/**
 * 정보창 룬 칸 — 끼운 조각이 이음매 없이 맞물리고, 빈 칸이 번호를 달고 튀어나오며, 돋보기가 여는
 * 룬 정비 창의 칸·비교 판·목록이 판 안에 드는지를 눈으로 본다. 판정이 아니라 캡처가 목적이라 언어마다 한 장씩 남긴다.
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

async function openInfo(page: Page, language: LanguageId, stealable = false): Promise<void> {
  await startAfterOpening(page, (session) => {
    session.settings.game.language = language;
    for (const id of session.owned) {
      const runes = seededRunes(id);
      session.runeInventory.push(...runes);
      const progress = session.relicProgress[id];
      if (progress) progress.heartGemSlots = [runes[0].instanceId, runes[1].instanceId, null];
    }
    // 다른 렐릭이 3번 칸에 전설 룬을 끼고 있게 한다 — 추천 장착이 그것을 빼 오려 해 옮겨 끼기 확인 창이 선다.
    if (stealable) {
      const other = [...session.owned].at(-1);
      let seed = 0.71;
      const random = () => { seed = (seed * 9301 + 0.49297) % 1; return seed; };
      const rune = generateRune({ instanceId: "steal-0", baseName: "rune", rarity: "legendary", part: 2, random });
      session.runeInventory.push(rune);
      const progress = other ? session.relicProgress[other] : undefined;
      if (progress) progress.heartGemSlots = [progress.heartGemSlots[0], progress.heartGemSlots[1], rune.instanceId];
    }
  });
  await clickGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");
  await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await page.waitForTimeout(1200);
}

for (const language of ["ko", "de", "ru", "vi"] as const) {
  test(`정보창 룬 칸과 룬 정비 창 (${language})`, async ({ page }, testInfo) => {
    await openInfo(page, language);
    await page.screenshot({ path: `test-results/info-rune-slots-${language}.png` });
    await tapUntil(page, 994, 1296, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length > 0);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `test-results/info-rune-workbench-${language}.png` });
    testInfo.annotations.push({ type: "clamped", description: JSON.stringify(await page.evaluate(() => window.__PF_DEBUG?.clampedText ?? [])) });
  });
}

test("추천 장착 옮겨 끼기 확인과 나가기 확인 (ko)", async ({ page }) => {
  await openInfo(page, "ko", true);
  await tapUntil(page, 994, 1296, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length > 0);
  await page.waitForTimeout(500);
  const rows = runeWorkbenchRows();
  const centerY = BACK_SLOT.y - BACK_BUTTON_SIZE / 2 - RUNE_WORKBENCH_BACK_CLEARANCE - rows.height / 2;
  const footerY = centerY - rows.height / 2 + rows.footerY;
  await tapUntil(page, BASE_WIDTH / 2 + runeWorkbenchFooterX(0), footerY, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).length > 1);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/info-rune-move-ko.png" });
  // 옮겨 끼기(오른쪽 버튼) — 줄 하나짜리 창 높이 548, 버튼 가운데는 윗변에서 466.
  await clickGame(page, BASE_WIDTH / 2 + 210, BASE_HEIGHT / 2 - 274 + 466);
  await page.waitForTimeout(500);
  await clickGame(page, BACK_SLOT.x, BACK_SLOT.y);
  await page.waitForTimeout(500);
  await page.screenshot({ path: "test-results/info-rune-leave-ko.png" });
});
