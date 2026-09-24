import { expect, type Page } from "@playwright/test";
import { canvasBox, gamePoint, tap } from "./canvasInput";

type FormationDebugKey = "party" | "expeditionFormation";

async function readFormation(page: Page, key: FormationDebugKey) {
  return page.evaluate((name) => window.__PF_DEBUG?.[name], key);
}

/**
 * 편성 칸 하나를 **지금 규칙대로** 비운다 — 한 번 누르면 고르고, 고른 칸을 한 번 더 누르면 뺀다
 * (`tapFormationSlot`).
 *
 * 스펙마다 칸을 한 번만 누르고 빠지기를 기대하던 때가 있었다. 누르면 곧바로 빠지던 옛 조작의
 * 흔적이라 규칙이 바뀐 뒤로는 그 검사들이 조용히 어긋났다. 비우는 손은 이 도우미 하나를 지나고,
 * 두 걸음을 각각 확인한다 — 첫 손은 **고르기만** 하고 인원이 그대로인지, 둘째 손에 하나가 빠지는지.
 */
export async function clearFormationSlot(page: Page, key: FormationDebugKey, index: number): Promise<void> {
  const before = (await readFormation(page, key))!;
  const slot = before.slots![index];
  const count = before.selectedCount ?? 0;
  if (before.selectedSlot !== index) {
    await tap(page, slot.x, slot.y);
    await expect.poll(async () => (await readFormation(page, key))?.selectedSlot).toBe(index);
    expect((await readFormation(page, key))?.selectedCount).toBe(count);
  }
  await tap(page, slot.x, slot.y);
  await expect.poll(async () => (await readFormation(page, key))?.selectedCount).toBe(count - 1);
}

/**
 * 목록 격자에서 그 렐릭의 카드 자리. 화면이 내놓는 자리(`gridCards`)를 읽으므로 보유 목록이나
 * 격자 칸 수가 바뀌어도 같은 카드를 누른다.
 */
export async function gridCardPoint(page: Page, scene: "relics" | "party", relicId: string): Promise<{ x: number; y: number }> {
  await expect.poll(() => page.evaluate(([name, id]) => Boolean(window.__PF_DEBUG?.gridCards?.[name as "relics" | "party"]?.cards[id]), [scene, relicId])).toBe(true);
  const read = () => page.evaluate(([name, id]) => {
    const grid = window.__PF_DEBUG!.gridCards![name as "relics" | "party"]!;
    const card = grid.cards[id];
    return { x: card.x, y: card.y + grid.offsetY };
  }, [scene, relicId]);
  let point = await read();
  // 목록은 창보다 길 수 있다 — 카드가 창 가장자리 밖이면 목록을 굴려 데려온다. 창 경계는 화면이 내놓는 값이다.
  const view = await page.evaluate((name) => window.__PF_DEBUG!.gridCards![name as "relics" | "party"]!, scene);
  const margin = 150;
  const box = await canvasBox(page);
  const middle = gamePoint(box, 540, (view.viewportTop + view.viewportBottom) / 2);
  for (let attempt = 0; attempt < 12 && (point.y > view.viewportBottom - margin || point.y < view.viewportTop + margin); attempt += 1) {
    await page.mouse.move(middle.x, middle.y);
    await page.mouse.wheel(0, point.y > view.viewportBottom - margin ? 300 : -300);
    await page.waitForTimeout(150);
    point = await read();
  }
  return point;
}

/** 편성 칸 하나를 고른 뒤 목록 카드를 눌러 그 자리에 세운다. */
export async function placeInFormationSlot(page: Page, index: number, relicId: string): Promise<void> {
  const before = (await readFormation(page, "party"))!;
  const slot = before.slots![index];
  if (before.selectedSlot !== index) {
    await tap(page, slot.x, slot.y);
    await expect.poll(async () => (await readFormation(page, "party"))?.selectedSlot).toBe(index);
  }
  const card = await gridCardPoint(page, "party", relicId);
  await tap(page, card.x, card.y);
  await expect.poll(async () => (await readFormation(page, "party"))?.selectedCount).toBe((before.selectedCount ?? 0) + 1);
}
