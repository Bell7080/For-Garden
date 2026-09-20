import { expect, test, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { archaeologySitePopupLayout } from "../../src/ui/archaeologySitePopupLayout";

/**
 * 고고학 화면과 그 상점의 눈 검사.
 *
 * **라벨 줄을 두 번 그려도 한 겹으로 남는지**가 이 편의 요점이다 — 탭을 씬에 직접 붙여 두던
 * 때는 누를 때마다 새 라벨이 옛 라벨 위에 겹쳐 글자가 두 겹으로 보였고, 그 상태로도 단위
 * 테스트는 전부 통과했다(씬 안의 표시 객체 수는 순수 규칙이 볼 수 없다).
 */

/** 지금 화면의 제목. 같은 씬이 두 자리를 맡으므로 **어느 상점인지**는 이 값이 가른다. */
function screenTitle(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.screenTitle);
}

/** 화면 이름을 읽는다. 디버그 채널은 언어를 따르지 않아 어느 언어에서나 같은 값이다. */
function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

/** 화면이 옮겨질 때까지 같은 자리를 다시 누른다. 입력면이 늦게 서는 화면이 있다. */
async function tapUntil(page: Page, x: number, y: number, target: string): Promise<void> {
  await expect.poll(async () => {
    if ((await scene(page)) === target) return target;
    await tap(page, x, y);
    return scene(page);
  }, { timeout: 30_000 }).toBe(target);
}

/**
 * 지도 노드가 실제로 선 자리를 화면에서 읽는다.
 *
 * **좌표를 손으로 적지 않는다** — 열세 자리가 얽힌 그물망이라 자리를 한 번 옮기는 것만으로
 * 여러 편이 동시에 죽는다. 지도가 도착할 때까지 기다렸다가 그중 하나를 고른다.
 */
async function mapNode(page: Page, siteId: string): Promise<{ x: number; y: number; state: string }> {
  const read = (): Promise<{ x: number; y: number; state: string } | undefined> => page.evaluate((id) => {
    const node = window.__PF_DEBUG?.archaeologyMap?.nodes.find((entry) => entry.siteId === id);
    return node === undefined ? undefined : { x: node.x, y: node.y, state: node.state };
  }, siteId);
  await expect.poll(read, { timeout: 30_000 }).toBeDefined();
  const node = await read();
  if (node === undefined) throw new Error(`지도에 ${siteId} 노드가 없습니다.`);
  return node;
}

/** 첫 유적 노드의 미리보기를 열고 서버 검증 시작 버튼을 누른다. */
async function startFirstArchaeologySite(page: Page): Promise<void> {
  const gate = await mapNode(page, "garden-gate");
  await tap(page, gate.x, gate.y);
  await page.waitForTimeout(300);
  await tapPreviewStart(page);
}

/** 미리보기 창의 「탐사 시작」. 창 크기는 보상 줄 수에서 자라므로 자리도 그 표에서 읽는다. */
async function tapPreviewStart(page: Page): Promise<void> {
  const spot = archaeologySitePopupLayout(3);
  await tap(page, BASE_WIDTH / 2 + spot.buttonCenters[1], BASE_HEIGHT / 2 + spot.buttonY);
}

/** 같은 창의 「닫기」. */
async function tapPreviewClose(page: Page): Promise<void> {
  const spot = archaeologySitePopupLayout(3);
  await tap(page, BASE_WIDTH / 2 + spot.buttonCenters[0], BASE_HEIGHT / 2 + spot.buttonY);
}

