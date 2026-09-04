import type { Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";

/**
 * 게임 캔버스를 누르는 공용 입력.
 *
 * 스펙마다 같은 헬퍼를 따로 두면 **느린 쪽이 그대로 살아남는다.** 실제로 그랬다 — 절반은
 * `locator.click()`을 썼는데, Phaser 캔버스는 매 프레임 다시 그려지므로 Playwright의 안정성
 * 대기가 좀처럼 끝나지 않는다. GPU 없는 컨테이너에서 재 보면 한 번 누르는 데
 * `boundingBox()` 2.0초 + `locator.click()` 3.9초 = **6.3초**가 들었고, 같은 자리를
 * `page.mouse.click`으로 누르면 0.37초였다. 전투는 14초면 끝나므로 그 차이가 곧 "조작 세 번을
 * 넣을 수 있는가"를 갈랐다.
 *
 * 그래서 이 파일 하나가 규칙을 갖는다.
 * - 캔버스 상자는 브라우저의 `getBoundingClientRect()`로 **매번 다시** 잰다(0.3초).
 * - 누르는 것은 언제나 `page.mouse`다. 캔버스는 늘 움직이므로 안정성 대기가 뜻이 없다.
 */
interface Box { x: number; y: number; width: number; height: number }

/**
 * 지금 캔버스가 놓인 자리.
 *
 * Playwright의 `boundingBox()`는 요소가 "안정"해질 때까지 기다리는데, 매 프레임 다시 그려지는
 * 캔버스에서는 그 대기가 좀처럼 끝나지 않는다(실측 2.0초). 여기서는 브라우저에서 직접
 * `getBoundingClientRect()`를 읽어 0.3초에 같은 값을 얻는다.
 *
 * **값을 캐시하지 않는다.** Phaser의 Scale.FIT은 뷰포트가 바뀌거나 첫 프레임이 자리를 잡을 때
 * 캔버스 크기를 다시 정하므로, 한 번 재 둔 상자로 계속 누르면 나중 조작이 통째로 빗나간다 —
 * 그 빗나감은 "눌렀는데 아무 일도 없다"로 나타나 원인을 찾기 어렵다.
 */
export async function canvasBox(page: Page): Promise<Box> {
  const box = await page.evaluate(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
  if (!box) throw new Error("캔버스를 찾지 못했다");
  return box;
}

/** 기준 해상도(1080×1920) 좌표를 실제 화면 좌표로 옮긴다. */
export function gamePoint(box: Box, x: number, y: number): { x: number; y: number } {
  return { x: box.x + (x / BASE_WIDTH) * box.width, y: box.y + (y / BASE_HEIGHT) * box.height };
}

/**
 * 누른 뒤 게임이 그 입력을 처리할 틈.
 *
 * 예전의 `locator.click()`은 안정성 대기로 몇 초를 흘려보냈고, 스펙들은 그 우연한 틈에 기대
 * 다음 조작을 이어 갔다. 대기를 걷어 내면서 그 틈을 **눈에 보이는 값**으로 남긴다 — 씬이
 * 바뀌거나 판이 열릴 때까지 기다려야 하는 자리는 스펙이 `expect.poll`로 따로 확인한다.
 */
const SETTLE_MS = 150;

/** 기준 해상도 좌표를 눌렀다 뗀다. 모바일 우선 입력이라 확정은 `pointerup`에서 난다. */
export async function tap(page: Page, x: number, y: number): Promise<void> {
  const point = gamePoint(await canvasBox(page), x, y);
  await page.mouse.click(point.x, point.y);
  await page.waitForTimeout(SETTLE_MS);
}

/**
 * 원하는 상태가 될 때까지 같은 자리를 다시 누른다.
 *
 * 씬이 이름을 바꾼 순간에도 그 화면의 입력면은 아직 없을 수 있다 — 로비의 하단 탭, 로비 위에
 * 뜨는 판처럼 원화·SD를 읽고 나서 만들어지는 것들이 그렇다. 그런 자리를 한 번만 누르면 허공을
 * 치고, 뒤이은 5초 대기는 "왜 안 눌렸는지" 대신 "상태가 안 바뀐다"만 말한다. 예전의 느린
 * `locator.click()`은 안정성 대기로 그 몫을 우연히 채워 주고 있었다.
 *
 * 눌러도 되는 자리를 반복해 누르는 것은 사용자가 실제로 하는 일과 같다 — 반응이 없으면 한 번 더
 * 누른다. 상태가 바뀌면 곧바로 멈춘다.
 *
 * **한 번 더 눌러도 같은 결과인 자리에만 쓴다.** 화면을 옮기거나 판을 여는 자리가 그렇다. 급여
 * 처럼 누를 때마다 재화를 쓰거나, 배경을 누르면 닫히는 판을 여는 조작에는 쓰지 않는다 — 늦게
 * 열린 판을 다음 누름이 도로 닫는다. 그런 자리는 그려질 틈을 두고 한 번만 누른다.
 */
export async function tapUntil(
  page: Page,
  x: number,
  y: number,
  ready: () => Promise<boolean>,
  options: { attempts?: number; gapMs?: number } = {},
): Promise<void> {
  const attempts = options.attempts ?? 10;
  const gapMs = options.gapMs ?? 1_200;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (await ready()) return;
    await tap(page, x, y);
    const until = Date.now() + gapMs;
    while (Date.now() < until) {
      if (await ready()) return;
      await page.waitForTimeout(60);
    }
  }
  if (!(await ready())) throw new Error(`${attempts}번 눌러도 기다리던 상태가 되지 않았다: (${x}, ${y})`);
}

/** 같은 포인터를 두 점 사이로 끌어 옮긴다. 손떨림 허용과 지도 드래그가 함께 쓴다. */
export async function drag(
  page: Page,
  from: [number, number],
  to: [number, number],
  options: { steps?: number } = {},
): Promise<void> {
  const box = await canvasBox(page);
  const start = gamePoint(box, from[0], from[1]);
  const end = gamePoint(box, to[0], to[1]);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(end.x, end.y, options.steps === undefined ? undefined : { steps: options.steps });
  await page.mouse.up();
}

/** 꾹 누르기. 편성 화면에서 정보창을 여는 조작이다. */
export async function longPress(page: Page, x: number, y: number, ms = 700): Promise<void> {
  const point = gamePoint(await canvasBox(page), x, y);
  await page.mouse.move(point.x, point.y);
  await page.mouse.down();
  await page.waitForTimeout(ms);
  await page.mouse.up();
}

/**
 * 화면 캡처.
 *
 * 기기 프로필의 배율(pixel-7은 2.625배)을 그대로 두면 1080×1920 화면이 2835×5040으로 구워져
 * 한 장에 5초 넘게 걸린다. 눈으로 보는 회귀에는 CSS 픽셀 크기로 충분하다.
 */
export async function captureGame(page: Page, path: string): Promise<void> {
  await page.screenshot({ path, scale: "css" });
}
