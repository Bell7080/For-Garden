import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { DUNGEON_MULTIPLIERS } from "../../src/core/dungeonShortcut";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import {
  DUNGEON_LOBBY, dungeonActionButtonX, dungeonActionFitsAboveBackButton, dungeonListBottom, dungeonMultiplierChipX,
  dungeonRowCenterY, dungeonRowFaceX, dungeonSummaryTop,
} from "../../src/ui/dungeonLobbyLayout";

describe("던전 입구 배치표", () => {
  it("줄은 겹치지 않고 규정 여백만큼 떨어져 흐른다", () => {
    for (let index = 1; index < CAKE_OPERATION_TIERS.length; index += 1) {
      expect(dungeonRowCenterY(index) - dungeonRowCenterY(index - 1)).toBe(DUNGEON_LOBBY.row.height + DUNGEON_LOBBY.row.gap);
    }
    // 제목 아래에서 시작한다.
    expect(dungeonRowCenterY(0) - DUNGEON_LOBBY.row.height / 2).toBeGreaterThan(DUNGEON_LOBBY.title.y);
  });

  /** 두 던전 중 가장 긴 목록이 끝난 뒤에도 요약 판을 파고들지 않아야 한다. */
  it("가장 긴 목록도 요약 판 위에서 끝나고 아래 세 줄은 서로 겹치지 않는다", () => {
    const longest = Math.max(CAKE_OPERATION_TIERS.length, BOUNTY_TIERS.length);
    expect(dungeonListBottom(longest)).toBeLessThan(dungeonSummaryTop());
    const summaryBottom = DUNGEON_LOBBY.summary.y + DUNGEON_LOBBY.summary.height / 2;
    const chipTop = DUNGEON_LOBBY.multiplier.y - DUNGEON_LOBBY.multiplier.chipHeight / 2;
    const chipBottom = DUNGEON_LOBBY.multiplier.y + DUNGEON_LOBBY.multiplier.chipHeight / 2;
    const actionTop = DUNGEON_LOBBY.action.y - DUNGEON_LOBBY.action.height / 2;
    expect(chipTop).toBeGreaterThan(summaryBottom);
    // 고른 배율 칩은 1.12배로 커지므로 그만큼 여유를 둔다.
    expect(actionTop).toBeGreaterThan(chipBottom + DUNGEON_LOBBY.multiplier.chipHeight * 0.06);
    expect(dungeonActionFitsAboveBackButton()).toBe(true);
  });

  it("배율 칩과 조작 버튼은 화면 가운데를 기준으로 균등하게 선다", () => {
    const xs = DUNGEON_MULTIPLIERS.map((_, index) => dungeonMultiplierChipX(index, DUNGEON_MULTIPLIERS.length));
    expect((xs[0] + xs[xs.length - 1]) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
    expect(xs[1] - xs[0]).toBe(DUNGEON_LOBBY.multiplier.chipWidth + DUNGEON_LOBBY.multiplier.gap);
    expect((dungeonActionButtonX(0) + dungeonActionButtonX(1)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
  });

  it("줄 안의 적 얼굴은 이름 자리와 보상 액자 사이에 선다", () => {
    const { width, padding, rewardSize, faceSize } = DUNGEON_LOBBY.row;
    const faces = [0, 1, 2].map((slot) => dungeonRowFaceX(slot, 3));
    expect(faces[2] + faceSize / 2).toBeLessThan(width / 2 - padding - rewardSize);
    // 이름(왼쪽 여백에서 300px 남짓)과 부딪히지 않는다.
    expect(faces[0] - faceSize / 2).toBeGreaterThan(-width / 2 + padding + 300);
  });
});
