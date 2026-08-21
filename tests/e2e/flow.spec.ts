import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/**
 * 편성 화면 그리드에서 렐릭 카드의 기준 좌표.
 * 그리드에는 **보유한** 렐릭만 순서대로 놓인다 — 시작 보유는 전용 아트가 완성된 세 명이다.
 */
/**
 * 로비 출격 버튼의 한가운데.
 *
 * 유리판이 기울어 있어 모서리를 누르면 빗나간다. 씬이 두는 좌표(NAV_TOP - 245)와 같은 값을
 * 여기에도 적어 둔다.
 */
const SORTIE: [number, number] = [BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245];

const ROSTER = { startX: 116, startY: 1080, stepX: 212, stepY: 244, cols: 5 };
function card(index: number): [number, number] {
  return [
    ROSTER.startX + (index % ROSTER.cols) * ROSTER.stepX,
    ROSTER.startY + Math.floor(index / ROSTER.cols) * ROSTER.stepY,
  ];
}
const LEXIA = card(0);
const TORIKA = card(1);
const SEIRA = card(2);

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
  await startAfterOpening(page);

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2); // 타이틀 → 로비
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, ...SORTIE); // 출격 버튼
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 지도는 열려 있는 가장 뒤쪽 스테이지를 이미 골라 둔다. 출전만 누르면 편성으로 넘어간다.
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT - 180); // 출전
  await expect.poll(() => scene(page)).toBe("party");
}

/** 파티는 토리카 · 렉시아 · 세이라 순으로 고른다. */
async function enterBattle(page: Page): Promise<void> {
  await enterParty(page);
  await tap(page, ...TORIKA);
  await tap(page, ...LEXIA);
  await tap(page, ...SEIRA);
  await tap(page, BASE_WIDTH / 2, 1700); // 전투 시작
  await expect.poll(() => scene(page)).toBe("battle");
}

test("출격 → 스테이지 지도 → 파티 편성 → 전투까지 이어진다", async ({ page }) => {
  await enterBattle(page);

  const state = await battle(page);
  expect(state?.phase).toBe("fight");
  // 편성한 셋이 그대로 전장에 선다.
  expect(state?.playerOrder).toEqual(["토리카", "렉시아", "세이라"]);
});

test("편성 화면에서 렐릭을 꾹 누르면 정보창이 열린다", async ({ page }) => {
  await enterParty(page);
  expect(await infoOpen(page)).toBeFalsy();

  await longPress(page, ...SEIRA);
  await expect.poll(() => infoOpen(page)).toBe(true);

  // 짧게 누르는 편성 토글과 섞이지 않아야 한다.
  await tap(page, BASE_WIDTH / 2, 1700); // 정보창이 떠 있으면 전투 시작으로 넘어가지 않는다
  expect(await scene(page)).toBe("party");
});

test("편성 화면은 자동 배치한 세 명으로 바로 출전할 수 있다", async ({ page }) => {
  await enterParty(page);
  await tap(page, BASE_WIDTH - 190, 912); // 적 상성 합이 높은 보유 렐릭 세 명을 자동 선택한다.
  await tap(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => scene(page)).toBe("battle");
  expect((await battle(page))?.playerOrder).toHaveLength(3);
});

test("1080×1920 캐릭터 상세과 스킬 카드가 안전 영역 안에 표시된다", async ({ page }) => {
  // 기준 해상도를 직접 사용해 전신과 최대 폭 정보 레이어의 회귀를 스크린샷으로 남긴다.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  await longPress(page, ...SEIRA);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-character-info-1080x1920.png`, fullPage: true });

  // 오른쪽 첫 스킬 버튼을 눌러 긴 한국어 설명 카드와 내부 뒤로가기 상태도 기록한다.
  await tap(page, 704, 1052);
  await page.screenshot({ path: `test-results/${test.info().project.name}-skill-info-1080x1920.png`, fullPage: true });
  // 스킬 상세의 뒤로가기(아이콘 버튼)로 캐릭터 상세로 되돌아온다.
  await tap(page, 694, 1450);
  await expect.poll(() => infoOpen(page)).toBe(true);
});

test("실시간 자동 전투는 입력 없이 서로 붙어 체력을 깎는다", async ({ page }) => {
  await enterBattle(page);
  const before = await battle(page);

  // 조작하지 않아도 여섯이 달려가 붙고, 양쪽 체력이 함께 줄어든다.
  await expect
    .poll(async () => (await battle(page))?.enemyHp, { timeout: 20_000 })
    .toBeLessThan(before!.enemyHp);
  await expect
    .poll(async () => (await battle(page))?.playerHp, { timeout: 20_000 })
    .toBeLessThan(before!.playerHp);
  await expect.poll(async () => (await battle(page))?.elapsed).toBeGreaterThan(0);
});

test("전투 조작 칩으로 1·2·3배속과 자동 궁극기를 전환한다", async ({ page }) => {
  await enterBattle(page);
  expect(await battle(page)).toMatchObject({ speed: 1, autoUltimate: false });

  // 배속 칩은 1→2→3→1로 순환한다.
  await tap(page, BASE_WIDTH - 335, 150);
  await expect.poll(async () => (await battle(page))?.speed).toBe(2);
  await tap(page, BASE_WIDTH - 335, 150);
  await expect.poll(async () => (await battle(page))?.speed).toBe(3);

  // 자동 궁극기는 배속과 독립적으로 켜고 끌 수 있다.
  await tap(page, BASE_WIDTH - 130, 150);
  await expect.poll(async () => (await battle(page))?.autoUltimate).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-battle-controls.png`, fullPage: true });
});

test("전투는 한쪽이 전멸하면 끝난다", async ({ page }) => {
  await enterBattle(page);

  await expect
    .poll(async () => (await battle(page))?.phase, { timeout: 45_000 })
    .toMatch(/victory|defeat/);
});


test("하단 탭으로 렐릭 · 로비 · 연구소를 오간다", async ({ page }) => {
  await startAfterOpening(page);
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
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, (BASE_WIDTH * 5) / 6, BASE_HEIGHT - 180 + 90);
  await expect.poll(() => scene(page)).toBe("lab");

  const before = await page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil);
  expect(before).toBe(1200);

  await tap(page, 300, BASE_HEIGHT - 180 - 250); // 1회 발굴
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil)).toBe(1100);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.owned)).not.toBeUndefined();
  // 슬롯별 신규/DNA 배지가 모바일 안전 영역에 표시되는 모습을 회귀 자료로 남긴다.
  await page.screenshot({ path: `test-results/${test.info().project.name}-lab-pull-result.png`, fullPage: true });
});
