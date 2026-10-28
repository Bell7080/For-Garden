import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";

const scene = (page: Page) => page.evaluate(() => window.__PF_DEBUG?.scene);
const titles = (page: Page) => page.evaluate(() => window.__PF_DEBUG?.popupTitles ?? []);

/**
 * 출격판의 칸은 판 안에서 굴러가고 판 밖은 마스크가 자른다. 잘린 칸(맨 아래 고대 지층·굴린 뒤의 원정)의 입력면이 판 밖
 * 허공에 남아 있으면, 바깥을 눌러 판을 닫으려던 손이 가려진 칸을 연다 — 판 밖은 바탕 닫기만 받아야 한다.
 */
test("출격판 밖 허공을 누르면 가려진 칸이 아니라 판이 닫힌다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => titles(page)).toContain("출격");
  await page.waitForTimeout(800);
  // 판 밑변(중심 -75 + 665) 아래, 상점 곁판 오른쪽 — 잘린 고대 지층 칸이 있던 자리다.
  await tap(page, BASE_WIDTH / 2 + 200, BASE_HEIGHT / 2 - 75 + 775);
  await expect.poll(() => titles(page)).not.toContain("출격");
  await page.waitForTimeout(800);
  expect(await scene(page)).toBe("lobby");
});

test("출격판은 굴리지 않아도 맨 아래 고대 지층 칸이 한 뼘 비친다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");
  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => titles(page)).toContain("출격");
  await page.waitForTimeout(2_000);
  await captureGame(page, `test-results/${test.info().project.name}-sortie-peek.png`);
});
