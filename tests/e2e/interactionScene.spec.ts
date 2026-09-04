import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { SAVE_STORAGE_KEY } from "../../src/state/SaveManager";
import { tap, tapUntil } from "./canvasInput";
import { INTERACTION_LAYER, interactionLayerSpot } from "../../src/ui/interactionLayerLayout";

const CENTER = { x: 540, y: 960 };
/** 첫 층(중앙 정원구 교류부)의 한가운데. 자리는 화면이 소유한 배치표에서 읽는다. */
const FIRST_LAYER = interactionLayerSpot(0);
/** 쪽지 안의 자리들은 팝업 중심 기준이라 화면 좌표로 옮겨 쓴다. */
const SLOT_ONE = { x: CENTER.x - 256, y: CENTER.y + 300 };
const FIRST_CARD = { x: CENTER.x - 332, y: CENTER.y + 266 };
const CLOSE_GRID = { x: 880, y: CENTER.y + 86 };
const PRIMARY = { x: CENTER.x, y: CENTER.y + 520 };

/** 로비부터 교류 층·파견·재접속 복원·완료 수령까지 실제 사용자 경로로 검증한다. */
test("층을 눌러 파견을 보내고 재접속 뒤 완료 보상까지 받는다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, CENTER.x, CENTER.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");

  // 층 → 도시 쪽지 → 1번 자리 → 파견대 그리드 → 카드 순으로 실제 손이 가는 길을 따른다.
  await tapUntil(page, FIRST_LAYER.x, FIRST_LAYER.y, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).some((title) => title.includes("교류부")));
  await tap(page, SLOT_ONE.x, SLOT_ONE.y);
  await tap(page, FIRST_CARD.x, FIRST_CARD.y);
  await tap(page, CLOSE_GRID.x, CLOSE_GRID.y);
  await tap(page, PRIMARY.x, PRIMARY.y);
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}").interaction?.slots?.filter(Boolean).length ?? 0, SAVE_STORAGE_KEY))
    .toBe(1);

  // 완료 시각만 과거로 옮겨 긴 대기 없이 서버 완료 판정과 수령 입력을 검증한다.
  await page.evaluate((key) => {
    const data = JSON.parse(localStorage.getItem(key)!);
    data.interaction.slots[0].completesAt = new Date(Date.now() - 1000).toISOString();
    localStorage.setItem(key, JSON.stringify(data));
  }, SAVE_STORAGE_KEY);
  await page.reload();
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await tap(page, CENTER.x, CENTER.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");

  await tapUntil(page, FIRST_LAYER.x, FIRST_LAYER.y, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).some((title) => title.includes("교류부")));
  await tap(page, PRIMARY.x, PRIMARY.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("교류 보상");
  await expect
    .poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key)!).interaction.slots[0]?.claimed, SAVE_STORAGE_KEY))
    .toBe(true);
});

/** 층은 창 안에서만 흐르고 우하단 뒤로가기 자리를 침범하지 않는다. */
test("잠긴 층도 목록에 남아 다음에 열릴 곳을 보여 준다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, CENTER.x, CENTER.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");
  // 잠긴 층을 눌러도 쪽지가 열리지 않는다 — 무엇이 열릴지만 말한다.
  const locked = interactionLayerSpot(4);
  if (locked.y < INTERACTION_LAYER.viewport.bottom) {
    await tap(page, locked.x, locked.y);
    await page.waitForTimeout(400);
    expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();
  }
});
