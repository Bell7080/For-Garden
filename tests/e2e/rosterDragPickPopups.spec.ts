import { expect, test } from "@playwright/test";
import { startAfterOpening, E2E_SAVE_STORAGE_KEY as SAVE_STORAGE_KEY } from "./openingSave";
import { canvasBox, captureGame, gamePoint, tap, tapUntil } from "./canvasInput";
import { interactionLayerSpot } from "../../src/ui/interactionLayerLayout";
import { INTERACTION_CITY_LOWER, INTERACTION_CITY_POPUP_SPOTS } from "../../src/ui/interactionCityLayout";
import { formationRosterColumnX, formationRosterGrid, PORTRAIT_GRID_MASK_GAP, portraitGridFirstRowY } from "../../src/ui/portraitGrid";

const ROSTER = formationRosterGrid(INTERACTION_CITY_LOWER.right - INTERACTION_CITY_LOWER.left);
/** 목록 첫 카드(나가 있는 이가 없으면 고를 수 있는 이가 먼저 선다). 자리는 화면의 배치표에서 읽는다. */
const FIRST_CARD = {
  x: 540 + formationRosterColumnX(ROSTER, 0),
  y: 960 + INTERACTION_CITY_LOWER.top + 64 + portraitGridFirstRowY(0, ROSTER.cardHeight, PORTRAIT_GRID_MASK_GAP),
};

async function dragCard(page: import("@playwright/test").Page, from: { x: number; y: number }, to: { x: number; y: number }, shot: string): Promise<void> {
  const box = await canvasBox(page);
  const start = gamePoint(box, from.x, from.y);
  const side = gamePoint(box, from.x + 90, from.y);
  const end = gamePoint(box, to.x, to.y);
  const fire = (type: string, point: { x: number; y: number }, buttons: number) => page.evaluate(([kind, x, y, held]) => {
    const target = kind === "mouseup" ? window : document.querySelector("canvas")!;
    target.dispatchEvent(new MouseEvent(kind as string, { clientX: x as number, clientY: y as number, button: 0, buttons: held as number, bubbles: true }));
  }, [type, point.x, point.y, buttons] as const);
  // 느린 컨테이너에서는 한 프레임이 꾹 누르기 시간을 넘을 수 있어, 누름과 첫 끌기를 한 작업 안에서 보낸다.
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
  await captureGame(page, shot);
  await fire("mouseup", end, 0);
}

test("교류 파견 목록 카드를 끌어 칸에 놓는다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, 540, 960);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");
  const layer = interactionLayerSpot(0);
  await tapUntil(page, layer.x, layer.y, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).some((title) => title.includes("교류부")));
  const slot1 = INTERACTION_CITY_POPUP_SPOTS.slot(1);
  await tap(page, slot1.x, slot1.y);
  await page.waitForTimeout(500);
  await dragCard(page, FIRST_CARD, slot1, "test-results/interaction-roster-drag.png");
  await page.waitForTimeout(500);
  const send = INTERACTION_CITY_POPUP_SPOTS.primary(true);
  await tap(page, send.x, send.y);
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").interaction?.slots?.filter(Boolean)[0]?.party?.length ?? 0, SAVE_STORAGE_KEY))
    .toBe(1);
});

test("발굴 배치 목록 카드를 끌어 칸에 놓는다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, 540, 960);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tap(page, 250, 1920 - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  const slots = (await page.evaluate(() => window.__PF_DEBUG?.idleExcavationSlots))!;
  await tap(page, slots[0].x, slots[0].y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("editing");
  await page.waitForTimeout(500);
  // 첫 보유 카드를 3번 칸에 끌어 놓는다 — 탭이었다면 비어 있는 1번에 섰다.
  await dragCard(page, { x: 540 - 250, y: 960 + 115 }, slots[2], "test-results/excavation-roster-drag.png");
  await page.waitForTimeout(500);
  await tap(page, 540 + 125, 960 + 545);
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").idleExcavation?.assignedRelicIds, SAVE_STORAGE_KEY))
    .toEqual([null, null, expect.any(String)]);
});
