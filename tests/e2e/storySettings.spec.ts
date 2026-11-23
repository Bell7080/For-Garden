import { expect, test, type Page } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { captureGame, tap, tapUntil } from "./canvasInput";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { BACK_SLOT } from "../../src/ui/popupGeometry";
import { DIALOGUE_PANEL_TOP } from "../../src/ui/dialogueStageLayout";

/**
 * 대사 도중 설정을 열고 닫아도 이야기가 그 자리에서 잇는다. 자동 진행을 켜 둔 채 열면 설정이 떠 있는 동안 대사가
 * 넘어가지 않고(씬이 잠들어 시계가 멎는다), 닫으면 같은 노드에서 다시 흐른다. 언어·글자 크기를 바꿔 다시 서는
 * 길(`resumeNodeId`)은 제목표 없이 읽던 노드에서 연다.
 */
const TOOL_Y = DIALOGUE_PANEL_TOP - 62;
const toolX = (index: number) => BASE_WIDTH - 48 - 75 - index * 162;
const debug = (page: Page) => page.evaluate(() => ({ scene: window.__PF_DEBUG?.scene, node: window.__PF_DEBUG?.dialogue?.nodeId }));
const SHOTS = process.env.STORY_SETTINGS_SHOTS;
const autoOn = async (page: Page): Promise<boolean> => {
  await sourceScene(page, `window.__storyAuto=this.game.scene.getScene("opening").layer.autoChip.isActive();`);
  return page.evaluate(() => (window as unknown as { __storyAuto?: boolean }).__storyAuto === true);
};

test("대사 도중 설정을 열고 닫아도 이야기가 그 자리에서 잇는다", async ({ page }) => {
  // GPU 없는 컨테이너에서는 프레임이 느려 씬 시계도 그만큼 느리게 흐른다 — 자동 진행을 넉넉히 기다린다.
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installGameHandleProbe(page);
  await startAfterOpening(page);
  await sourceScene(page, `const g=this.game;const from=g.scene.getScenes(true).find(s=>s.scene.key!=="effect-overlay"&&s.scene.key!=="arenaNotice");from.scene.start("opening");`);
  await expect.poll(async () => (await debug(page)).scene, { timeout: 20_000 }).toBe("opening");
  // 제목표가 걷히고 첫 대사가 설 때까지 기다린다.
  await page.waitForTimeout(7_000);
  await tap(page, BASE_WIDTH / 2, 1600);
  await page.waitForTimeout(800);

  // 자동 진행을 켠다(제목표가 걷히는 동안은 막이 손을 받으므로 켜질 때까지 누른다).
  await tapUntil(page, toolX(0), TOOL_Y, () => autoOn(page), { gapMs: 1_500 });
  await page.waitForTimeout(400);
  if (SHOTS) await captureGame(page, `${SHOTS}/1-story-chip.png`);
  const before = (await debug(page)).node;
  expect(before).toBeTruthy();

  // 설정 칩 → 설정이 겹쳐 열린다.
  await tap(page, toolX(3), TOOL_Y);
  await expect.poll(async () => (await debug(page)).scene, { timeout: 10_000 }).toBe("settings");
  await page.waitForTimeout(600);
  if (SHOTS) await captureGame(page, `${SHOTS}/2-settings-over-story.png`);
  // 설정이 떠 있는 동안 자동 진행은 멎는다 — 한참 기다린 뒤 돌아와도 같은 노드다.
  await page.waitForTimeout(6_000);
  expect((await debug(page)).scene).toBe("settings");

  // 돌아가기 → 같은 노드에서 다시 흐르고, 자동 진행이 이어 넘긴다.
  await tap(page, BACK_SLOT.x, BACK_SLOT.y);
  await expect.poll(async () => (await debug(page)).scene, { timeout: 10_000 }).toBe("opening");
  await expect.poll(async () => (await debug(page)).node, { timeout: 3_000 }).toBe(before);
  if (SHOTS) await captureGame(page, `${SHOTS}/3-back-to-story.png`);
  await expect.poll(async () => (await debug(page)).node, { timeout: 90_000, message: "자동 진행이 이어진다" }).not.toBe(before);

  // 언어·글자 크기가 바뀌어 다시 서는 길: 읽던 노드에서 제목표 없이 연다.
  const reading = (await debug(page)).node!;
  await sourceScene(page, `const s=this.game.scene.getScene("opening");s.scene.restart({resumeNodeId:${JSON.stringify(reading)}});`);
  await page.waitForTimeout(1_500);
  expect(await debug(page)).toMatchObject({ scene: "opening" });
  const resumed = (await debug(page)).node;
  // 자동 진행이 켜져 있어 한 마디 더 넘어갔을 수는 있지만 처음으로 돌아가지는 않는다.
  if (reading !== "wake") expect(resumed).not.toBe("wake");
  if (SHOTS) await captureGame(page, `${SHOTS}/4-resumed.png`);
  expect(errors).toEqual([]);
});
