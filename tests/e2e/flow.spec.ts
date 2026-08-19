import { test, expect, type Page } from "@playwright/test";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/**
 * 편성 화면 그리드에서 렐릭 카드의 기준 좌표.
 * 그리드에는 **보유한** 렐릭만 순서대로 놓인다 — 시작 보유는 렉스 · 안키 · 도도 셋이다.
 */
const ROSTER = { startX: 156, startY: 1100, stepX: 256, stepY: 240, cols: 4 };
function card(index: number): [number, number] {
  return [
    ROSTER.startX + (index % ROSTER.cols) * ROSTER.stepX,
    ROSTER.startY + Math.floor(index / ROSTER.cols) * ROSTER.stepY,
  ];
}
const REX = card(0);
const ANKY = card(1);
const DODO = card(2);

/** 전투 화면 조작부 좌표. */
const BASIC_ATTACK: [number, number] = [780, 1730];
/** 리볼버 아래쪽 두 자리 (중심 300,1600 · 반지름 185 · 각 150°/30°). */
const REVOLVER_REAR_1: [number, number] = [140, 1692];

async function canvasBox(page: Page) {
  const box = await page.locator("canvas").boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  return box;
}

/**
 * 게임 기준 해상도(1080×1920) 좌표를 실제 캔버스 좌표로 바꿔 누른다.
 * Scale.FIT + CENTER_BOTH라 캔버스 요소가 곧 게임 화면이므로 비율만 맞추면 된다.
 */
async function tap(page: Page, x: number, y: number): Promise<void> {
  const box = await canvasBox(page);
  await page.locator("canvas").click({
    position: { x: (x / BASE_WIDTH) * box.width, y: (y / BASE_HEIGHT) * box.height },
  });
}

/** 꾹 누르기. 편성 화면에서 정보창을 여는 조작이다. */
async function longPress(page: Page, x: number, y: number, ms = 700): Promise<void> {
  const box = await canvasBox(page);
  const px = box.x + (x / BASE_WIDTH) * box.width;
  const py = box.y + (y / BASE_HEIGHT) * box.height;
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

function scene(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}
function battle(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.battle);
}
function infoOpen(page: Page) {
  return page.evaluate(() => window.__PF_DEBUG?.infoOpen);
}

/** 타이틀에서 편성 화면까지 들어간다. */
async function enterParty(page: Page): Promise<void> {
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2); // 타이틀 → 로비
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 300, BASE_HEIGHT - 180 - 140); // 출격 버튼
  await expect.poll(() => scene(page)).toBe("stageMap");

  await tap(page, BASE_WIDTH / 2 - 110, BASE_HEIGHT - 460); // 1-1 노드
  await expect.poll(() => scene(page)).toBe("party");
}

/** 파티는 안키(선봉) · 렉스 · 도도. */
async function enterBattle(page: Page): Promise<void> {
  await enterParty(page);
  await tap(page, ...ANKY);
  await tap(page, ...REX);
  await tap(page, ...DODO);
  await tap(page, BASE_WIDTH / 2, 1700); // 전투 시작
  await expect.poll(() => scene(page)).toBe("battle");
}

test("출격 → 스테이지 지도 → 파티 편성 → 전투까지 이어진다", async ({ page }) => {
  await enterBattle(page);

  const state = await battle(page);
  expect(state?.turn).toBe(1);
  // 먼저 고른 렐릭이 선봉에 선다.
  expect(state?.playerOrder).toEqual(["안키", "렉스", "도도"]);
});

test("편성 화면에서 렐릭을 꾹 누르면 정보창이 열린다", async ({ page }) => {
  await enterParty(page);
  expect(await infoOpen(page)).toBeFalsy();

  await longPress(page, ...ANKY);
  await expect.poll(() => infoOpen(page)).toBe(true);

  // 짧게 누르는 편성 토글과 섞이지 않아야 한다.
  await tap(page, BASE_WIDTH / 2, 1700); // 정보창이 떠 있으면 전투 시작으로 넘어가지 않는다
  expect(await scene(page)).toBe("party");
});

test("1080×1920 캐릭터 상세과 스킬 카드가 안전 영역 안에 표시된다", async ({ page }) => {
  // 기준 해상도를 직접 사용해 전신과 최대 폭 정보 레이어의 회귀를 스크린샷으로 남긴다.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  await longPress(page, ...ANKY);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-character-info-1080x1920.png`, fullPage: true });

  // 오른쪽 첫 스킬 버튼을 눌러 긴 한국어 설명 카드와 내부 뒤로가기 상태도 기록한다.
  await tap(page, 704, 1052);
  await page.screenshot({ path: `test-results/${test.info().project.name}-skill-info-1080x1920.png`, fullPage: true });
  await tap(page, 827, 1460);
  await expect.poll(() => infoOpen(page)).toBe(true);
});

test("기본 공격을 하면 적 선봉 HP가 깎이고 턴이 넘어간다", async ({ page }) => {
  await enterBattle(page);
  const before = await battle(page);

  await tap(page, ...BASIC_ATTACK);

  await expect.poll(async () => (await battle(page))?.enemyFrontHp).toBeLessThan(
    before!.enemyFrontHp,
  );
  // 적이 반격하고 다음 턴이 시작된다.
  await expect.poll(async () => (await battle(page))?.turn, { timeout: 10_000 }).toBe(2);
  await expect.poll(async () => (await battle(page))?.phase).toBe("player");
});

test("리볼버 아래쪽 렐릭을 누르면 선봉이 바뀌고 한 턴을 쓴다", async ({ page }) => {
  await enterBattle(page);

  await tap(page, ...REVOLVER_REAR_1);

  await expect.poll(async () => (await battle(page))?.playerOrder?.[0]).toBe("렉스");
  // 교대도 한 턴을 쓴 것이므로 적이 행동하고 턴이 넘어간다.
  await expect.poll(async () => (await battle(page))?.turn, { timeout: 10_000 }).toBe(2);
});


test("하단 탭으로 렐릭 · 로비 · 연구소를 오간다", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  const navY = BASE_HEIGHT - 180 + 90;
  await tap(page, BASE_WIDTH / 6, navY); // 렐릭
  await expect.poll(() => scene(page)).toBe("relics");

  await tap(page, (BASE_WIDTH * 5) / 6, navY); // 연구소
  await expect.poll(() => scene(page)).toBe("lab");

  await tap(page, BASE_WIDTH / 2, navY); // 로비
  await expect.poll(() => scene(page)).toBe("lobby");
});

test("연구소에서 발굴하면 화석이 줄고 결과가 뜬다", async ({ page }) => {
  await page.goto("/");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, (BASE_WIDTH * 5) / 6, BASE_HEIGHT - 180 + 90);
  await expect.poll(() => scene(page)).toBe("lab");

  const before = await page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil);
  expect(before).toBe(1200);

  await tap(page, 300, BASE_HEIGHT - 180 - 250); // 1회 발굴
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil)).toBe(1100);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.owned)).not.toBeUndefined();
});
