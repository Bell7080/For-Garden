import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { SAVE_STORAGE_KEY } from "../../src/state/SaveManager";
import { drag, tap, tapUntil } from "./canvasInput";
import { INTERACTION_LAYER, interactionLayerSpot } from "../../src/ui/interactionLayerLayout";
import { INTERACTION_CITY_POPUP_SPOTS } from "../../src/ui/interactionCityLayout";

const CENTER = { x: 540, y: 960 };
/** 첫 층(중앙 정원구 교류부)의 한가운데. 자리는 화면이 소유한 배치표에서 읽는다. */
const FIRST_LAYER = interactionLayerSpot(0);
/** 쪽지 안의 자리는 화면이 소유한 배치표에서 읽는다. 좌표를 여기 적으면 배치를 고칠 때 갈린다. */
const FIRST_SLOT = INTERACTION_CITY_POPUP_SPOTS.slot(0);
const AUTO_ASSIGN = INTERACTION_CITY_POPUP_SPOTS.autoAssign;
const SEND = INTERACTION_CITY_POPUP_SPOTS.primary(true);
const CLAIM = INTERACTION_CITY_POPUP_SPOTS.primary(false);

/** 로비부터 교류 층·파견·재접속 복원·완료 수령까지 실제 사용자 경로로 검증한다. */
test("층을 눌러 파견을 보내고 재접속 뒤 완료 보상까지 받는다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, CENTER.x, CENTER.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");

  // 층 → 도시 쪽지 → 칸을 눌러 배치 → 자동 배치 → 파견 순으로 실제 손이 가는 길을 따른다.
  // 위 칸의 세 자리는 늘 서 있고 아래 칸만 안내와 목록으로 교대한다.
  await tapUntil(page, FIRST_LAYER.x, FIRST_LAYER.y, async () => ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).some((title) => title.includes("교류부")));
  await tap(page, FIRST_SLOT.x, FIRST_SLOT.y);
  await tap(page, AUTO_ASSIGN.x, AUTO_ASSIGN.y);
  await tap(page, SEND.x, SEND.y);
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
  await tap(page, CLAIM.x, CLAIM.y);
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
  // 서버 refresh 뒤 카드 렌더가 완료된 관찰값을 기다려 씬 이름만 먼저 바뀐 프레임을 읽지 않는다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.interactionLayers?.cards.length ?? 0)).toBeGreaterThan(0);
  const initial = await page.evaluate(() => window.__PF_DEBUG!.interactionLayers!);
  // 조건 없는 첫 세 곳만 열리고, night-council부터는 각 스테이지 관문을 그대로 따른다.
  expect(initial.cards.slice(0, 3).map(({ id, locked }) => ({ id, locked }))).toEqual([
    { id: "doppel-parlor", locked: false }, { id: "doppel-lab", locked: false }, { id: "night-ward", locked: false },
  ]);
  expect(initial.cards.find(({ id }) => id === "night-council")?.locked).toBe(true);
  expect(initial.cards.find(({ id }) => id === "abyss-port")?.locked).toBe(true);

  // 첫 카드는 목록 창에 완전히 들고, 창 아래에서 시작하는 뒤로가기 영역과 겹치지 않는다.
  const first = initial.cards[0];
  expect(first.bounds.top).toBeGreaterThanOrEqual(INTERACTION_LAYER.viewport.top);
  expect(first.bounds.bottom).toBeLessThanOrEqual(INTERACTION_LAYER.viewport.bottom);
  expect(first.bounds.bottom).toBeLessThan(INTERACTION_LAYER.viewport.bottom);
  expect(initial.cards.slice(0, 2).map(({ id, textureKey }) => ({ id, textureKey }))).toEqual([
    { id: "doppel-parlor", textureKey: "background-interaction-doppel-parlor" },
    { id: "doppel-lab", textureKey: "background-interaction-doppel-lab" },
  ]);

  // 화면 밖의 잠긴 카드도 반드시 창 안으로 끌어온 뒤 누르고, 쪽지가 열리지 않음을 확인한다.
  await drag(page, [CENTER.x, INTERACTION_LAYER.viewport.bottom - 40], [CENTER.x, INTERACTION_LAYER.viewport.top + 40], { steps: 12 });
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.interactionLayers?.scrollY)).toBeLessThan(0);
  const locked = await page.evaluate(() => window.__PF_DEBUG!.interactionLayers!.cards.find((card) => card.id === "night-council")!);
  await tap(page, (locked.bounds.left + locked.bounds.right) / 2, (locked.bounds.top + locked.bounds.bottom) / 2);
  await page.waitForTimeout(400);
  expect(await page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toBeUndefined();

  // 끝까지 끌면 정확히 최솟값에 닿고 마지막 도시 카드가 창 안으로 들어온다.
  await drag(page, [CENTER.x, INTERACTION_LAYER.viewport.bottom - 40], [CENTER.x, INTERACTION_LAYER.viewport.top + 40], { steps: 12 });
  await drag(page, [CENTER.x, INTERACTION_LAYER.viewport.bottom - 40], [CENTER.x, INTERACTION_LAYER.viewport.top + 40], { steps: 12 });
  const bottom = await page.evaluate(() => window.__PF_DEBUG!.interactionLayers!);
  expect(bottom.maxScrollY).toBe(0);
  expect(bottom.scrollY).toBe(bottom.minScrollY);
  expect(bottom.cards.at(-1)!.bounds.bottom).toBeLessThanOrEqual(bottom.viewport.bottom);
});

/** 스테이지 진행을 저장 경계로 주입해 각 관문이 해당 카드만 여는지 확인한다. */
test("완료한 지정 스테이지에 맞춰 교류지가 열린다", async ({ page }) => {
  await startAfterOpening(page, (state) => { state.cleared.add("1-4"); });
  await tap(page, CENTER.x, CENTER.y);
  await tapUntil(page, 250, 1340, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "interaction");
  // 진행 상태를 반영한 서버 목록이 실제로 그려진 뒤 잠금 결과를 읽는다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.interactionLayers?.cards.length ?? 0)).toBeGreaterThan(0);
  const cards = await page.evaluate(() => window.__PF_DEBUG!.interactionLayers!.cards);
  expect(cards.find(({ id }) => id === "night-council")?.locked).toBe(false);
  expect(cards.find(({ id }) => id === "abyss-port")?.locked).toBe(true);
});
