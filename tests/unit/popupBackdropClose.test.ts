import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** 우편·가방·임무·이벤트 같은 작업판은 판 바깥을 눌러도 뒤로 간다. 막아야 하는 창만 예외다. */
const BLOCKING = ["RuneTraitPopup", "SaveConflictPopup", "ExpeditionAugmentPopup", "BattleContributionPopup"];

describe("팝업 바깥 누르기", () => {
  it.each(["MailPopup", "InventoryPopup", "MissionsPopup", "LobbyEventPopup", "TradePopup", "IdleExcavationPopup"])("%s는 바깥을 누르면 닫힌다", (name) => {
    const src = readFileSync(`src/ui/${name}.ts`, "utf8");
    expect(src).toContain("closeOnBackdrop: true");
    expect(src).not.toContain("closeOnBackdrop: false");
  });
  it("바깥 누르기를 막는 창은 선택·확정을 요구하는 창뿐이다", () => {
    for (const name of BLOCKING) expect(readFileSync(`src/ui/${name}.ts`, "utf8")).toContain("closeOnBackdrop: false");
  });
});
