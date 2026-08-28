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

/** 지도의 적 편성 팝업 첫 칸(왼쪽 적)의 한가운데. 팝업은 고른 노드 아래에 붙어 내려온다. */
const MAP_ENEMY_SLOT: [number, number] = [278, 1238];
/** 편성 미리보기에서 첫 적 옆에 붙는 `?` 뱃지. SD 자체는 입력을 받지 않는다. */
const PARTY_ENEMY_HELP: [number, number] = [366, 230];

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

/** 같은 포인터를 작은 거리만 옮겨 모바일 손떨림 허용 범위를 확인한다. */
async function tapWithMove(page: Page, from: [number, number], to: [number, number]): Promise<void> {
  const box = await canvasBox(page);
  const point = ([x, y]: [number, number]) => ({ x: box.x + (x / BASE_WIDTH) * box.width, y: box.y + (y / BASE_HEIGHT) * box.height });
  await page.mouse.move(point(from).x, point(from).y);
  await page.mouse.down();
  await page.mouse.move(point(to).x, point(to).y);
  await page.mouse.up();
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
  // 출격 선택판에서 스토리를 골라 기존 메인 작전 지도로 이어 간다.
  await tap(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 지도는 열려 있는 가장 뒤쪽 스테이지를 이미 골라 둔다. 출전만 누르면 편성으로 넘어간다.
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT - 180); // 출전
  await expect.poll(() => scene(page)).toBe("party");
}

/** 파티는 토리카 · 렉시아 · 스피나 순으로 고른다. */
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
  expect(state?.playerOrder).toEqual(["토리카", "렉시아", "스피나"]);
});

test("토리카 패시브 회복은 1080×1920 전장에서 초록 +수치로 표시된다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterBattle(page);
  // 배속은 코어 진행만 앞당기며 회복 숫자의 화면 수명은 정상 속도라 캡처할 시간이 유지된다.
  await tap(page, BASE_WIDTH - 335, 1360);
  await tap(page, BASE_WIDTH - 335, 1360);
  await expect.poll(async () => (await battle(page))?.healPopups ?? 0, { timeout: 45_000 }).toBeGreaterThan(0);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-battle-torika-passive-heal-1080x1920.png`, fullPage: true });
});

test("토리카 궁극기의 다중 기절 뱃지를 1080×1920 전장에서 함께 표시한다", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterBattle(page);
  // 가까이 모인 적이 둘 이상이고 토리카 궁극기가 준비된 순간만 눌러 범위 기절 장면을 고정한다.
  await tap(page, BASE_WIDTH - 335, 1360);
  await tap(page, BASE_WIDTH - 335, 1360);
  await expect.poll(async () => (await battle(page))?.ultimateReady.includes("토리카"), { timeout: 35_000 }).toBe(true);
  await tap(page, 190, 1620);
  await expect.poll(async () => (await battle(page))?.stunned?.length ?? 0, { timeout: 10_000 }).toBeGreaterThanOrEqual(2);
  await page.screenshot({ path: `test-results/${testInfo.project.name}-battle-multi-stun-1080x1920.png`, fullPage: true });
});

test("전투 시작의 빠른 연속 탭은 한 번만 진입하고 유효 편성을 보존한다", async ({ page }) => {
  await enterParty(page);
  await tap(page, ...TORIKA);
  await tap(page, ...LEXIA);
  await tap(page, ...SEIRA);

  // 첫 탭이 즉시 잠금을 걸므로 겹쳐 도착한 다음 입력이 저장/전환을 중복 실행하지 않는다.
  await Promise.all([tap(page, BASE_WIDTH / 2, 1700), tap(page, BASE_WIDTH / 2, 1700)]);
  await expect.poll(() => scene(page)).toBe("battle");
  expect((await battle(page))?.playerOrder).toEqual(["토리카", "렉시아", "스피나"]);
});

test("버튼 경계를 향한 작은 이동은 탭이고 큰 드래그는 취소된다", async ({ page }) => {
  await enterParty(page);
  await tap(page, ...TORIKA);
  await tap(page, ...LEXIA);
  await tap(page, ...SEIRA);

  // 80px 이동은 스크롤/드래그 의도로 보아 전투 진입을 취소한다.
  await tapWithMove(page, [BASE_WIDTH / 2, 1700], [BASE_WIDTH / 2 + 80, 1700]);
  await page.waitForTimeout(100);
  expect(await scene(page)).toBe("party");

  // 18px 이동은 손떨림으로 인정되어 정상 진입한다.
  await tapWithMove(page, [BASE_WIDTH / 2, 1700], [BASE_WIDTH / 2 + 18, 1700]);
  await expect.poll(() => scene(page)).toBe("battle");
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

test("토리카 폭주 설명은 성장 능력치로 환산된 수치를 표시한다", async ({ page }) => {
  // 토리카 상세의 패시브 위 폭주 뱃지를 누르고, 긴 동적 설명이 1080×1920 쪽지 안에 들어오는지 남긴다.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  await longPress(page, ...TORIKA);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await tap(page, 124, 1585);
  await page.screenshot({ path: `test-results/${test.info().project.name}-torika-ferocity-info-1080x1920.png`, fullPage: true });
});

test("관찰 일지에서 오늘의 질문과 발견 기록 영역을 확인한다", async ({ page }) => {
  // 기준 해상도에서 기존 두루마리 버튼으로 인터뷰가 자연스럽게 이어지는지 시각 회귀를 남긴다.
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await enterParty(page);
  await longPress(page, ...TORIKA);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await tap(page, 268, 300);
  await page.screenshot({ path: `test-results/${test.info().project.name}-observation-journal.png`, fullPage: true });
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

test("출전 전 지도와 편성에서도 같은 적 분석창이 열린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, ...SORTIE);
  // 출격 선택판은 스토리와 원정을 분리하므로 지도 검증은 스토리를 명시해 들어간다.
  await tap(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 지도의 적 편성 팝업에서 첫 칸을 누른다. 성장 입력이 없는 적 전용 창이 떠야 한다.
  await tap(page, MAP_ENEMY_SLOT[0], MAP_ENEMY_SLOT[1]);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-map-enemy-info.png`, fullPage: true });

  await tap(page, BASE_WIDTH - 120, BASE_HEIGHT - 120); // 뒤로가기 — 분석창만 닫힌다
  await expect.poll(() => infoOpen(page)).toBe(false);
  expect(await scene(page)).toBe("stageMap");

  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT - 180); // 출전 → 편성
  await expect.poll(() => scene(page)).toBe("party");
  await tap(page, PARTY_ENEMY_HELP[0], PARTY_ENEMY_HELP[1]);
  await expect.poll(() => infoOpen(page)).toBe(true);
});

