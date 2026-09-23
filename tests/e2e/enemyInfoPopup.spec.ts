import { test, expect, type Page } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, waitForDebugState } from "./canvasInput";
import { ENEMY_INFO } from "../../src/ui/enemyInfoLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

test("적을 누르면 정보창을 줄인 팝업이 열린다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 180 - 245); // 출격
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toContain("출격");
  await tap(page, BASE_WIDTH / 2, 550); // 스토리
  await expect.poll(() => scene(page)).toBe("stageMap");

  // 미리보기 SD가 실제로 붙은 뒤에 누른다 — 판이 비동기로 그려지기 때문이다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.enemyPreview?.enemyTargets?.length ?? 0), { timeout: 60_000 }).toBeGreaterThan(0);
  const target = (await page.evaluate(() => window.__PF_DEBUG!.enemyPreview!.enemyTargets[0]))!;
  await tap(page, target.x, target.y);

  // 머리글은 개체 이름이 아니라 "정보창"이다 — 이름은 판 안의 이름 블록이 말한다.
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles), { timeout: 20_000 }).toContain("정보창");
  // 원화와 SD가 실제 정보창 컨테이너로 교체된 뒤에만 캡처한다.
  await waitForDebugState(page, () => window.__PF_DEBUG?.infoAssetReady, { portrait: true, sd: true }, { timeout: 60_000 });
  await captureGame(page, `test-results/${test.info().project.name}-enemy-info.png`);

  // 능력치 칸의 돋보기는 정보창의 그것과 **같은 함수**가 연다. 창 위에 창이 쌓이는지까지 본다.
  await tap(page, 891, 839);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["정보창", "능력치 상세"]);
  await tap(page, 540, 300);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["정보창"]);

  /*
   * 스킬 액자를 누르면 아군 창과 같은 쪽지가 그 위에 뜬다.
   *
   * **쪽지는 제목표를 달지 않으므로 `popupTitles`가 세지 않는다** — 그 수로 기다리면 영영
   * 오지 않는 2를 기다린다. 열렸다는 것은 그림으로 남기고, 닫은 뒤 머리글이 하나로 되돌아오는
   * 것으로 층이 실제로 쌓였다 풀렸음을 확인한다.
   */
  await tap(page, BASE_WIDTH / 2 - 8, BASE_HEIGHT / 2 + 424);
  await captureGame(page, `test-results/${test.info().project.name}-enemy-skill.png`);
  await tap(page, 540, 200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["정보창"]);

  /*
   * **폭주 뱃지 위의 역할 칸**을 누르면 같은 쪽지가 그 자리의 배율과 강인함·경감을 말한다.
   * 쪽지는 제목표가 없으므로 그림으로 남기고, 닫힌 뒤 머리글이 하나로 돌아오는 것만 확인한다.
   */
  await tap(page, BASE_WIDTH / 2 + ENEMY_INFO.skills.x, BASE_HEIGHT / 2 + ENEMY_INFO.skills.y + ENEMY_INFO.roleBadgeOffsetY);
  await captureGame(page, `test-results/${test.info().project.name}-enemy-role.png`);
  await tap(page, 540, 200);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles)).toEqual(["정보창"]);

  /*
   * **적에게도 관찰 일지가 열린다.**
   *
   * 개체번호·프로젝트·발굴지와 소속 엠블럼은 적 정의에도 온전히 있는데 그것을 여는 문이 아군
   * 정보창에만 있어, 화면 어디에서도 읽을 수 없었다. 인터뷰 영역만 서지 않는다.
   */
  const journal = {
    x: BASE_WIDTH / 2 + ENEMY_INFO.journalButton.x,
    y: BASE_HEIGHT / 2 + ENEMY_INFO.journalButton.y,
  };
  await tap(page, journal.x, journal.y);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.popupTitles), { timeout: 20_000 }).toEqual(["정보창", "관찰 일지"]);
  await captureGame(page, `test-results/${test.info().project.name}-enemy-journal.png`);
});
