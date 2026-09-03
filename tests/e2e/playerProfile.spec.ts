import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
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
  await tap(page, 910, 640);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.playerProfileOpen)).toBeUndefined();
  await tap(page, 176, 86);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.playerProfileOpen)).toBe(true);
});
