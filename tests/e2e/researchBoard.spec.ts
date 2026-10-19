import { test, expect, type Page } from "@playwright/test";
import { captureGameFailure, installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil } from "./canvasInput";
import { LAB_CHROME, LAB_TITLE } from "../../src/ui/labLayout";
import { researchBoardLayout } from "../../src/ui/researchBoardLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;
const NAV_TOP = BASE_HEIGHT - 180;
const diagnosticErrors = new WeakMap<Page, string[]>();

test.afterEach(async ({ page }, info) => {
  if (process.env.PF_E2E_INPUT_DIAGNOSTIC !== "1" || info.status === info.expectedStatus) return;
  await info.attach("research-errors", { body: JSON.stringify(diagnosticErrors.get(page) ?? [], null, 2), contentType: "application/json" });
  await captureGameFailure(page, info);
});

/**
 * 균열 연출이 끝나기를 기다리는 시간.
 *
 * 세 단계의 합은 게임 시간으로 2초뿐이지만, GPU 없는 컨테이너는 3fps 언저리라 그 2초가 실제로는
 * 수십 초다(Phaser 시계는 프레임마다 최대 33ms만 흐른다). 화면이 느린 것이지 멈춘 것이 아니다.
 */
const CRACK_TIMEOUT = 120_000;

/** 새로 만난 렐릭의 소개 장면이 떠 있는가. */
function showcase(page: Page): Promise<{ relicId: string; phase: string } | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.relicShowcase);
}

/**
 * 기다리던 상태가 될 때까지 누른다. 새로 만난 렐릭이면 칸이 열리기 **전에** 소개 장면이 먼저
 * 서므로, 장면이 떠 있는 동안의 누름은 그 장면을 넘긴다(목소리 → 등장 → 닫기). 막마다 한 장씩
 * 캡처를 남긴다 — 눈으로 검수하는 자리다.
 */
async function tapThrough(page: Page, x: number, y: number, done: () => Promise<boolean>): Promise<void> {
  const captured = new Set<string>();
  await tapUntil(page, x, y, async () => {
    const shown = await showcase(page);
    if (shown) {
      const key = `${shown.relicId}-${shown.phase}`;
      if (!captured.has(key)) {
        captured.add(key);
        if (process.env.PF_E2E_RESEARCH_DIAGNOSTIC === "1") console.log("[research showcase]", key);
        await page.waitForTimeout(shown.phase === "stage" ? 2_500 : 1_500);
        await captureGame(page, `test-results/${test.info().project.name}-relic-showcase-${key}.png`);
      }
      return false;
    }
    return done();
  }, { attempts: 30, gapMs: 3_000 });
}

/** 열린 칸 수만 읽는다. 어느 칸에 무엇이 들었는지는 화면이 공개하지 않는다. */
function board(page: Page): Promise<{ slots: number; opened: number } | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.researchBoard);
}

