import { test, expect } from "@playwright/test";
import { startAfterOpening } from "./openingSave";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;
/** 900×1320 발굴 판의 중심에서 PopupLayer 공용 닫기 버튼까지의 오프셋이다. */
const PANEL_CLOSE_X = 410;
const PANEL_CLOSE_Y = 620;

/** 기준 게임 좌표를 FIT 스케일이 적용된 모바일 캔버스 좌표로 바꿔 누른다. */
async function tapGame(page: import("@playwright/test").Page, x: number, y: number): Promise<void> {
  const canvas = page.locator("canvas");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("캔버스를 찾지 못했다");
  await canvas.click({ position: { x: (x / BASE_WIDTH) * box.width, y: (y / BASE_HEIGHT) * box.height } });
}

/** 모바일 저장 상태에서 타이틀과 지도만 통과해 편성 미리보기를 연다. */
async function enterParty(page: import("@playwright/test").Page): Promise<void> {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 180);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("party");
}

test("세로형 화면에서 캔버스가 뜨고 첫 방문은 오프닝으로 들어간다", async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (err) => consoleErrors.push(err.message));

  await page.goto("/");

  const canvas = page.locator("canvas");
  await expect(canvas).toBeVisible();

  // 타이틀이 로딩 화면을 겸한다. ready는 다섯 칸이 다 찬 뒤에만 true가 된다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("title");
  await page.waitForFunction(() => window.__PF_DEBUG?.ready === true);

  await page.screenshot({ path: `test-results/${test.info().project.name}-title.png` });

  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();
  const aspect = box!.height / box!.width;
  expect(aspect).toBeGreaterThan(1); // 세로가 더 길어야 한다 (letterbox 포함)

  // 로딩이 끝나면 화면 아무 곳이나 눌러 넘어간다. 저장이 없으면 오프닝 스토리가 먼저다.
  await canvas.click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("opening");

  expect(consoleErrors, `콘솔 에러 발생: ${consoleErrors.join(", ")}`).toEqual([]);
});

test("오프닝을 이미 본 저장이면 타이틀에서 로비로 바로 간다", async ({ page }) => {
  await startAfterOpening(page);

  await page.locator("canvas").click();
  await expect
    .poll(() => page.evaluate(() => window.__PF_DEBUG?.scene))
    .toBe("lobby");
});

test("방치 발굴 팝업은 좁은 로비 위 한 장으로 열리고 뒤 입력을 차단한 뒤 닫힌다", async ({ page }) => {
  await startAfterOpening(page);
  await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");

  // 왼쪽 하단 발굴 입구를 연타해도 조회 상태를 공유하는 팝업 한 장만 유지한다.
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await tapGame(page, 250, BASE_HEIGHT - 445);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBe("ready");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await page.screenshot({ path: `test-results/${test.info().project.name}-idle-excavation-popup.png` });

  // 어두운 backdrop이 출격 좌표의 입력을 먹으므로 로비와 애착 캐릭터가 그대로 남는다.
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 기준 1080×1920의 우상단 닫기는 작은 viewport에서도 FIT 안전 영역 안에 있다.
  await tapGame(page, BASE_WIDTH / 2 + PANEL_CLOSE_X, BASE_HEIGHT / 2 - PANEL_CLOSE_Y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.idleExcavationPopup)).toBeUndefined();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});

test("설정 탭은 텍스트 확대·스크롤·두 단계 초기화를 좁은 모바일에서 안전하게 처리한다", async ({ page }) => {
  await startAfterOpening(page); await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 58, 86);
  // 미구현 토스트가 아니라 실제 설정 화면의 사용자 표시 제목까지 렌더됐는지 확인한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.screenTitle)).toBe("환경 설정");
  // 새 고정 헤더 아래 첫 사운드 슬라이더가 88px 이상의 터치 행으로 저장을 즉시 반영한다.
  await tapGame(page, 800, 392); let saved = await page.evaluate(() => localStorage.getItem("eternal-city.local-save")); expect(saved).toContain('"masterVolume"');
  // 접근성 탭에서 공용 텍스트 배율을 올린 뒤 재생성된 탭이 잘리지 않는지 캡처한다.
  await tapGame(page, 743, 210); await tapGame(page, 800, 392);
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.accessibility.textScale)).toBe(1.15);
  await page.screenshot({ path: `test-results/${test.info().project.name}-settings-accessibility-expanded.png` });
  // 지원·데이터 탭은 자체 높이에 종속되어 스크롤되고 초기화 팝업이 배경 입력을 가로막는다.
  await tapGame(page, 946, 210); await page.mouse.wheel(0, 800); await page.screenshot({ path: `test-results/${test.info().project.name}-settings-support-scrolled.png` });
  await tapGame(page, 450, 1026); await tapGame(page, 690, 1065);
  saved = await page.evaluate(() => localStorage.getItem("eternal-city.local-save")); expect(saved).not.toBeNull();
  await tapGame(page, 690, 1065); await expect.poll(() => page.evaluate(() => localStorage.getItem("eternal-city.local-save"))).toBeNull();
  // 검증 이후 다음 케이스에 영향을 주지 않도록 오프닝 완료 저장을 다시 준비한다.
  await startAfterOpening(page);
  await page.reload(); await page.waitForFunction(() => window.__PF_DEBUG?.ready === true); await page.locator("canvas").click();
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby"); expect(await page.evaluate(() => JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.sound.masterVolume)).toBeGreaterThan(0);
  await tapGame(page, BASE_WIDTH - 58, 86); await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("settings"); await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
});

test("가로로 눕히면 세로로 돌려달라는 안내가 뜬다", async ({ page }) => {
  const viewport = page.viewportSize();
  if (viewport) {
    await page.setViewportSize({ width: viewport.height, height: viewport.width });
  }

  await page.goto("/");
  await expect(page.locator("#rotate-overlay")).toBeVisible();
});

test("모바일 편성 상단의 자동 배치 버튼과 자리별 상성 화살표가 표시된다", async ({ page }) => {
  await enterParty(page);
  const before = await page.evaluate(() => window.__PF_DEBUG?.party);

  // 버튼 중심은 화면 안이면서 제목(70)·속성 안내 중앙(178)·첫 도움말(366,230)을 피한 좌측 조작 칸이다.
  expect(before?.autoButton.x).toBeGreaterThan(0);
  expect(before?.autoButton.x).toBeLessThan(BASE_WIDTH / 3);
  expect(before?.autoButton.y).toBeGreaterThan(150);
  expect(before?.autoButton.y).toBeLessThan(230);
  expect(before?.visibleAffinityDirections).toBe(0);

  await tapGame(page, before!.autoButton.x, before!.autoButton.y);
  // 고정 적 조합에서는 자동 편성 셋 중 상쇄 중립 한 명을 숨기고 유리/불리 두 방향만 남긴다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.party?.visibleAffinityDirections)).toBe(2);
  await page.screenshot({ path: `test-results/${test.info().project.name}-party-affinity-arrows.png` });
});