test("고고학의 두 탭과 고고학 상점을 연다", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await startAfterOpening(page, (session) => {
    session.wallet.fossil = 10_000;
    session.wallet.gold = 500_000;
    session.wallet.rawStone = 5_000;
  });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  // 하단 탭 첫 슬롯이 고고학이다.
  await tapUntil(page, BASE_WIDTH / 10, BASE_HEIGHT - 180 + 90, "archaeology");
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-strata.png`);

  // 판을 하나 열고 칸 몇 개를 판다 — 부순 칸에만 아래층과 보상이 드러나는지 보는 자리다.
  // **누를 자리는 화면이 알려 준다.** 격자 좌표를 손으로 적으면 판 규격을 한 번 옮기는 것만으로
  // 네 번의 입력이 전부 빈 곳을 누른다.
  await startFirstArchaeologySite(page);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.tiles.length),
    { timeout: 30_000 }).toBeGreaterThan(1);
  for (let round = 0; round < 4; round += 1) {
    const spot = await page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.tiles[0]);
    if (spot === undefined) break;
    await tap(page, spot.x, spot.y);
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.active), { timeout: 30_000 }).toBe(false);
    /*
     * **실제로 파였는지 센다.** `active`가 false로 돌아오는 것만 보던 때는, 입력이 죽어 아무
     * 일도 일어나지 않은 회차도 그대로 통과했다 — 특화 구역 칸의 입력면이 첫 굴착 뒤로 영영
     * 꺼져 있었는데 네 번을 헛눌러도 검사는 초록이었다.
     */
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.revealedIndices.length),
      { timeout: 30_000 }).toBe(round + 1);
  }
  await page.waitForTimeout(800);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-dug.png`);

  // 라벨 줄을 **여러 번** 오간다. 한 번만 눌러 보면 겹친 것이 한 겹처럼 보인다.
  const tabY = BASE_HEIGHT - 268;
  for (let round = 0; round < 2; round += 1) {
    await tap(page, 496, tabY);
    await page.waitForTimeout(300);
    await tap(page, 200, tabY);
    await page.waitForTimeout(300);
  }
  await tap(page, 496, tabY);
  await page.waitForTimeout(600);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-research.png`);

  // 빈 연구대는 **화면 가운데**에 선다. 끼우면 위로 올라가며 룬이 밀리고 상세·특성·버튼이
  // 차례로 들어선다 — 연출이 다 끝난 뒤를 찍는다.
  await tap(page, 540, 920);
  await page.waitForTimeout(900);
  await tap(page, 300, 700);
  await page.waitForTimeout(1_500);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-bench.png`);

  // 오른쪽 위 확률 정보 — 등급 상승 확률과 특성 목록을 한 장에서 읽는다.
  await tap(page, 984, 262);
  await page.waitForTimeout(700);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-odds.png`);
  await tap(page, 100, 100);
  await page.waitForTimeout(400);

  // 상점 입구는 제목 줄 오른쪽의 버튼이다 — 라벨 줄에는 이 화면의 갈래만 선다.
  const shopEntry = await page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.archaeology?.shop);
  expect(shopEntry).toBeTruthy();
  await tapUntil(page, shopEntry!.x, shopEntry!.y, "shop");
  /*
   * **첫 마디는 저절로 뜬다.**
   *
   * 띠는 잠깐 떴다 스스로 사라져 캡처 사이로 빠져나가므로 화면 그림이 아니라 검사 채널로
   * 확인한다. 점원이 들어와도 되는 순간을 씬의 시계(`time.now`)로 재던 때는 기다림이 0으로
   * 접혀 첫 마디가 화면 조립 중에 떴다 졌고, 그 뒤 한 박자를 더 두었을 때는 점원 묶음을
   * 기다린 시간 뒤에 붙어 등장 연출이 끝나고 한참 뒤에야 떴다.
   */
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.bubble?.body), { timeout: 30_000 }).toBeTruthy();
  // 점원 Puppet은 ZIP을 내려받아 세우므로 첫 프레임보다 늦게 도착한다.
  await page.waitForTimeout(1_000);
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-shop.png`);
});

