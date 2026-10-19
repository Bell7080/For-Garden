import { expect, test } from "@playwright/test";
import { startAfterOpening, E2E_SAVE_STORAGE_KEY } from "./openingSave";
import { captureGame, tap, waitForCanvasInputFrame } from "./canvasInput";
import { SELECTABLE_LANGUAGE_IDS } from "../../src/core/language";
import { TITLE_ACTION_ROW, titleActionSlots } from "../../src/ui/titleActionLayout";
import { settingsChoiceRowY } from "../../src/ui/settingsLayout";

test("확대된 타이틀은 모든 언어를 실제로 골라도 버튼 문구가 넘치지 않는다", async ({ page }, info) => {
  test.setTimeout(420_000);
  await startAfterOpening(page, state => { state.settings.accessibility.textScale = 1.3; });
  const slots = titleActionSlots(2);
  for (const [index, language] of SELECTABLE_LANGUAGE_IDS.entries()) {
    await tap(page, slots[0].x, TITLE_ACTION_ROW.centerY);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length)).toBe(1);
    await waitForCanvasInputFrame(page);
    const previous = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).settings.game.language, E2E_SAVE_STORAGE_KEY);
    const before = await page.evaluate(() => window.__PF_DEBUG?.fittedText ?? 0);
    await tap(page, 540, 960 + settingsChoiceRowY(index, SELECTABLE_LANGUAGE_IDS.length));
    await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).settings.game.language, E2E_SAVE_STORAGE_KEY)).toBe(language);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
    // 같은 언어를 다시 고르면 선택창만 닫고 문구를 다시 그리지 않는다.
    if (previous !== language) await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.fittedText ?? 0)).toBeGreaterThan(before);
    expect(await page.evaluate(() => window.__PF_DEBUG?.clampedText ?? [])).toEqual([]);
    if (["vi", "id", "es", "pt-BR", "ru"].includes(language)) await captureGame(page, info.outputPath(`title-${language}.png`));
  }
  // 마지막 언어에서도 계정 버튼은 실제 확인 창을 연다. 계정 변경 확인은 누르지 않는다.
  await tap(page, slots[1].x, TITLE_ACTION_ROW.centerY);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles?.length)).toBe(1);
});
