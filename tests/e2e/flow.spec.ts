import { test, expect, type Page } from "@playwright/test";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/**
 * 게임 기준 해상도(1080×1920) 좌표를 실제 캔버스 좌표로 바꿔 누른다.
 * Scale.FIT + CENTER_BOTH라 캔버스 요소가 곧 게임 화면이므로 비율만 맞추면 된다.
 */
async function tap(page: Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({
    position: { x: (x / BASE_WIDTH) * box.width, y: (y / BASE_HEIGHT) * box.height },
  });
}

function scene(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

function battle(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.battle);
}

/** 타이틀에서 전투 화면까지 들어간다. 파티는 안키(전방) · 렉스 · 도도. */
async function enterBattle(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2); // 타이틀 → 연구소
  await expect.poll(() => scene(page)).toBe("archive");

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT * 0.78); // 출격 버튼
  await expect.poll(() => scene(page)).toBe("stageMap");

  await tap(page, BASE_WIDTH / 2 - 110, BASE_HEIGHT - 460); // 1-1 노드
  await expect.poll(() => scene(page)).toBe("party");

  await tap(page, 784, 460); // 안키 — 전방
  await tap(page, 296, 460); // 렉스
  await tap(page, 784, 724); // 도도
  await tap(page, BASE_WIDTH / 2 + 170, BASE_HEIGHT - 180); // 전투 시작

  await expect.poll(() => scene(page)).toBe("battle");
}

test("출격 → 스테이지 지도 → 파티 편성 → 전투까지 이어진다", async ({ page }) => {
  await enterBattle(page);

  const state = await battle(page);
  expect(state?.turn).toBe(1);
  // 먼저 고른 렐릭이 전방에 선다.
  expect(state?.playerOrder).toEqual(["안키", "렉스", "도도"]);
});

test("기본 공격을 하면 적 전방 HP가 깎이고 턴이 넘어간다", async ({ page }) => {
  await enterBattle(page);
  const before = await battle(page);

  await tap(page, BASE_WIDTH / 2 - 250, 1600); // 기본 공격

  await expect.poll(async () => (await battle(page))?.enemyFrontHp).toBeLessThan(
    before!.enemyFrontHp,
  );
  // 적이 반격하고 다음 턴이 시작된다.
  await expect.poll(async () => (await battle(page))?.turn, { timeout: 10_000 }).toBe(2);
  await expect.poll(async () => (await battle(page))?.phase).toBe("player");
});

test("스왑하면 전방이 바뀌고, 그 턴에 다른 행동은 하지 못한다", async ({ page }) => {
  await enterBattle(page);

  await tap(page, BASE_WIDTH / 2 - 250, 1850); // 후방 1번(렉스)과 교대

  await expect.poll(async () => (await battle(page))?.playerOrder?.[0]).toBe("렉스");
  // 스왑도 한 턴을 쓴 것이므로 적이 행동하고 턴이 넘어간다.
  await expect.poll(async () => (await battle(page))?.turn, { timeout: 10_000 }).toBe(2);
});
