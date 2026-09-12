import { expect, test } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil } from "./canvasInput";

/**
 * 언어를 바꾼 채 화면을 차례로 열어 본다.
 *
 * 문구 표에 키가 있는지는 단위 테스트가 지키지만, **그 글자가 실제로 그려지는지**는 캔버스를
 * 봐야 안다 — 글꼴에 없는 글자는 빈칸이 되고, 길어진 문장은 판 밖으로 나간다.
 */
// 캡처는 기본으로 테스트 산출물 폴더에 쌓는다 — 저장소 안에 그림이 남지 않게 한다.
const OUT = process.env.WALK_OUT ?? "test-results/languageWalk";
const scene = (page: import("@playwright/test").Page) => page.evaluate(() => window.__PF_DEBUG?.scene);

test.describe("일본어 화면 훑기", () => {
  test("는 로비에서 주요 화면을 열어 본다", async ({ page }) => {
    await startAfterOpening(page, (session) => {
      session.settings.game.language = "ja";
      session.wallet.gold = 120_000;
      session.wallet.gems = 900;
    });
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await expect.poll(() => scene(page)).toBe("lobby");
    await captureGame(page, `${OUT}/01-lobby.png`);

    await tapUntil(page, 324, BASE_HEIGHT - 90, async () => (await scene(page)) === "relics");
    await captureGame(page, `${OUT}/02-relics.png`);
    await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
    await captureGame(page, `${OUT}/03-info.png`);
    // 스킬 아이콘 셋 중 궁극기를 눌러 조립된 설명문을 본다.
    await tap(page, 470, BASE_HEIGHT - 196);
    await captureGame(page, `${OUT}/04-skill.png`);
  });

  test("는 연구소·프리미엄·설정을 열어 본다", async ({ page }) => {
    await startAfterOpening(page, (session) => {
      session.settings.game.language = "ja";
      session.wallet.gems = 9000;
    });
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await expect.poll(() => scene(page)).toBe("lobby");
    await tapUntil(page, 756, BASE_HEIGHT - 90, async () => (await scene(page)) === "lab");
    await captureGame(page, `${OUT}/05-lab.png`);
    await tapUntil(page, 972, BASE_HEIGHT - 90, async () => (await scene(page)) === "premium");
    await captureGame(page, `${OUT}/06-premium.png`);
    await tapUntil(page, BASE_WIDTH - 58, 86, async () => (await scene(page)) === "settings");
    await captureGame(page, `${OUT}/07-settings.png`);
    // 언어 줄은 게임 탭에 있다. 고를 수 있는 언어가 둘 이상일 때만 서므로 여기서 함께 본다.
    await tap(page, 540, 210);
    await captureGame(page, `${OUT}/07b-settings-game.png`);
  });

  test("는 출격·편성·전투를 열어 본다", async ({ page }) => {
    await startAfterOpening(page, (session) => { session.settings.game.language = "ja"; });
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await expect.poll(() => scene(page)).toBe("lobby");
    await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
    await tap(page, BASE_WIDTH / 2, 550);
    await expect.poll(() => scene(page)).toBe("stageMap");
    await captureGame(page, `${OUT}/08-stageMap.png`);
    await tapUntil(page, BASE_WIDTH / 2, BASE_HEIGHT - 180, async () => (await scene(page)) === "party");
    await captureGame(page, `${OUT}/09-party.png`);
  });
});
