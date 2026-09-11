import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil } from "./canvasInput";
import { researchBoardLayout } from "../../src/ui/researchBoardLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;
const NAV_TOP = BASE_HEIGHT - 180;

/**
 * 균열 연출이 끝나기를 기다리는 시간.
 *
 * 세 단계의 합은 게임 시간으로 2초뿐이지만, GPU 없는 컨테이너는 3fps 언저리라 그 2초가 실제로는
 * 수십 초다(Phaser 시계는 프레임마다 최대 33ms만 흐른다). 화면이 느린 것이지 멈춘 것이 아니다.
 */
const CRACK_TIMEOUT = 120_000;

/** 열린 칸 수만 읽는다. 어느 칸에 무엇이 들었는지는 화면이 공개하지 않는다. */
function board(page: Page): Promise<{ slots: number; opened: number } | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.researchBoard);
}

test("10연 결과는 뒤집힌 칸으로 깔리고 눌러야 열린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, (BASE_WIDTH * 7) / 10, NAV_TOP + 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lab");
  await tap(page, 780, NAV_TOP - 250); // 10회 연구

  // 균열이 끝나면 칸 열 장이 뒤집힌 채 깔린다. 이때는 아직 아무것도 열려 있지 않다.
  await expect.poll(() => board(page), { timeout: CRACK_TIMEOUT }).toEqual({ slots: 10, opened: 0 });
  await captureGame(page, `test-results/${test.info().project.name}-research-board-facedown.png`);

  // 칸 하나를 누르면 그 칸만 열린다. 자리는 화면이 쓰는 배치표에서 그대로 읽는다.
  const layout = researchBoardLayout(10, BASE_WIDTH);
  await tap(page, layout.cells[0].x, layout.cells[0].y);
  await expect.poll(() => board(page), { timeout: 30_000 }).toMatchObject({ opened: 1 });

  // 남은 칸은 한 번에 열 수 있다. 첫 대면이 떠 있으면 그 누름이 먼저 연출을 넘긴다.
  await tapUntil(page, BASE_WIDTH - 150, 100, async () => (await board(page))?.opened === 10, { attempts: 12, gapMs: 4_000 });
  await captureGame(page, `test-results/${test.info().project.name}-research-board-opened.png`);

  // 다 열린 뒤에는 확인 버튼이 아니라 화면 아무 곳이나 눌러 돌아간다.
  await tap(page, BASE_WIDTH / 2, 200);
  await expect.poll(() => board(page), { timeout: 30_000 }).toBeUndefined();
});

test("한 장은 가운데에 크게 한 칸만 깔린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await tap(page, (BASE_WIDTH * 7) / 10, NAV_TOP + 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lab");
  await tap(page, 300, NAV_TOP - 250); // 1회 연구

  await expect.poll(() => board(page), { timeout: CRACK_TIMEOUT }).toEqual({ slots: 1, opened: 0 });
  const layout = researchBoardLayout(1, BASE_WIDTH);
  await tap(page, layout.cells[0].x, layout.cells[0].y);
  await expect.poll(() => board(page), { timeout: 30_000 }).toEqual({ slots: 1, opened: 1 });
  // 신규였다면 이 자리에 첫 대면이 서 있고, 아니면 열린 칸 하나가 가운데에 남는다.
  await captureGame(page, `test-results/${test.info().project.name}-research-board-single.png`);

  // 한 칸뿐이라 그 칸을 여는 순간 판이 끝난다. 화면을 누르면 연구소로 돌아간다.
  await tap(page, BASE_WIDTH / 2, 300);
  await expect.poll(() => board(page), { timeout: 30_000 }).toBeUndefined();
});
