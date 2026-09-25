import { expect, test } from "@playwright/test";
import { startAfterOpening } from "./openingSave";
import { captureGame, tap, tapAndWait } from "./canvasInput";
import { MISSIONS_POPUP_LAYOUT, missionsTabX } from "../../src/ui/missionsPopupLayout";
import { missionPeriodKeys } from "../../src/core/missions";
import { LOBBY_RAIL_BOUNDS } from "../../src/ui/lobbyLayout";

const WIDTH = 1080; const HEIGHT = 1920;

test("임무 버튼은 로비 씬을 유지하고 일일·주간 탭을 각각 렌더링한다", async ({ page }) => {
  await startAfterOpening(page, (saved) => {
    // FIT 모바일 캡처에서 마지막 수령 가능 액자가 가장 밝게 드러나도록 양쪽 연구도를 최대로 둔다.
    // 마디가 받은 것·받을 것·아직인 것 셋으로 갈려 서도록 중간값을 두고, 임무도 세 상태를 섞는다.
    // 기간 키가 비어 있으면 첫 조회가 새 기간으로 보고 진행을 비운다 — 지금 기간으로 맞춰 둔다.
    Object.assign(saved.missions, missionPeriodKeys(new Date()));
    saved.missions.researchPoints = { daily: 60, weekly: 300 };
    saved.missions.claimedResearchStageIds = ["daily:research-20", "weekly:research-100"];
    saved.missions.progress = { "daily-battle": 1, "daily-salary": 1, "daily-stamina": 24, "weekly-battle": 7, "weekly-daily": 20 };
    saved.missions.claimedIds = ["daily-salary"];
  });
  await tap(page, WIDTH / 2, HEIGHT / 2);
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 자리는 로비 배치표에서 읽는다 — 좌표를 손으로 적어 두면 레일이 옮겨 갈 때 엉뚱한 버튼을 누른다.
  const { mission } = LOBBY_RAIL_BOUNDS.content;
  await tapAndWait(page, mission.x, mission.y, () => window.__PF_DEBUG?.popupTitles, ["임무 기록"]);
  expect(await page.evaluate(() => window.__PF_DEBUG?.scene)).toBe("lobby");
  // 일일 탭의 연구도와 네 장 목록을 첫 번째 시각 회귀 자료로 남긴다.
  const tabY = HEIGHT / 2 + MISSIONS_POPUP_LAYOUT.footer.y;
  await expect.poll(() => page.evaluate(() => window.__PF_DEBUG?.missionsPeriod)).toBe("daily");
  await captureGame(page, `test-results/${test.info().project.name}-missions-popup-daily.png`);
  // 같은 팝업에서 주간 탭을 골라 연구도 액자와 짧은 목록의 별도 배치도 검증한다.
  await tapAndWait(page, WIDTH / 2 + missionsTabX(1), tabY, () => window.__PF_DEBUG?.missionsPeriod, "weekly");
  await captureGame(page, `test-results/${test.info().project.name}-missions-popup-weekly.png`);
});
