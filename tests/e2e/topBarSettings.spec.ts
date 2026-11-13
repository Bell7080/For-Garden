import { expect, test, type Page } from "@playwright/test";
import { installGameHandleProbe } from "./gameDiagnostics";
import { startAfterOpening } from "./openingSave";
import { sourceScene } from "./sourceScene";
import { tap } from "./canvasInput";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { BACK_SLOT } from "../../src/ui/popupGeometry";

/**
 * 상단 줄의 설정 아이콘은 어느 화면에서나 눌려 설정을 열고, 설정을 닫으면 그 화면으로 돌아온다.
 * 편성·스토리 지도·던전 입구처럼 진입 데이터를 들고 선 화면은 설정을 겹쳐 열어 잠든 채 기다린다(`openSettingsOver`).
 */
const HOSTS: readonly { key: string; data?: Record<string, unknown> }[] = [
  { key: "stageMap" }, { key: "party", data: { content: "stage" } }, { key: "raid" }, { key: "bounty" },
  { key: "cakeOperation" }, { key: "duel" }, { key: "guild" }, { key: "pvpPreview", data: { mode: "arena" } },
];
const debugScene = (page: Page) => page.evaluate(() => window.__PF_DEBUG?.scene);

test("상단 설정 아이콘이 모든 화면에서 설정을 열고 돌아온다", async ({ page }) => {
  test.setTimeout(300_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await installGameHandleProbe(page);
  await startAfterOpening(page, (session) => { for (const stage of ["1-5", "1-10", "4-10"]) session.cleared.add(stage); });
  for (const host of HOSTS) {
    const from = await debugScene(page) ?? "lobby";
    await sourceScene(page, `const g=this.game;const from=g.scene.getScene(${JSON.stringify(from)})??g.scene.getScenes(true)[0];from.scene.start(${JSON.stringify(host.key)},${JSON.stringify(host.data ?? {})});`);
    await expect.poll(() => debugScene(page), { timeout: 20_000, message: host.key }).toBe(host.key);
    await page.waitForTimeout(1_200);
    await tap(page, BASE_WIDTH - 58, 86);
    await expect.poll(() => debugScene(page), { timeout: 10_000, message: `${host.key} → 설정` }).toBe("settings");
    await page.waitForTimeout(600);
    await tap(page, BACK_SLOT.x, BACK_SLOT.y);
    await expect.poll(() => debugScene(page), { timeout: 10_000, message: `설정 → ${host.key}` }).toBe(host.key);
  }
  expect(errors).toEqual([]);
});
