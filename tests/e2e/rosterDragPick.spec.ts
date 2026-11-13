import { test, expect } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { canvasBox, captureGame, gamePoint, tap } from "./canvasInput";
import { clearFormationSlot, gridCardPoint } from "./formationSlotTap";
import { sortieEntryScreenPoint } from "../../src/ui/sortieMenuLayout";

const STORY_ENTRY = sortieEntryScreenPoint("story");

async function enterParty(page: import("@playwright/test").Page): Promise<void> {
  await startAfterOpening(page);
  await tap(page, 540, 960);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, 1080 - 290, 1920 - 425);
  await tap(page, STORY_ENTRY.x, STORY_ENTRY.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tap(page, 540, 1920 - 180);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("party");
}

const members = (page: import("@playwright/test").Page) => page.evaluate(() => window.__PF_DEBUG?.party?.members);

test("목록 카드를 끌어 칸에 놓고, 찬 칸이 골라져 있어도 탭은 빈 칸부터 채운다", async ({ page }) => {
  await enterParty(page);
  const slots = (await page.evaluate(() => window.__PF_DEBUG?.party?.slots))!;
  const before = (await members(page))!;
  // 가운데를 비운다 — 1·3번만 선다.
  await clearFormationSlot(page, "party", 1);
  const removed = before[1]!;
  // 3번 칸을 고른 채 목록에서 빠진 렐릭을 누르면 3번이 아니라 비어 있는 2번에 선다.
  await tap(page, slots[2].x, slots[2].y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.selectedSlot)).toBe(2);
  const card = await gridCardPoint(page, "party", removed);
  await tap(page, card.x, card.y);
  await expect.poll(() => members(page)).toEqual(before);

  // 목록 카드를 가로로 끌어낸 뒤 1번 칸에 놓으면 그 칸과 맞바꾼다(이미 2번에 선 렐릭).
  const box = await canvasBox(page);
  const start = gamePoint(box, card.x, card.y);
  const side = gamePoint(box, card.x + 90, card.y);
  const end = gamePoint(box, slots[0].x, slots[0].y);
  // 느린 컨테이너에서는 한 프레임이 꾹 누르기 시간을 넘을 수 있어, 누름과 첫 끌기를 한 작업 안에서 보낸다.
  const fire = (type: string, point: { x: number; y: number }, buttons: number) => page.evaluate(([kind, x, y, held]) => {
    const canvas = document.querySelector("canvas")!;
    const target = kind === "mouseup" ? window : canvas;
    target.dispatchEvent(new MouseEvent(kind as string, { clientX: x as number, clientY: y as number, button: 0, buttons: held as number, bubbles: true }));
  }, [type, point.x, point.y, buttons] as const);
  await page.evaluate(([sx, sy, ex, ey]) => {
    const canvas = document.querySelector("canvas")!;
    canvas.dispatchEvent(new MouseEvent("mousedown", { clientX: sx, clientY: sy, button: 0, buttons: 1, bubbles: true }));
    canvas.dispatchEvent(new MouseEvent("mousemove", { clientX: ex, clientY: ey, button: 0, buttons: 1, bubbles: true }));
  }, [start.x, start.y, side.x, side.y] as const);
  for (let step = 1; step <= 8; step += 1) {
    await fire("mousemove", { x: side.x + ((end.x - side.x) * step) / 8, y: side.y + ((end.y - side.y) * step) / 8 }, 1);
    await page.waitForTimeout(60);
  }
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/roster-drag-hover.png`);
  await fire("mouseup", end, 0);
  await expect.poll(() => members(page)).toEqual([before[1], before[0], before[2]]);
});
