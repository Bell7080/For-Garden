import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap as tapGame, tapUntil } from "./canvasInput";

/** 타이틀에서 기본 작전의 편성 화면까지 공용 UI만 눌러 이동한다. */
async function openParty(page: Page): Promise<void> {
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await tapGame(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
  // 출격 선택판은 SD를 읽어 오므로 열릴 때까지 기다린 뒤 누른다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tapGame(page, BASE_WIDTH / 2, 550);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("stageMap");
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 180);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("party");
}

test("도디·메테의 도감 전신과 루카 포함 편성·전투 SD 에셋을 한 흐름에서 고정한다", async ({ page }, testInfo) => {
  await startAfterOpening(page);
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 로비는 이름이 바뀐 뒤에도 하단 탭의 입력면을 마저 만든다 — 될 때까지 다시 누른다.
  await tapUntil(page, BASE_WIDTH * 0.3, BASE_HEIGHT - 90, async () => (await page.evaluate(() => window.__PF_DEBUG?.scene)) === "relics");

  // 개체번호순 기본 도감에서 도디는 첫 카드, 메테는 기본 보유 구역의 여섯 번째 카드다.
  await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await tapUntil(page, 880, 1094, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-mette-catalog-fullbody.png`);
  await tapGame(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);

  // 로비로 돌아온 뒤 도디·메테·루카를 직접 골라 편성 SD와 같은 조합의 전투 SD를 연속 캡처한다.
  await tapGame(page, BASE_WIDTH / 2, BASE_HEIGHT - 90);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  await openParty(page);
  // 준비 화면은 직전 편성을 복원해 세 명이 이미 서 있다 — 먼저 내려야 원하는 셋을 순서대로 세울 수 있다.
  // 보유 순서는 토리카·렉시아·스피나·루카·도디·메테이고, 그리드는 다섯 칸마다 줄이 바뀐다.
  for (const [x, y] of [[116, 1080], [328, 1080], [540, 1080]] as const) await tapGame(page, x, y);
  for (const [x, y] of [[964, 1080], [116, 1324], [752, 1080]] as const) await tapGame(page, x, y);
  await page.waitForTimeout(1_000); // 비동기 Puppet 조립이 캡처 전에 세 자리를 모두 채우게 한다.
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-mette-luka-party-sd.png`);
  await tapGame(page, BASE_WIDTH / 2, 1700);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("battle");
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.battle?.playerOrder)).toEqual(["도디", "메테", "루카"]);
  await captureGame(page, `test-results/${testInfo.project.name}-asset-dodi-mette-luka-battle-sd.png`);
});
