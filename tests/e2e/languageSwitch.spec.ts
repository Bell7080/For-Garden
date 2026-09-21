import { test, expect } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap } from "./canvasInput";
import { settingsRowY, settingsTabX } from "../../src/ui/settingsLayout";

const BASE_WIDTH = 1080;
const BASE_HEIGHT = 1920;

/**
 * 환경설정의 **언어 행**이 서는 자리.
 *
 * 게임 탭의 행은 위에서부터 같은 간격으로 쌓이고(`SettingsScene.buildRows`) 언어가 마지막
 * 줄이다. 자리는 손으로 적지 않고 배치표에서 얻는다 — 한 줄만 어긋나도 **바로 위의
 * 「텍스트 속도」가 대신 눌리는데**, 그래도 조작 자체는 성공하므로 검사가 조용히 엉뚱한 행을
 * 통과시킨다. 그래서 아래에서 텍스트 속도가 그대로인지도 함께 본다.
 */
const LANGUAGE_ROW = { x: 800, y: settingsRowY(10) } as const;
const GAME_TAB = { x: settingsTabX(2, 5, BASE_WIDTH), y: 176 } as const;

const scene = (page: import("@playwright/test").Page) => page.evaluate(() => window.__PF_DEBUG?.scene);
const savedGame = (page: import("@playwright/test").Page) => page.evaluate(() =>
  JSON.parse(localStorage.getItem("eternal-city.local-save")!).settings.game as { language: string; textSpeed: number });

/**
 * **언어를 바꾸면 화면이 실제로 그 언어로 다시 그려지는가.**
 *
 * `languageWalk.spec.ts`는 저장에 언어를 심어 두고 시작하므로 이 경로를 지나지 않는다 — 설정
 * 행이 글꼴·문구 표·데이터 덮어쓰기 셋을 모두 받은 뒤 씬을 다시 세우는지는 여기서만 확인된다.
 * 화면 문구뿐 아니라 **정적 데이터**(렐릭 이름·대사)까지 따라오는지 로비에서 함께 본다.
 */
test("환경설정에서 언어를 바꾸면 화면 문구와 정적 데이터가 함께 따라온다", async ({ page }, testInfo) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");
  await tap(page, BASE_WIDTH - 58, 86);
  await expect.poll(() => scene(page)).toBe("settings");
  // 게임 탭으로 옮긴 뒤 행이 실제로 서기까지 한 프레임을 둔다.
  await tap(page, GAME_TAB.x, GAME_TAB.y);
  await expect.poll(async () => (await savedGame(page)).language).toBe("ko");
  const before = await savedGame(page);

  await tap(page, LANGUAGE_ROW.x, LANGUAGE_ROW.y);
  // 글꼴·문구 표·데이터 덮어쓰기가 모두 도착한 뒤에야 씬이 다시 선다.
  await expect.poll(async () => (await savedGame(page)).language, { timeout: 15_000 }).toBe("en");
  // 한 줄 위의 「텍스트 속도」를 잘못 누른 것이 아님을 못 박는다.
  expect((await savedGame(page)).textSpeed).toBe(before.textSpeed);
  await expect.poll(() => scene(page)).toBe("settings");
  await captureGame(page, `test-results/${testInfo.project.name}-language-switch-settings.png`);

  // 설정 화면만이 아니라 다른 화면과 정적 데이터(렐릭 이름·로비 대사)도 함께 바뀐다.
  await tap(page, BASE_WIDTH - 106, BASE_HEIGHT - 120);
  await expect.poll(() => scene(page)).toBe("lobby");
  await captureGame(page, `test-results/${testInfo.project.name}-language-switch-lobby.png`);
});