test("10연 결과는 뒤집힌 칸으로 깔리고 눌러야 열린다", async ({ page }) => {
  // 여러 신규 렐릭의 소개·캡처를 모두 거치므로 단일 연구보다 넉넉한 전체 제한을 둔다.
  test.setTimeout(420_000);
  const errors: string[] = [];
  diagnosticErrors.set(page, errors);
  page.on("pageerror", error => errors.push(error.stack ?? error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  if (process.env.PF_E2E_INPUT_DIAGNOSTIC === "1") await installGameHandleProbe(page);
  await startAfterOpening(page, (session) => { session.wallet.fossil = 10; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tapUntil(page, (BASE_WIDTH * 7) / 10, NAV_TOP + 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "lab");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lab");
  // 별도 진단 실행에서만 잡힌 예외도 기록한다. 게임의 catch 처리와 결과 판정은 그대로 둔다.
  if (process.env.PF_E2E_RESEARCH_DIAGNOSTIC === "1") {
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Debugger.enable");
    cdp.on("Debugger.paused", event => {
      console.log("[research exception]", event.data?.description ?? event.reason);
      errors.push(JSON.stringify({ reason: event.reason, error: event.data?.description,
        frames: event.callFrames.slice(0, 8).map((frame: { functionName: string; location: unknown }) => ({ name: frame.functionName, location: frame.location })) }));
      void cdp.send("Debugger.resume").catch(() => undefined);
    });
    await cdp.send("Debugger.setPauseOnExceptions", { state: "all" });
  }
  // 첫 복원 연구는 10연 전용이라 버튼이 가운데로 이동한다(화석 8개).
  await tap(page, BASE_WIDTH / 2, LAB_CHROME.pull.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.wallet?.fossil)).toBe(2);

  // 균열이 끝나면 칸 열 장이 뒤집힌 채 깔린다. 이때는 아직 아무것도 열려 있지 않다.
  try {
    await expect.poll(() => board(page), { timeout: CRACK_TIMEOUT }).toEqual({ slots: 10, opened: 0 });
  } catch (error) {
    const state = await page.evaluate(() => ({ debug: window.__PF_DEBUG,
      cinematic: document.querySelector(".rc-root")?.getAttribute("data-phase") }));
    await test.info().attach("research-failure-state", { body: JSON.stringify({ errors, state }, null, 2), contentType: "application/json" });
    throw error;
  }
  await captureGame(page, `test-results/${test.info().project.name}-research-board-facedown.png`);

  // 칸 하나를 누르면 그 칸만 열린다. 자리는 화면이 쓰는 배치표에서 그대로 읽는다.
  const layout = researchBoardLayout(10, BASE_WIDTH);
  await tapThrough(page, layout.cells[0].x, layout.cells[0].y, async () => ((await board(page))?.opened ?? 0) >= 1);
  await expect.poll(() => board(page), { timeout: 30_000 }).toMatchObject({ opened: 1 });

  // 남은 칸은 한 번에 열 수 있다. 새로 만난 렐릭이 남아 있으면 그 소개가 먼저 차례로 돌고, 그
  // 장면이 떠 있는 동안의 누름은 장면을 넘긴다.
  await tapThrough(page, BASE_WIDTH - 150, 100, async () => (await board(page))?.opened === 10);
  await captureGame(page, `test-results/${test.info().project.name}-research-board-opened.png`);

  expect(errors).toEqual([]);
  // 다 열린 뒤에는 확인 버튼이 아니라 화면 아무 곳이나 눌러 돌아간다.
  await tap(page, BASE_WIDTH / 2, 200);
  await expect.poll(() => board(page), { timeout: 30_000 }).toBeUndefined();
});

test("한 장은 가운데에 크게 한 칸만 깔린다", async ({ page }) => {
  await startAfterOpening(page, (session) => { session.wallet.fossil = 1; });
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tapUntil(page, (BASE_WIDTH * 7) / 10, NAV_TOP + 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "lab");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lab");
  await tap(page, BASE_WIDTH - LAB_TITLE.arrow.x, LAB_TITLE.arrow.y); // 화석 연구(단일)를 고른다.
  await tap(page, 300, LAB_CHROME.pull.y); // 1회 연구

  await expect.poll(() => board(page), { timeout: CRACK_TIMEOUT }).toEqual({ slots: 1, opened: 0 });
  const layout = researchBoardLayout(1, BASE_WIDTH);
  await tapThrough(page, layout.cells[0].x, layout.cells[0].y, async () => ((await board(page))?.opened ?? 0) >= 1);
  await expect.poll(() => board(page), { timeout: 30_000 }).toEqual({ slots: 1, opened: 1 });
  await captureGame(page, `test-results/${test.info().project.name}-research-board-single.png`);

  // 한 칸뿐이라 그 칸을 여는 순간 판이 끝난다. 화면을 누르면 연구소로 돌아간다.
  await tap(page, BASE_WIDTH / 2, 300);
  await expect.poll(() => board(page), { timeout: 30_000 }).toBeUndefined();
});
