import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { PLAYER_PROFILE_LAYOUT } from "../../src/ui/playerProfileLayout";
import { POPUP_CLOSE_LAYOUT } from "../../src/ui/popupGeometry";
import { captureGame, tap } from "./canvasInput";

const WIDTH = 1080; const HEIGHT = 1920;

test("로비 프로필 칩은 공개 정보창을 열고 공용 닫기로 정리한다", async ({ page }) => {
  await startAfterOpening(page);
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 얼굴과 이름을 감싼 프로필 칩의 중앙을 눌러 PopupLayer 정보창을 연다.
  await tap(page, 176, 86);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.playerProfileOpen)).toBe(true);
  await captureGame(page, `test-results/${test.info().project.name}-player-profile-popup.png`);
  // 공용 PopupLayer의 오른쪽 위 X 입력면으로 닫아 팝업 상태와 인스턴스 정리를 확인한다.
  //
  // **X 자리는 배치표에서 구한다.** 좌표를 적어 두었더니 실제 X(y 550)보다 90px 아래를 누르고
  // 있었고, 그 빈 판을 누른 손이 뒤 배경까지 내려가 팝업이 닫혀 **틀린 이유로 통과**하고 있었다.
  // 판이 제 입력을 삼키게 된 뒤로 그 구멍이 막혀 드러났다.
  const closeX = WIDTH / 2 + PLAYER_PROFILE_LAYOUT.popup.width / 2 - POPUP_CLOSE_LAYOUT.centerInset;
  const closeY = HEIGHT / 2 - PLAYER_PROFILE_LAYOUT.popup.height / 2 + POPUP_CLOSE_LAYOUT.centerInset;
  await tap(page, closeX, closeY);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.playerProfileOpen)).toBeUndefined();
  await tap(page, 176, 86);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.playerProfileOpen)).toBe(true);
});
