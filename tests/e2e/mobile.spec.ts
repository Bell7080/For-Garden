import { test, expect } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

test("세로형 화면에서 캔버스가 뜨고 첫 방문은 오프닝으로 들어간다", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  // 타이틀이 로딩 화면을 겸한다. ready는 다섯 칸이 다 찬 뒤에만 true가 된다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("title");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);

  await page.screenshot({ path: `test-results/${test.info().project.name}-title.png` });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const aspect = box!.height / box!.width;
  expect(aspect).toBeGreaterThan(1); // 세로가 더 길어야 한다 (letterbox 포함)

  // 로딩이 끝나면 화면 아무 곳이나 눌러 넘어간다. 저장이 없으면 오프닝 스토리가 먼저다.
  await canvas.click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("opening");

  expect(consoleErrors, `콘솔 에러 발생: ${consoleErrors.join(", ")}`).toEqual([]);
});

test("오프닝을 이미 본 저장이면 타이틀에서 로비로 바로 간다", async ({ page }) => {
  await startAfterOpening(page);

  await page.locator("canvas").click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("lobby");
});

test("가로로 눕히면 세로로 돌려달라는 안내가 뜬다", async ({ page }) => {
  const viewport = page.viewportSize();
  if (viewport) {
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
  }

  await page.goto("/");
  await expect(page.locator("#rotate-overlay")).toBeVisible();
});
