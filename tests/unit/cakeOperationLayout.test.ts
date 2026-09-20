import { describe, expect, it } from "vitest";
import { CAKE_OPERATION_TIERS } from "../../src/data/cakeOperation";
import { CAKE_ACTION_BUTTON, CAKE_MULTIPLIER_CHIP, CAKE_ROW, cakeActionButtonX, cakeActionRowY, cakeFitsAboveBackButton, cakeListBottom, cakeMultiplierChipX, cakeMultiplierRowY, cakeRowCenterY } from "../../src/ui/cakeOperationLayout";
import { DUNGEON_MULTIPLIERS } from "../../src/core/dungeonShortcut";
import { BASE_WIDTH } from "../../src/config/gameConfig";

const COUNT = CAKE_OPERATION_TIERS.length;

describe("치즈케이크 대작전 배치표", () => {
  it("줄은 겹치지 않고 규정 여백만큼 떨어져 흐른다", () => {
    for (let index = 1; index < COUNT; index += 1) {
      expect(cakeRowCenterY(index) - cakeRowCenterY(index - 1)).toBe(CAKE_ROW.height + CAKE_ROW.gap);
    }
    expect(cakeListBottom(COUNT)).toBeGreaterThan(cakeRowCenterY(COUNT - 1));
  });

  /** 여덟 줄이 흐른 뒤에도 배율 줄과 조작 줄이 우하단 뒤로가기를 파고들지 않아야 한다. */
  it("조작 줄은 목록 아래에 서고 뒤로가기와 겹치지 않는다", () => {
    expect(cakeMultiplierRowY(COUNT)).toBeGreaterThan(cakeListBottom(COUNT) + CAKE_MULTIPLIER_CHIP.height / 2);
    expect(cakeActionRowY(COUNT)).toBeGreaterThan(cakeMultiplierRowY(COUNT));
    expect(cakeFitsAboveBackButton(COUNT)).toBe(true);
  });

  it("배율 칩과 조작 버튼은 화면 가운데를 기준으로 균등하게 선다", () => {
    const xs = DUNGEON_MULTIPLIERS.map((_, index) => cakeMultiplierChipX(index, DUNGEON_MULTIPLIERS.length));
    expect((xs[0] + xs[xs.length - 1]) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
    expect(xs[1] - xs[0]).toBe(CAKE_MULTIPLIER_CHIP.width + CAKE_MULTIPLIER_CHIP.gap);
    expect((cakeActionButtonX(0) + cakeActionButtonX(1)) / 2).toBeCloseTo(BASE_WIDTH / 2, 5);
    expect(cakeActionButtonX(1) - cakeActionButtonX(0)).toBe(CAKE_ACTION_BUTTON.width + CAKE_ACTION_BUTTON.gap);
  });
});
