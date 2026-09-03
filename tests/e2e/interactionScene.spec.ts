import { expect, test, type Page } from "@playwright/test";
import { SAVE_STORAGE_KEY } from "../../src/state/SaveManager";
import { startAfterOpening } from "./openingSave";

/** Phaser 설계 좌표를 FIT 캔버스 좌표로 바꿔 텍스트 DOM이 없는 화면을 조작한다. */
async function tap(page: Page, x: number, y: number): Promise<void> { const box = await page.locator("canvas").boundingBox(); if (!box) throw new Error("캔버스를 찾지 못했다"); await page.mouse.click(box.x + x / 1080 * box.width, box.y + y / 1920 * box.height); }
/** 로비부터 완료 수령까지 저장 JSON의 서버 스냅샷으로 실제 재접속 경계를 검증한다. */
test("교류 편성, 파견 시작, 재접속 복원과 완료 수령", async ({ page }) => {
  await startAfterOpening(page); const canvas = page.locator("canvas"); const box = await canvas.boundingBox(); if (!box) throw new Error("캔버스를 찾지 못했다"); await canvas.click({ position: { x: box.width / 2, y: box.height / 2 } }); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, 250, 1340); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("interaction"); await tap(page, 180, 1090); await tap(page, 780, 1580);
  await expect.poll(() => page.evaluate(key => Boolean(JSON.parse(localStorage.getItem(key) ?? "{}").interaction?.slots?.[0]), SAVE_STORAGE_KEY)).toBe(true);
  await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await tap(page, 540, 960); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby"); await tap(page, 250, 1340); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("interaction");
  // 완료 시각만 과거로 옮겨 장시간 대기 없이 서버 완료 판정과 수령 입력을 검증한다.
  await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)!); data.interaction.slots[0].completesAt = new Date(Date.now() - 1).toISOString(); localStorage.setItem(key, JSON.stringify(data)); }, SAVE_STORAGE_KEY); await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await tap(page, 540, 960); await tap(page, 250, 1340); await tap(page, 820, 980); await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).interaction.slots[0].claimed, SAVE_STORAGE_KEY)).toBe(true);
});