test("전투 중 움직이는 적을 누르면 적 전용 정보창과 일러스트가 열린다", async ({ page }) => {
  await enterBattle(page);
  await expect.poll(async () => (await battle(page))?.enemyTargets?.length).toBe(3);

  // 전투원은 계속 움직이므로 디버그 계약이 공개한 현재 클릭 영역 중심을 읽은 직후 누른다.
  const target = (await battle(page))!.enemyTargets![0];
  await tap(page, target.x, target.y);
  await expect.poll(() => infoOpen(page)).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-battle-enemy-info.png`, fullPage: true });
});

test("전투 조작 칩으로 1·2·3배속과 자동 궁극기를 전환한다", async ({ page }) => {
  await enterBattle(page);
  expect(await battle(page)).toMatchObject({ speed: 1, autoUltimate: false });

  // 배속 칩은 1→2→3→1로 순환한다.
  await tap(page, BASE_WIDTH - 335, 1360);
  await expect.poll(async () => (await battle(page))?.speed).toBe(2);
  await tap(page, BASE_WIDTH - 335, 1360);
  await expect.poll(async () => (await battle(page))?.speed).toBe(3);

  // 자동 궁극기는 배속과 독립적으로 켜고 끌 수 있다.
  await tap(page, BASE_WIDTH - 130, 1360);
  await expect.poll(async () => (await battle(page))?.autoUltimate).toBe(true);
  // 세 번째 칩도 같은 줄에 있으며 누르는 즉시 저장된 스킵 상태가 디버그 관찰값에 반영된다.
  await tap(page, BASE_WIDTH - 130, 1268);
  await expect.poll(async () => (await battle(page))?.skipUltimatePresentation).toBe(true);
  await expect.poll(async () => (await battle(page))?.autoUltimate).toBe(true);
  await page.screenshot({ path: `test-results/${test.info().project.name}-battle-controls.png`, fullPage: true });
});

test("동시에 준비된 두 궁극기는 연출 하나씩 직렬 실행한다", async ({ page }) => {
  await enterBattle(page);
  // 빠르게 게이지를 모으되 자동 발동은 두 명이 준비될 때까지 켜지 않는다.
  await tap(page, BASE_WIDTH - 335, 1360);
  await tap(page, BASE_WIDTH - 335, 1360);
  await expect.poll(async () => (await battle(page))?.ultimateReady.length ?? 0, { timeout: 35_000 }).toBeGreaterThanOrEqual(2);
  await tap(page, BASE_WIDTH - 130, 1360);

  // 첫 연출 활성 중 다음 전투원이 큐에 남는 것이 곧 겹치지 않고 직렬화됐다는 관찰 계약이다.
  await expect.poll(async () => (await battle(page))?.ultimateSequenceActive, { timeout: 5_000 }).toBe(true);
  await expect.poll(async () => (await battle(page))?.ultimateQueue?.length ?? 0).toBeGreaterThanOrEqual(1);
  await page.screenshot({ path: `test-results/${test.info().project.name}-ultimate-serialized.png`, fullPage: true });
  // 두 연출이 모두 끝나면 큐와 입력 잠금이 함께 풀린다.
  await expect.poll(async () => (await battle(page))?.ultimateSequenceActive, { timeout: 10_000 }).toBe(false);
  await expect.poll(async () => (await battle(page))?.ultimateQueue ?? []).toEqual([]);
});

test("전투는 한쪽이 전멸하면 끝난다", async ({ page }) => {
  await enterBattle(page);

  await expect
    .poll(async () => (await battle(page))?.phase, { timeout: 45_000 })
    .toMatch(/victory|defeat/);
});


test("하단 탭으로 고고학 · 렐릭 · 로비 · 연구소 · 상점을 오간다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  const navY = BASE_HEIGHT - 180 + 90;
  // 다섯 슬롯의 중심 좌표를 차례로 눌러 화면 순서와 연결을 함께 고정한다.
  await tap(page, (BASE_WIDTH * 3) / 10, navY); // 렐릭
  await expect.poll(() => scene(page)).toBe("relics");

  await tap(page, BASE_WIDTH / 10, navY); // 고고학
  await expect.poll(() => scene(page)).toBe("archaeology");

  await tap(page, BASE_WIDTH / 2, navY); // 로비
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, (BASE_WIDTH * 7) / 10, navY); // 연구소
  await expect.poll(() => scene(page)).toBe("lab");

  await tap(page, (BASE_WIDTH * 9) / 10, navY); // 상점
  await expect.poll(() => scene(page)).toBe("shop");
  // 후원 탭에서 기간·즉시 수령·UTC 일일 제한을 구매 전에 읽을 수 있는 화면을 회귀 자료로 남긴다.
  await tap(page, 900, 225);
  // Phaser 캔버스 텍스트는 DOM 조회가 불가능하므로 재시작 렌더 한 프레임을 기다린다.
  await page.waitForTimeout(300);
  await page.screenshot({ path: `test-results/${test.info().project.name}-shop-patron-pass.png`, fullPage: true });
});

test("연구소에서 화석을 사용하면 렐릭 연구 결과가 뜬다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, (BASE_WIDTH * 7) / 10, BASE_HEIGHT - 180 + 90);
  await expect.poll(() => scene(page)).toBe("lab");

  const before = await page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil);
  expect(before).toBe(1200);

  await tap(page, 300, BASE_HEIGHT - 180 - 250); // 1회 연구
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil)).toBe(1100);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.owned)).not.toBeUndefined();
  // 슬롯별 신규/DNA 배지가 모바일 안전 영역에 표시되는 모습을 회귀 자료로 남긴다.
  await page.screenshot({ path: `test-results/${test.info().project.name}-lab-pull-result.png`, fullPage: true });
});

test("연구소 연구 확률 정보에서 현재 천장과 픽업·이월·중복 정책을 함께 확인한다", async ({ page }) => {
  await page.setViewportSize({ width: BASE_WIDTH, height: BASE_HEIGHT });
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, (BASE_WIDTH * 7) / 10, BASE_HEIGHT - 180 + 90);
  await expect.poll(() => scene(page)).toBe("lab");

  // 확률 정보 버튼의 팝업이 기준 모바일 화면에서 잘리지 않는지 회귀 이미지로 남긴다.
  await tap(page, BASE_WIDTH / 2, 390);
  await page.screenshot({ path: `test-results/${test.info().project.name}-lab-rates-policy.png`, fullPage: true });
});
