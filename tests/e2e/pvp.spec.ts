import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { LOBBY_ACTION_BOUNDS } from "../../src/ui/lobbyLayout";
import { PVP_RETURN_SCENE } from "../../src/ui/pvpLayout";
import { PVP_MODES } from "../../src/data/pvpModes";
import { startAfterOpening } from "./openingSave";
import { tap, tapUntil } from "./canvasInput";

/** IconButton의 고정 우하단 슬롯이다. E2E는 Phaser 프리팹을 Node에 import할 수 없어 기준 해상도로 누른다. */
const BACK_SLOT = { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120 } as const;
/** 결투 선택판의 칸 중심. LobbyScene의 `PVP_MENU`와 같은 값이라 배치를 고치면 함께 고친다. */
const MENU = { firstY: BASE_HEIGHT / 2 - 285, stepY: 190 } as const;

/** Canvas 화면의 현재 씬은 렌더 구현을 복제하지 않고 최소 디버그 계약으로만 관찰한다. */
function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

test("로비 결투 판에서 네 PvP 상세 화면을 열고 공용 뒤로가기로 왕복한다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  for (const [index, mode] of PVP_MODES.entries()) {
    // 선택판은 씬이 아니라 로비 위의 판이라, 매번 로비의 결투 입력에서 다시 연다.
    await tapUntil(page, LOBBY_ACTION_BOUNDS.expedition.x, LOBBY_ACTION_BOUNDS.expedition.y, async () =>
      ((await page.evaluate(() => window.__PF_DEBUG?.popupTitles)) ?? []).includes("결투"));
    await tap(page, BASE_WIDTH / 2, MENU.firstY + index * MENU.stepY);
    await expect.poll(() => scene(page)).toBe("pvpPreview");
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.screenTitle)).toBe(mode.title);
    // 상세의 공용 뒤로가기는 선택 씬이 아니라 로비로 돌아간다.
    await tap(page, BACK_SLOT.x, BACK_SLOT.y);
    await expect.poll(() => scene(page)).toBe(PVP_RETURN_SCENE.preview);
  }
});
