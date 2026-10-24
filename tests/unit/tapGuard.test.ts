import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TAP_DRAG_SLOP, isTapDistance } from "../../src/core/tapGuard";

describe("tapGuard", () => {
  it("기준 안의 움직임은 탭, 넘으면 끌기다", () => {
    expect(isTapDistance(0)).toBe(true);
    expect(isTapDistance(TAP_DRAG_SLOP)).toBe(true);
    expect(isTapDistance(TAP_DRAG_SLOP + 1)).toBe(false);
    expect(isTapDistance(Number.NaN)).toBe(false);
  });

  it("공용 버튼의 취소 거리와 같은 값이다", () => {
    expect(readFileSync("src/ui/Button.ts", "utf8")).toMatch(/BUTTON_DRAG_CANCEL_DISTANCE = TAP_DRAG_SLOP/);
  });

  it.each([
    "src/scenes/InteractionScene.ts",
    "src/ui/InventoryPopup.ts",
    "src/ui/itemFrame.ts",
    "src/ui/InteractionCityPopup.ts",
    "src/scenes/ArenaRoomScene.ts",
    "src/ui/SettingsPicker.ts",
    "src/ui/ObservationJournal.ts",
  ])("%s 의 목록 칸은 공용 탭 판정을 지난다", (file) => {
    expect(readFileSync(file, "utf8")).toMatch(/onTap\(|isTap\(/);
  });
});
