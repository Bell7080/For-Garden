import { expect, test } from "@playwright/test";
import { SAVE_STORAGE_KEY } from "../../src/state/SaveManager";
import { startAfterOpening } from "./openingSave";
import { tap } from "./canvasInput";

/** 로비부터 완료 수령까지 저장 JSON의 서버 스냅샷으로 실제 재접속 경계를 검증한다. */
test("교류 편성, 파견 시작, 재접속 복원과 완료 수령", async ({ page }) => {
  await startAfterOpening(page); await tap(page, 540, 960); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, 250, 1340); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("interaction");
  // 도시·편성 칸은 서버 조회가 끝난 뒤에 그려지므로, 그려질 틈을 두고 누른다.
  await page.waitForTimeout(600); await tap(page, 180, 1090); await tap(page, 780, 1580);
  await expect.poll(() => page.evaluate(key => Boolean(JSON.parse(localStorage.getItem(key) ?? "{}").interaction?.slots?.[0]), SAVE_STORAGE_KEY)).toBe(true);
  await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await tap(page, 540, 960); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby"); await tap(page, 250, 1340); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("interaction");
  // 완료 시각만 과거로 옮겨 장시간 대기 없이 서버 완료 판정과 수령 입력을 검증한다.
  await page.evaluate(key => { const data = JSON.parse(localStorage.getItem(key)!); data.interaction.slots[0].completesAt = new Date(Date.now() - 1).toISOString(); localStorage.setItem(key, JSON.stringify(data)); }, SAVE_STORAGE_KEY); await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await tap(page, 540, 960); await tap(page, 250, 1340); await page.waitForTimeout(600); await tap(page, 820, 980); await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).interaction.slots[0].claimed, SAVE_STORAGE_KEY)).toBe(true);
});
