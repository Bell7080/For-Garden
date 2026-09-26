import { expect, test } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapUntil } from "./canvasInput";
import { settingsTabX } from "../../src/ui/settingsLayout";

/**
 * 언어를 바꾼 채 화면을 차례로 열어 본다.
 *
 * 문구 표에 키가 있는지는 단위 테스트가 지키지만, **그 글자가 실제로 그려지는지**는 캔버스를
 * 봐야 안다 — 글꼴에 없는 글자는 빈칸이 되고, 길어진 문장은 판 밖으로 나간다.
 */
// 캡처는 기본으로 테스트 산출물 폴더에 쌓는다 — 저장소 안에 그림이 남지 않게 한다.
const OUT = process.env.WALK_OUT ?? "test-results/languageWalk";
const scene = (page: import("@playwright/test").Page) => page.evaluate(() => window.__PF_DEBUG?.scene);

/**
 * **칸을 넘긴 채로 남은 글자가 없는가.**
 *
 * 낱말 길이는 언어가 정하고 칸 폭은 화면이 정한다 — 「일반 공격」 네 글자가 영어에서는
 * `Basic Attack` 열두 글자다. 넘치는 글은 `src/ui/textFit.ts`가 눌러 넣지만, **하한까지 눌러도
 * 들지 않으면** 거기서 멈추고 넘친 채로 남는다. 그때는 글자가 아니라 칸을 손봐야 한다는
 * 신호이므로, 훑는 길에서 하나라도 남으면 문구와 칸 폭을 함께 실패 메시지에 싣는다.
 *
 * 캔버스 안의 글자 폭은 DOM으로 알 수 없어 화면이 직접 알린다(`reportClampedText`).
 */
async function expectNothingClamped(page: import("@playwright/test").Page, where: string): Promise<void> {
  const fit = await page.evaluate(() => ({
    clamped: window.__PF_DEBUG?.clampedText ?? [],
    fitted: window.__PF_DEBUG?.fittedText ?? 0,
  }));
  expect(fit.clamped.map(({ text, width, room }) => `${where}: "${text}" ${width}px > ${room}px`)).toEqual([]);
  // 빈 목록이 "아무것도 넘치지 않았다"인지 "규칙이 통째로 빠졌다"인지 가른다.
  expect(fit.fitted, `${where}: 칸 맞추기를 한 번도 지나지 않았다`).toBeGreaterThan(0);
}

/**
 * 고를 수 있는 언어를 모두 같은 길로 훑는다.
 *
 * 언어마다 스펙을 복사하면 화면이 늘 때 한쪽만 고쳐지고, 그 언어의 회귀가 캡처에서 조용히
 * 사라진다. 새 언어를 `SELECTABLE_LANGUAGE_IDS`에 올리면 여기 한 줄만 더한다.
 */
const WALKED = ["en", "ja", "zh-Hant", "zh-Hans", "th", "vi", "id", "es", "pt-BR", "de", "ru"] as const;

for (const language of WALKED) {
test.describe(`${language} 화면 훑기`, () => {
  test("는 로비에서 주요 화면을 열어 본다", async ({ page }) => {
    await startAfterOpening(page, (session) => {
      session.settings.game.language = language;
      session.wallet.gold = 120_000;
      session.wallet.gems = 900;
    });
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await expect.poll(() => scene(page)).toBe("lobby");
    await captureGame(page, `${OUT}/${language}/01-lobby.png`);

    await tapUntil(page, 324, BASE_HEIGHT - 90, async () => (await scene(page)) === "relics");
    await captureGame(page, `${OUT}/${language}/02-relics.png`);
    await tapUntil(page, 200, 620, async () => (await page.evaluate(() => window.__PF_DEBUG?.infoOpen)) === true);
    await captureGame(page, `${OUT}/${language}/03-info.png`);
    // 스킬 아이콘 셋 중 궁극기를 눌러 조립된 설명문을 본다.
    await tap(page, 470, BASE_HEIGHT - 196);
    await captureGame(page, `${OUT}/${language}/04-skill.png`);
    await expectNothingClamped(page, `${language} 도감·정보창·스킬 쪽지`);
  });

  test("는 연구소·프리미엄·설정을 열어 본다", async ({ page }) => {
    await startAfterOpening(page, (session) => {
      session.settings.game.language = language;
      session.wallet.gems = 9000;
    });
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await expect.poll(() => scene(page)).toBe("lobby");
    await tapUntil(page, 756, BASE_HEIGHT - 90, async () => (await scene(page)) === "lab");
    await captureGame(page, `${OUT}/${language}/05-lab.png`);
    await tapUntil(page, 972, BASE_HEIGHT - 90, async () => (await scene(page)) === "premium");
    await captureGame(page, `${OUT}/${language}/06-premium.png`);
    await tapUntil(page, BASE_WIDTH - 58, 86, async () => (await scene(page)) === "settings");
    await captureGame(page, `${OUT}/${language}/07-settings.png`);
    // 언어 줄은 게임 탭에 있다. 고를 수 있는 언어가 둘 이상일 때만 서므로 여기서 함께 본다.
    await tap(page, settingsTabX(2, 5, BASE_WIDTH), 176);
    await captureGame(page, `${OUT}/${language}/07b-settings-game.png`);
    await expectNothingClamped(page, `${language} 연구소·프리미엄·환경설정`);
  });

  test("는 출격·편성·전투를 열어 본다", async ({ page }) => {
    await startAfterOpening(page, (session) => { session.settings.game.language = language; });
    await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
    await expect.poll(() => scene(page)).toBe("lobby");
    await tap(page, BASE_WIDTH - 290, BASE_HEIGHT - 425);
    await tap(page, BASE_WIDTH / 2, 550);
    await expect.poll(() => scene(page)).toBe("stageMap");
    await captureGame(page, `${OUT}/${language}/08-stageMap.png`);
    await tapUntil(page, BASE_WIDTH / 2, BASE_HEIGHT - 180, async () => (await scene(page)) === "party");
    await captureGame(page, `${OUT}/${language}/09-party.png`);
    await expectNothingClamped(page, `${language} 지도·편성`);
  });
});
}