test("고고학 상점을 다녀와도 로비 상점은 제 자리로 열린다", async ({ page }) => {
  test.setTimeout(300_000);
  // **Phaser는 데이터 없이 시작한 씬의 지난 데이터를 그대로 남긴다.** 고고학 상점을 한 번 열면
  // 로비의 `scene.start("shop")`이 그 자리를 물려받아 일반 상점 자리에 고고학 상점이 떴다.
  await startAfterOpening(page, (session) => { session.wallet.fossil = 10_000; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  // 먼저 고고학 상점을 열어 **지난 자리를 남긴다.** 입구는 제목 줄 오른쪽의 버튼이다.
  await tapUntil(page, BASE_WIDTH / 10, BASE_HEIGHT - 180 + 90, "archaeology");
  const archaeologyShop = await page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.archaeology?.shop);
  expect(archaeologyShop).toBeTruthy();
  await tapUntil(page, archaeologyShop!.x, archaeologyShop!.y, "shop");
  await expect.poll(() => screenTitle(page)).toBe("고고학 상점");

  // 우하단 뒤로가기는 들어온 자리로 돌아간다.
  await tapUntil(page, 974, 1800, "archaeology");
  await tapUntil(page, BASE_WIDTH / 2, BASE_HEIGHT - 180 + 90, "lobby");

  // 로비의 상점 레일 — 자리를 넘기지 않고 들어오는 경로다.
  const shopSpot = await page.evaluate(() => window.__PF_DEBUG?.storefrontControls?.lobby?.shop);
  expect(shopSpot).toBeTruthy();
  await tapUntil(page, shopSpot!.x, shopSpot!.y, "shop");
  await expect.poll(() => screenTitle(page)).toBe("상점");
});

test("지층 한 칸은 타격까지 입력을 잠그고 선택한 결과만 공개한다", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await startAfterOpening(page, (session) => { session.wallet.fossil = 10_000; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");
  await tapUntil(page, BASE_WIDTH / 10, BASE_HEIGHT - 180 + 90, "archaeology");

  // 새 판의 입력면이 실제로 게시될 때까지 기다린 뒤 시작 버튼을 누른다.
  await startFirstArchaeologySite(page);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.tiles.length),
    { timeout: 30_000 }).toBeGreaterThan(1);
  const targets = await page.evaluate(() => window.__PF_DEBUG!.archaeologyDig!.tiles.slice(0, 2));
  const before = await page.evaluate(() => window.__PF_DEBUG!.archaeologyDig!.revealedIndices);

  // 첫 입력 직후 같은 칸과 다른 칸을 연달아 눌러도 전역 잠금이 요청을 하나로 제한해야 한다.
  await tap(page, targets[0].x, targets[0].y);
  await tap(page, targets[0].x, targets[0].y);
  await tap(page, targets[1].x, targets[1].y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.requests)).toBe(1);
  /*
   * **연출이 끝나기를 기다리는 자리는 기본 제한(5초)으로 부족하다.** 시간표 자체는 0.45초
   * 남짓이고(`StrataDigEffect`의 진입·회전·충돌 합 — 퇴장은 더 이상 기다리지 않는다)
   * 그마저도 Phaser의 Tween과 Timer는 프레임이 돌아야
   * 나아가고, 보이지 않는 창에서 도는 헤드리스 브라우저는 그 프레임을 훨씬 드물게 준다 —
   * 실측에서 입력부터 잠금 해제까지 약 6초였다. 위 입력면 게시를 기다리는 줄이 이미 같은
   * 이유로 30초를 쓰고 있어 같은 값을 준다. 화면을 여는 시간이 아니라 **프레임이 오는 속도**에
   * 걸리는 대기라 실제 기기에서는 1초 남짓이다.
   */
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.active),
    { timeout: 30_000 }).toBe(false);

  // 서버 결과는 충돌 이정표 뒤 선택한 컨테이너에만 반영되고 다른 흙은 그대로 남는다.
  const after = await page.evaluate(() => window.__PF_DEBUG!.archaeologyDig!.revealedIndices);
  expect(after).toEqual([...before, targets[0].index]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.impactIndex)).toBeUndefined();
  // 결과 한 칸만 바뀐 뒤 판의 이음매와 보상 액자가 유지되는지도 같은 회귀에서 남긴다.
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-dig-effect.png`);
});

test("유적 지도 이동 → 잠긴 유적 확인 → 열린 유적 미리보기 → 탐사 시작", async ({ page }, testInfo) => {
  test.setTimeout(300_000);
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");
  await tapUntil(page, BASE_WIDTH / 10, BASE_HEIGHT - 180 + 90, "archaeology");
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-map.png`);

  // 그물망을 왼쪽으로 밀어 잠긴 심층 노드까지 본다. 민 뒤의 자리는 화면이 다시 알려 준다.
  await page.mouse.move(850, 760); await page.mouse.down(); await page.mouse.move(300, 760, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(250);
  const sanctum = await mapNode(page, "deep-sanctum");
  expect(sanctum.state).toBe("locked");
  await tap(page, sanctum.x, sanctum.y);
  await page.waitForTimeout(300);
  // 잠긴 미리보기의 시작 자리는 입력해도 판이 생기지 않는다.
  await tapPreviewStart(page);
  expect(await page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.tiles.length ?? 0)).toBe(0);
  await tapPreviewClose(page);
  await page.waitForTimeout(250);

  // 지도를 원위치로 되밀고 열린 첫 유적의 미리보기에서 탐사를 시작한다.
  await page.mouse.move(300, 760); await page.mouse.down(); await page.mouse.move(900, 760, { steps: 8 }); await page.mouse.up();
  await page.waitForTimeout(250);
  const gate = await mapNode(page, "garden-gate");
  await tap(page, gate.x, gate.y);
  await page.waitForTimeout(300);
  // 다섯 칸 게이지와 읽을 수 있는 N/5 문구가 함께 서는 실제 미리보기를 시각 회귀로 남긴다.
  await captureGame(page, `test-results/${testInfo.project.name}-archaeology-site-preview.png`);
  await tapPreviewStart(page);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.archaeologyDig?.tiles.length), { timeout: 30_000 }).toBeGreaterThan(1);
});
