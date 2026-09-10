import { expect, test, type Page } from "@playwright/test";
import { BASE_HEIGHT, BASE_WIDTH } from "../../src/config/gameConfig";
import { LOBBY_ACTION_BOUNDS } from "../../src/ui/lobbyLayout";
import { pvpGridCell, PVP_RETURN_SCENE } from "../../src/ui/pvpLayout";
import { PVP_MODES } from "../../src/data/pvpModes";
import { startAfterOpening } from "./openingSave";
import { tap, tapUntil } from "./canvasInput";

/** IconButton의 고정 우하단 슬롯이다. E2E는 Phaser 프리팹을 Node에 import할 수 없어 기준 해상도로 누른다. */
const BACK_SLOT = { x: BASE_WIDTH - 106, y: BASE_HEIGHT - 120 } as const;

/** Canvas 화면의 현재 씬은 렌더 구현을 복제하지 않고 최소 디버그 계약으로만 관찰한다. */
function scene(page: Page): Promise<string | undefined> {
  return page.evaluate(() => window.__PF_DEBUG?.scene);
}

test("로비 결투에서 네 PvP 상세 화면을 열고 공용 뒤로가기로 왕복한다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, BASE_WIDTH / 2, BASE_HEIGHT / 2);
  await expect.poll(() => scene(page)).toBe("lobby");

  // 로비의 실제 결투 입력 중심을 눌러 선택 화면에 진입한다.
  await tapUntil(page, LOBBY_ACTION_BOUNDS.expedition.x, LOBBY_ACTION_BOUNDS.expedition.y, async () => (await scene(page)) === "pvp");

  for (const [index, mode] of PVP_MODES.entries()) {
    const cell = pvpGridCell(index);
    // 각 정사각형 입력면은 식별 가능한 mode를 전달하며 상세 제목으로 그 결과를 확인한다.
    await tap(page, cell.x, cell.y);
    await expect.poll(() => scene(page)).toBe("pvpPreview");
    await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.screenTitle)).toBe(mode.title);
    await tap(page, BACK_SLOT.x, BACK_SLOT.y);
    await expect.poll(() => scene(page)).toBe(PVP_RETURN_SCENE.preview);
  }

  // 선택 화면의 같은 공용 버튼은 상세와 달리 로비를 목적지로 삼는다.
  await tap(page, BACK_SLOT.x, BACK_SLOT.y);
  await expect.poll(() => scene(page)).toBe(PVP_RETURN_SCENE.selection);
});
