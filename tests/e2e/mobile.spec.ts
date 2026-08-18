import { test, expect } from "@playwright/test";

test("세로형 화면에서 캔버스가 뜨고 타이틀에서 연구소로 전환된다", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("title");

  await page.screenshot({ path: `test-results/${test.info().project.name}-title.png` });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const aspect = box!.height / box!.width;
  expect(aspect).toBeGreaterThan(1); // 세로가 더 길어야 한다 (letterbox 포함)

  await canvas.click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("archive");

  expect(consoleErrors, `콘솔 에러 발생: ${consoleErrors.join(", ")}`).toEqual([]);
});

test("가로로 눕히면 세로로 돌려달라는 안내가 뜬다", async ({ page }) => {
  const viewport = page.viewportSize();
  if (viewport) {
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
  }

  await page.goto("/");
  await expect(page.locator("#rotate-overlay")).toBeVisible();
});
