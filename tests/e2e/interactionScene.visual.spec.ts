import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil } from "./canvasInput";

/** 테두리와 readout 결은 기기 프로젝트에서만 한 번 캡처해 기능 스펙의 중복 이미지를 막는다. */
test("교류 카드 액자와 readout 질감", async ({ page }, testInfo) => {
  await startAfterOpening(page);
  await tap(page, 540, 960);
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.interactionLayers?.cards.length ?? 0)).toBeGreaterThan(0);
  await captureGame(page, testInfo.outputPath("interaction-card-frame-readout.png"));
});
