import { describe, expect, it } from "vitest";
import { BASE_WIDTH } from "../../src/config/gameConfig";
import { BOUNTY_TIERS } from "../../src/data/bounty";
import { CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import {
  DUNGEON_LOBBY, dungeonActionButtonX, dungeonActionFitsAboveBackButton, dungeonListBottom,
  dungeonRowCenterY, dungeonRowFaceX, dungeonSummaryTitleTop, dungeonSummaryTop,
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
  it("가장 긴 목록도 요약 판 위에서 끝나고 아래 두 줄은 서로 겹치지 않는다", () => {
    const longest = Math.max(CAKE_OPERATION_TIERS.length, BOUNTY_TIERS.length);
    expect(dungeonListBottom(longest)).toBeLessThan(dungeonSummaryTop());
    // 판 윗변에 걸터앉는 제목표(적 전투력·보상)도 목록 줄에 닿지 않는다.
    expect(dungeonListBottom(longest)).toBeLessThan(dungeonSummaryTitleTop());
    const summaryBottom = DUNGEON_LOBBY.summary.y + DUNGEON_LOBBY.summary.height / 2;
    const actionTop = DUNGEON_LOBBY.action.y - DUNGEON_LOBBY.action.height / 2;
    // 버튼은 누르면 커지므로 그만큼 여유를 둔다.
    expect(actionTop).toBeGreaterThan(summaryBottom + DUNGEON_LOBBY.action.height * 0.06);
    expect(dungeonActionFitsAboveBackButton()).toBe(true);
  });

  it("조작 버튼은 화면 가운데를 기준으로 균등하게 선다", () => {
    expect((dungeonActionButtonX(0) + dungeonActionButtonX(1)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
  });

  /** 속성 뱃지는 대작전의 다섯 속성까지 요약 판 왼쪽 절반 안(가르는 선 앞)에 든다. */
  it("다섯 속성 뱃지가 적 전투력 숫자 자리를 파고들지 않는다", () => {
    const { width, element } = DUNGEON_LOBBY.summary;
    const last = 40 - element.rightInset - element.size / 2;
    const firstLeft = last - 4 * element.step - element.size / 2;
    // 전투력 숫자(46px · 여덟 자 남짓)가 서는 폭을 남긴다.
    expect(firstLeft).toBeGreaterThan(-width / 2 + 48 + 8 * 26);
  });

  it("줄 안의 적 얼굴은 이름 자리와 보상 액자 사이에 선다", () => {
    const { width, padding, rewardSize, faceSize } = DUNGEON_LOBBY.row;
    const faces = [0, 1, 2].map((slot) => dungeonRowFaceX(slot, 3));
    expect(faces[2] + faceSize / 2).toBeLessThan(width / 2 - padding - rewardSize);
    // 이름(왼쪽 여백에서 300px 남짓)과 부딪히지 않는다.
    expect(faces[0] - faceSize / 2).toBeGreaterThan(-width / 2 + padding + 300);
  });
});
