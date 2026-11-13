import { expect, type Page } from "@playwright/test";
import { tap } from "./canvasInput";

/**
 * 스토리 지도에서 지금 고른 노드를 눌러 미리보기 판을 올린다.
 *
 * 지도에 들어올 때는 판이 내려가 있다(노드를 눌러야 올라온다) — 그래서 판을 읽는 스펙은 먼저 이 손짓을 거친다.
 * 들어오는 연출 중의 누름은 허공을 치므로, 판이 설 때까지 같은 자리를 다시 누른다.
 */
export async function openSelectedStagePreview(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.stageMapSelected !== undefined), { timeout: 30_000 }).toBe(true);
  await expect(async () => {
    const node = (await page.evaluate(() => window.__PF_DEBUG!.stageMapSelected!))!;
    await tap(page, node.x, node.y);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview !== undefined), { timeout: 3_000 }).toBe(true);
  }).toPass({ timeout: 60_000 });
}
